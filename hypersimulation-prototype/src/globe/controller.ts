import {
  Cartesian2, Cartesian3, Color, Ellipsoid, EllipsoidTerrainProvider, Viewer, CustomHeightmapTerrainProvider,
  GeographicTilingScheme, Rectangle, SingleTileImageryProvider, ImageryLayer,
  PolygonHierarchy, PolylineDashMaterialProperty,
  ScreenSpaceEventHandler, ScreenSpaceEventType, SceneTransforms, EllipsoidalOccluder,
} from 'cesium';
import type { DatasetDefinition } from '../datasets/definition';
import { LayerSlot } from '../datasets/layer-slot';
import { attachWmts } from './wmts';
import { geoToLocal, sample, type TerrainData, type Route } from '../mission/data';
import { SCIENCE, type GeologySelection, type GeologySettings } from '../datasets/geology';
import { colorAt, layerRange, sampleAt, type ScalarLayer } from '../environment/model';
import { REGIONS, OVERLAYS, type Region, type RegionId, type OverlaySettings, defaultOverlays } from '../datasets/catalog';

export interface GlobeStatus { loading: boolean; error?: string }
export interface RegionMarker { id: RegionId; x: number; y: number }

export class GlobeController {
  private viewer: Viewer;
  private slot: LayerSlot<DatasetDefinition>;
  private removeProgress: () => void;
  private localData?: TerrainData;
  private localLayers: ImageryLayer[] = [];
  private localGeneration = 0;
  private overlays = defaultOverlays();
  private removeMarkers: () => void;
  private picking: ScreenSpaceEventHandler;
  private geologyIds: string[] = [];
  private environmentLayer?:ScalarLayer;
  private environmentImage?:ImageryLayer;
  private environmentGeneration=0;
  private environmentKey='';

  constructor(container: HTMLElement, report: (status: GlobeStatus) => void,
    onSelect: (id: RegionId) => void, onMarkers: (markers: RegionMarker[]) => void, onGeologySelect: (selection: GeologySelection) => void, onEnvironmentSelect?:(id?:string)=>void) {
    Ellipsoid.default = Ellipsoid.MARS;
    this.viewer = new Viewer(container, {
      baseLayer: false, terrainProvider: new EllipsoidTerrainProvider({ ellipsoid: Ellipsoid.MARS }),
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
      sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false,
      selectionIndicator: false, infoBox: false, skyAtmosphere: false, requestRenderMode: true,
    });
    const globe = this.viewer.scene.globe;
    globe.baseColor = Color.fromCssColorString('#714d3d');
    globe.showGroundAtmosphere = false;
    globe.enableLighting = false;
    this.viewer.scene.backgroundColor = Color.fromCssColorString('#151412');
    this.home();
    this.removeProgress = globe.tileLoadProgressEvent.addEventListener((count: number) => report({ loading: count > 0 }));
    this.slot = new LayerSlot(async (definition) => attachWmts(this.viewer, definition, () => report({
      loading: false, error: 'Some map tiles could not load. Check the dataset endpoint and your connection, then retry.',
    })));
    const positions = REGIONS.map(region => ({ region, position: Cartesian3.fromDegrees(region.center.longitude, region.center.latitude, 50, Ellipsoid.MARS) }));
    positions.forEach(({ region, position }) => {
      this.viewer.entities.add({ id: `region-${region.id}`, position, point: { pixelSize: 12, color: Color.fromCssColorString('#f2c38c'), outlineColor: Color.BLACK, outlineWidth: 2 } });
      if (region.terrain) this.viewer.entities.add({ id: `coverage-${region.id}`, rectangle: { coordinates: Rectangle.fromDegrees(...region.terrain.bounds), fill: false, outline: true, outlineColor: Color.fromCssColorString('#E6CB95'), height: region.terrain.outlineHeightM } });
    });
    let previous = '';
    this.removeMarkers = this.viewer.scene.postRender.addEventListener(() => {
      const occluder = new EllipsoidalOccluder(Ellipsoid.MARS, this.viewer.camera.positionWC);
      const markers: RegionMarker[] = [];
      for (const { region, position } of positions) {
        if (!occluder.isPointVisible(position)) continue;
        const p = SceneTransforms.worldToWindowCoordinates(this.viewer.scene, position);
        if (p && p.x >= 0 && p.y >= 0 && p.x <= container.clientWidth && p.y <= container.clientHeight) markers.push({ id: region.id, x: Math.round(p.x), y: Math.round(p.y) });
      }
      const key = JSON.stringify(markers);
      if (key !== previous) { previous = key; onMarkers(markers); }
    });
    this.picking = new ScreenSpaceEventHandler(this.viewer.canvas);
    this.picking.setInputAction((event: { position: Cartesian2 }) => {
      const picked = this.viewer.scene.pick(event.position);
      const region = REGIONS.find(r => picked?.id?.id === `region-${r.id}` || picked?.id?.id === `coverage-${r.id}`);
      if (region) onSelect(region.id);
      const id=picked?.id?.id;
      if(typeof id==='string'&&id.startsWith('geology-unit-'))onGeologySelect({kind:'unit',id:id.split('-')[2]});
      if(typeof id==='string'&&id.startsWith('geology-contact-'))onGeologySelect({kind:'contact',id:id.split('-')[2]});
      if(this.environmentLayer&&onEnvironmentSelect){const point=this.viewer.camera.pickEllipsoid(event.position,Ellipsoid.MARS);if(point){const c=Ellipsoid.MARS.cartesianToCartographic(point);onEnvironmentSelect(sampleAt(this.environmentLayer,c.longitude*180/Math.PI,c.latitude*180/Math.PI)?.id);}}
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  replaceDataset(definition: DatasetDefinition) { return this.slot.replace(definition); }
  invalidatePending() { this.slot.invalidatePending(); }
  setVisible(visible: boolean) { this.slot.setVisible(visible); }
  setOpacity(opacity: number) { this.slot.setOpacity(opacity); }
  async setLocalData(data?: TerrainData) {
    if(this.localData===data)return;
    const generation = ++this.localGeneration;
    for (const layer of this.localLayers) this.viewer.imageryLayers.remove(layer, true);
    this.localLayers = [];
    this.localData=data;
    if (!data) { this.viewer.terrainProvider = new EllipsoidTerrainProvider({ ellipsoid: Ellipsoid.MARS }); this.viewer.scene.requestRender(); return; }
    const scheme=new GeographicTilingScheme({ellipsoid:Ellipsoid.MARS});
    this.viewer.terrainProvider=new CustomHeightmapTerrainProvider({tilingScheme:scheme,width:33,height:33,callback:(x,y,level)=>{
      const heights=new Float32Array(33*33);
      if(level<6)return heights;
      const rect=scheme.tileXYToRectangle(x,y,level);
      for(let r=0;r<33;r++)for(let c=0;c<33;c++){
        const lon=(rect.west+(rect.east-rect.west)*c/32)*180/Math.PI;
        const lat=(rect.north-(rect.north-rect.south)*r/32)*180/Math.PI;
        const value=sample(data,geoToLocal(data.meta,lon,lat));
        if(value)heights[r*33+c]=value.elevation-data.meta.referenceElevationM;
      }
      return heights;
    }});
    try {
      for(const overlay of OVERLAYS){
        const provider=await SingleTileImageryProvider.fromUrl(`${data.baseUrl}/${overlay.file}`,{rectangle:Rectangle.fromDegrees(...data.meta.bounds),credit:data.meta.attribution});
        if(this.viewer.isDestroyed() || generation !== this.localGeneration)return;
        const layer=this.viewer.imageryLayers.addImageryProvider(provider);
        layer.show=this.overlays[overlay.id].visible;layer.alpha=this.overlays[overlay.id].opacity;this.localLayers.push(layer);
      }
    } catch (error) {
      if (!this.viewer.isDestroyed() && generation === this.localGeneration) {
        for (const layer of this.localLayers) this.viewer.imageryLayers.remove(layer, true);
        this.localLayers = []; this.localData = undefined;
      }
      throw error;
    }
    if(this.environmentImage)this.viewer.imageryLayers.raiseToTop(this.environmentImage);
    this.viewer.scene.requestRender();
  }
  setOverlays(settings: OverlaySettings) {
    this.overlays = settings;
    this.localLayers.forEach((layer, index) => { const state = settings[OVERLAYS[index].id]; layer.show = state.visible; layer.alpha = state.opacity; });
    this.viewer.scene.requestRender();
  }
  setRoute(route?:Route){
    this.viewer.entities.removeById('active-route');
    if(route&&this.localData)this.viewer.entities.add({id:'active-route',polyline:{positions:route.geographic.map(([lon,lat,z])=>Cartesian3.fromDegrees(lon,lat,z-this.localData!.meta.referenceElevationM+3,Ellipsoid.MARS)),width:4,material:Color.fromCssColorString('#ffd29b')}});
    this.viewer.scene.requestRender();
  }
  setGeology(regionId:RegionId|undefined,settings:GeologySettings,selection?:GeologySelection) {
    this.geologyIds.forEach(id=>this.viewer.entities.removeById(id));this.geologyIds=[];
    if(!regionId||!settings.visible){this.viewer.scene.requestRender();return;}
    const region=SCIENCE.regions[regionId];
    if(!region)return;
    const positions=(ring:[number,number][])=>Cartesian3.fromDegreesArray(ring.flat(),Ellipsoid.MARS);
    this.viewer.entities.suspendEvents();
    for(const unit of region.units)unit.polygons.forEach((rings,index)=>{
      const id=`geology-unit-${unit.id}-${index}`,active=selection?.kind==='unit'&&selection.id===unit.id;
      this.geologyIds.push(id);this.viewer.entities.add({id,polygon:{hierarchy:new PolygonHierarchy(positions(rings[0]),rings.slice(1).map(r=>new PolygonHierarchy(positions(r)))),material:Color.fromCssColorString(unit.color).withAlpha(Math.min(1,settings.opacity*(active?1.25:1)))}});
    });
    if(settings.contacts)for(const contact of region.contacts)contact.lines.forEach((line,index)=>{
      const id=`geology-contact-${contact.id}-${index}`,active=selection?.kind==='contact'&&selection.id===contact.id;
      const color=Color.fromCssColorString(active?'#ffe1a0':'#242c29').withAlpha(settings.opacity);
      this.geologyIds.push(id);this.viewer.entities.add({id,polyline:{positions:positions(line),width:active?5:2,clampToGround:true,material:contact.type.toLowerCase().includes('approx')?new PolylineDashMaterialProperty({color}):color}});
    });
    this.viewer.entities.resumeEvents();this.viewer.scene.requestRender();
  }
  focusGeology(regionId:RegionId) {const region=SCIENCE.regions[regionId];if(region)this.viewer.camera.flyTo({destination:Rectangle.fromDegrees(...region.bounds),duration:1.2});}
  async setEnvironment(layer:ScalarLayer|undefined,opacity:number){
    const key=layer?`${layer.id}:${layer.period}:${layer.kind}`:'';
    if(key===this.environmentKey&&this.environmentImage){this.environmentImage.alpha=opacity;this.viewer.scene.requestRender();return;}
    this.environmentKey=key;
    this.environmentLayer=layer;const generation=++this.environmentGeneration;
    this.viewer.canvas.dataset.environmentLayer='';
    if(this.environmentImage){this.viewer.imageryLayers.remove(this.environmentImage,true);this.environmentImage=undefined;}
    if(!layer){this.viewer.scene.requestRender();return;}
    const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=720;const ctx=canvas.getContext('2d')!,range=layerRange(layer);
    for(const s of layer.samples){if(s.value===null)continue;ctx.fillStyle=colorAt(s.value,range);if(s.bounds){const[w,south,e,n]=s.bounds;ctx.fillRect((w+180)/360*1440,(90-n)/180*720,(e-w)/360*1440,(n-south)/180*720);}else{ctx.beginPath();ctx.arc((s.lon+180)/360*1440,(90-s.lat)/180*720,3,0,Math.PI*2);ctx.fill();}}
    const provider=await SingleTileImageryProvider.fromUrl(canvas.toDataURL(),{rectangle:Rectangle.fromDegrees(-180,-90,180,90),credit:layer.instrument});
    if(this.viewer.isDestroyed()||generation!==this.environmentGeneration)return;
    this.environmentImage=this.viewer.imageryLayers.addImageryProvider(provider);this.environmentImage.alpha=opacity;this.viewer.canvas.dataset.environmentLayer=layer.id;this.viewer.scene.requestRender();
  }
  focusRegion(region: Region) { this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(region.center.longitude, region.center.latitude, region.cameraHeightM, Ellipsoid.MARS), duration: 1.2 }); }
  /** Reports the camera height above the surface now and whenever the camera moves; returns the unsubscribe. */
  watchHeight(report: (heightM: number) => void) {
    const camera = this.viewer.camera;
    const send = () => report(Cartesian3.magnitude(camera.positionWC) - Ellipsoid.MARS.maximumRadius);
    const removeEnd = camera.moveEnd.addEventListener(send), removeChange = camera.changed.addEventListener(send);
    send();
    return () => { removeEnd(); removeChange(); };
  }
  /** Calls back once, after the first frame drawn with a basemap attached and every visible tile loaded; returns the unsubscribe. */
  whenDrawn(done: () => void) {
    const scene = this.viewer.scene;
    let fired = false;
    const remove = scene.postRender.addEventListener(() => {
      if (fired || this.viewer.imageryLayers.length === 0 || !scene.globe.tilesLoaded) return;
      fired = true;
      queueMicrotask(() => { remove(); done(); });
    });
    scene.requestRender();
    return () => { if (!fired) remove(); };
  }
  home() {
    this.viewer.camera.cancelFlight();
    this.viewer.camera.setView({ destination: Cartesian3.fromDegrees(107, 8, 10_500_000, Ellipsoid.MARS) });
    this.viewer.scene.requestRender();
  }
  dispose() { this.localGeneration++; this.environmentGeneration++; this.removeProgress(); this.removeMarkers(); this.picking.destroy(); this.slot.dispose(); this.viewer.destroy(); }
}
