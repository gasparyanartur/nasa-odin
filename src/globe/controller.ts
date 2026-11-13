import {
  Cartesian3, Color, Ellipsoid, EllipsoidTerrainProvider, Viewer, CustomHeightmapTerrainProvider,
  GeographicTilingScheme, Rectangle, SingleTileImageryProvider, ImageryLayer,
} from 'cesium';
import type { DatasetDefinition } from '../datasets/definition';
import { LayerSlot } from '../datasets/layer-slot';
import { attachWmts } from './wmts';
import { geoToLocal, sample, type TerrainData, type Route } from '../mission/data';

export interface GlobeStatus { loading: boolean; error?: string }

export class GlobeController {
  private viewer: Viewer;
  private slot: LayerSlot<DatasetDefinition>;
  private removeProgress: () => void;
  private localData?: TerrainData;
  private localLayers: ImageryLayer[] = [];

  constructor(container: HTMLElement, report: (status: GlobeStatus) => void) {
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
    this.viewer.scene.backgroundColor = Color.fromCssColorString('#101514');
    this.home();
    this.removeProgress = globe.tileLoadProgressEvent.addEventListener((count: number) => report({ loading: count > 0 }));
    this.slot = new LayerSlot(async (definition) => attachWmts(this.viewer, definition, () => report({
      loading: false, error: 'Some map tiles could not load. Check the dataset endpoint and your connection, then retry.',
    })));
  }

  replaceDataset(definition: DatasetDefinition) { return this.slot.replace(definition); }
  invalidatePending() { this.slot.invalidatePending(); }
  setVisible(visible: boolean) { this.slot.setVisible(visible); }
  setOpacity(opacity: number) { this.slot.setOpacity(opacity); }
  async setLocalData(data: TerrainData) {
    if(this.localData===data)return;
    this.localData=data;
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
    for(const file of ['ortho.jpg','slope.png']){
      const provider=await SingleTileImageryProvider.fromUrl(`/gale/${file}`,{rectangle:Rectangle.fromDegrees(...data.meta.bounds),credit:data.meta.attribution});
      if(this.viewer.isDestroyed())return;
      const layer=this.viewer.imageryLayers.addImageryProvider(provider);layer.show=file==='ortho.jpg';this.localLayers.push(layer);
    }
    this.viewer.entities.add({id:'gale-footprint',rectangle:{coordinates:Rectangle.fromDegrees(...data.meta.bounds),fill:false,outline:true,outlineColor:Color.fromCssColorString('#bce7ce'),height:1}});
    this.viewer.scene.requestRender();
  }
  setLocalSlope(show:boolean){if(this.localLayers[1])this.localLayers[1].show=show;this.viewer.scene.requestRender();}
  setRoute(route?:Route){
    this.viewer.entities.removeById('active-route');
    if(route&&this.localData)this.viewer.entities.add({id:'active-route',polyline:{positions:route.geographic.map(([lon,lat,z])=>Cartesian3.fromDegrees(lon,lat,z-this.localData!.meta.referenceElevationM+3,Ellipsoid.MARS)),width:4,material:Color.fromCssColorString('#ffd29b')}});
    this.viewer.scene.requestRender();
  }
  focusGale(){if(this.localData){const o=this.localData.meta.origin;this.viewer.camera.flyTo({destination:Cartesian3.fromDegrees(o.longitude,o.latitude,4200,Ellipsoid.MARS),duration:1.5});}}
  home() {
    this.viewer.camera.setView({ destination: Cartesian3.fromDegrees(-105, 15, 10_500_000, Ellipsoid.MARS) });
    this.viewer.scene.requestRender();
  }
  dispose() { this.removeProgress(); this.slot.dispose(); this.viewer.destroy(); }
}
