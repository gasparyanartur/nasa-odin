import { useEffect, useRef, useState } from 'react';
import { parseDataset, type DatasetDefinition } from './datasets/definition';
import { BASEMAPS, REGIONS, canPlan, getRegion, type RegionId, type OverlayId, type OverlaySettings } from './datasets/catalog';
import { GlobeController, type RegionMarker } from './globe/controller';
import RegionalLayers from './RegionalLayers';
import GeologyPanel from './GeologyPanel';
import { type GeologySettings, type GeologySelection } from './datasets/geology';
import { historicalAt, lmstLabel } from './mission/conditions';
import type { TerrainData, Route } from './mission/data';
import EnvironmentControls from './environment/Controls';
import type { EnvironmentCatalog, EnvironmentSelection } from './environment/model';
import { availableLayers } from './environment/model';

interface Props {
  environmentCatalog?:EnvironmentCatalog; environmentSelection?:EnvironmentSelection; onEnvironmentChange?:(s:EnvironmentSelection)=>void;
  geology:GeologySettings; geologySelection?:GeologySelection; onGeologySettings:(s:GeologySettings)=>void; onGeologySelect:(s:GeologySelection)=>void; onDemo:()=>void;
  data?:TerrainData; dataError?:string; route?:Route; selectedRegionId?:RegionId;
  onRegionChange:(id?:RegionId)=>void; onExplore:()=>void;
  basemap:DatasetDefinition; onBasemapChange:(definition:DatasetDefinition)=>void;
  visible:boolean; onVisibleChange:(visible:boolean)=>void; opacity:number; onOpacityChange:(value:number)=>void;
  overlays:OverlaySettings; onOverlayChange:(id:OverlayId,patch:Partial<OverlaySettings[OverlayId]>)=>void;
  conditionsHour:number; conditionsVisible:boolean; onConditionsChange:(visible:boolean)=>void;
}

export default function GlobeExplorer(p:Props) {
  const container=useRef<HTMLDivElement>(null),controller=useRef<GlobeController|null>(null);
  const onSelect=useRef(p.onRegionChange);onSelect.current=p.onRegionChange;
  const onGeology=useRef(p.onGeologySelect);onGeology.current=p.onGeologySelect;
  const onEnvironment=useRef(p.onEnvironmentChange);onEnvironment.current=p.onEnvironmentChange;
  const environmentSelection=useRef(p.environmentSelection);environmentSelection.current=p.environmentSelection;
  const sequence=useRef(0),importSequence=useRef(0);
  const [dataset,setDataset]=useState<DatasetDefinition|null>(null);
  const [pending,setPending]=useState(false),[tilesLoading,setTilesLoading]=useState(false),[fatal,setFatal]=useState(false);
  const [error,setError]=useState(''),[localError,setLocalError]=useState(''),[localRetry,setLocalRetry]=useState(0);
  const [markers,setMarkers]=useState<RegionMarker[]>([]);
  const region=getRegion(p.selectedRegionId);

  async function load(definition:DatasetDefinition) {
    const request=++sequence.current;
    controller.current?.invalidatePending();setPending(true);setError('');
    try {
      const committed=await controller.current?.replaceDataset(definition);
      if(committed&&request===sequence.current)setDataset(definition);
    } catch(reason) { if(request===sequence.current)setError(reason instanceof Error?reason.message:'Could not load this dataset.'); }
    finally { if(request===sequence.current)setPending(false); }
  }
  useEffect(()=>{
    try {
      controller.current=new GlobeController(container.current!,status=>{setTilesLoading(status.loading);if(status.error)setError(status.error);},id=>onSelect.current(id),setMarkers,selection=>onGeology.current(selection),sample=>{if(environmentSelection.current)onEnvironment.current?.({...environmentSelection.current,sampleId:sample});});
    } catch {setFatal(true);setError('The globe could not start. Use a browser with WebGL enabled and reload this page.');}
    return()=>{sequence.current++;importSequence.current++;controller.current?.dispose();controller.current=null;};
  },[]);
  useEffect(()=>{void load(p.basemap);},[p.basemap]);
  useEffect(()=>{controller.current?.setVisible(p.visible);},[p.visible]);
  useEffect(()=>{controller.current?.setOpacity(p.opacity);},[p.opacity]);
  useEffect(()=>{if(region)controller.current?.focusRegion(region);else controller.current?.home();},[region]);
  useEffect(()=>{
    let active=true;setLocalError('');
    void controller.current?.setLocalData(p.data).catch(()=>{if(active)setLocalError('Regional overlays could not load. Check the local assets and retry.');});
    return()=>{active=false;};
  },[p.data,localRetry]);
  useEffect(()=>{controller.current?.setOverlays(p.overlays);},[p.overlays]);
  useEffect(()=>{controller.current?.setRoute(p.route);},[p.route,p.data]);
  useEffect(()=>{controller.current?.setGeology(p.selectedRegionId,p.geology,p.geologySelection);},[p.selectedRegionId,p.geology,p.geologySelection]);
  useEffect(()=>{const layer=p.environmentCatalog&&p.environmentSelection?availableLayers(p.environmentCatalog,p.environmentSelection).find(l=>l.id===p.environmentSelection!.layerId):undefined;void controller.current?.setEnvironment(layer,p.environmentSelection?.opacity??.65).catch(()=>setError('Environmental overlay could not render. Choose another layer and retry.'));},[p.environmentCatalog,p.environmentSelection]);
  const loading=pending||tilesLoading;
  const weather=p.data&&historicalAt(p.data.environment,p.conditionsHour);
  const selectRegion=(id:RegionId)=>{if(id===p.selectedRegionId)controller.current?.focusRegion(getRegion(id)!);else p.onRegionChange(id);};

  return <main className="explorer">
    <aside className="sidebar" aria-label="Dataset controls">
      <header className="brand"><span className="brand-mark" aria-hidden="true">◉</span><div>MARTIAN MAP<span>STATION COMPUTER</span></div><span className="version">REAL MARS</span></header>
      <section className="intro"><div className="eyebrow">PLANETARY ATLAS</div><h1>See the bigger <br/>picture.</h1><p>Choose a region. Discover its data. Find your way across Mars.</p></section>
      <div className="demo-entry"><span className="data-kind">CURATED SCIENCE EXCURSION</span><h3>Read a landscape. Choose a question.</h3><p>Explore Yellowknife Bay’s geological context, compare routes and enter the surface view.</p><button className="primary full" onClick={p.onDemo}>Start guided Gale example →</button><a href="?demo=yellowknife">Direct example link ↗</a></div><section className="region-section" aria-label="Regions">
        <div className="section-label">01 / CHOOSE A REGION <span className="tag">2 REGIONS</span></div>
        <div className="region-list">{REGIONS.map(r=><button key={r.id} className="region-card" aria-pressed={r.id===p.selectedRegionId} onClick={()=>selectRegion(r.id)}><strong>{r.shortName}<span>↗</span></strong><small>{canPlan(r)?'Explore · Plan · Walk':'Orbital exploration'}</small></button>)}</div>
        {!region&&<p className="caption">Select a marker on the globe or a region above to get started.</p>}
      </section>
      {region&&<section className="region-details" aria-label="Selected region">
        <div className="eyebrow">SELECTED REGION</div><h2>{region.name}</h2><p className="description">{region.description}</p>
        <p className="region-coordinates">{Math.abs(region.center.latitude).toFixed(4)}° {region.center.latitude<0?'S':'N'} · {region.center.longitude.toFixed(4)}° E</p>
        {canPlan(region)?<><span className="capability">2 × 2 KM PREPARED / 5 M TERRAIN GRID</span><button className="primary full" disabled={!p.data} onClick={p.onExplore}>{p.data?'Open astronaut tablet →':p.dataError?'Regional terrain unavailable':'Loading regional terrain…'}</button><p className="caption">Plan and walk inside the outlined prepared area.</p></>:<div className="coverage-note"><strong>Orbital exploration available</strong><p>Local numeric terrain is not prepared here. Excursion planning and walking are available in Gale · Bradbury.</p></div>}
        <details className="region-source"><summary>Location and coverage</summary><p>{region.locationNote}</p><a href={region.sourceUrl} target="_blank" rel="noreferrer">Location source ↗</a></details>
      </section>}
      {region&&<GeologyPanel regionId={region.id} settings={p.geology} selection={p.geologySelection} onSettings={p.onGeologySettings} onSelect={p.onGeologySelect} onContext={()=>controller.current?.focusGeology(region.id)}/>}
      {p.environmentCatalog&&p.environmentSelection&&p.onEnvironmentChange&&<EnvironmentControls catalog={p.environmentCatalog} selection={p.environmentSelection} onChange={p.onEnvironmentChange} prefix="Atlas "/>}
      <section className="dataset-section">
        <div className="section-label">02 / GLOBAL BASEMAP</div>
        <label className="basemap-label">Dataset<select aria-label="Global basemap" disabled={fatal} value={p.basemap.id} onChange={e=>{importSequence.current++;p.onBasemapChange(BASEMAPS.find(b=>b.id===e.target.value)!);}}>{BASEMAPS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}{!BASEMAPS.some(b=>b.id===p.basemap.id)&&<option value={p.basemap.id}>{p.basemap.name} (imported)</option>}</select></label>
        <h2>{dataset?.name??'Preparing the globe'}</h2><p className="description">{dataset?.description??'Loading the initial surface layer…'}</p>
        <div className="status" role="status" aria-label="Layer status"><span className={`status-dot ${error?'warning':loading?'busy':''}`}/>{error?'Needs attention':loading?'Loading surface tiles':p.visible?'Layer active':'Layer hidden'}</div>
        <div className="layer-controls"><label className="visibility"><span>Show basemap</span><input aria-label="Show basemap" type="checkbox" role="switch" checked={p.visible} disabled={fatal} onChange={e=>p.onVisibleChange(e.target.checked)}/></label><label className="opacity"><span>Opacity <output>{Math.round(p.opacity*100)}%</output></span><input aria-label="Basemap opacity" type="range" min="0" max="100" value={p.opacity*100} disabled={fatal} onChange={e=>p.onOpacityChange(Number(e.target.value)/100)}/></label></div>
        {error&&<div className="error" role="alert"><p>{error}</p>{!fatal&&<button onClick={()=>void load(p.basemap)}>Retry loading ↻</button>}</div>}
        {dataset&&<details className="basemap-notes"><summary>Basemap source and legend</summary><span className="data-kind">{dataset.dataKind==='derived'?'DERIVED DISPLAY LAYER':dataset.dataKind==='observation'?'PROCESSED ORBITAL OBSERVATIONS':'SOURCE-SUPPLIED DISPLAY LAYER · CLASSIFICATION UNKNOWN'}</span><p>{dataset.legend}</p><p>Quantity: display color/brightness, not a numeric terrain or environmental field.</p><p>Coverage: {dataset.bounds.join(', ')}° (west, south, east, north).</p><p>{dataset.acquisitionNote??'Acquisition time not provided in this definition. See the source metadata.'}</p><p>{dataset.resolution}</p><p>Mars · east-positive longitude · {dataset.reference}</p><a href={dataset.sourceUrl} target="_blank" rel="noreferrer">{dataset.source} ↗</a></details>}
        <details className="advanced-import"><summary>Advanced: import a dataset</summary><label className={`import-button ${fatal?'disabled':''}`}>＋ Load dataset JSON<input aria-label="Load dataset JSON" type="file" accept=".json,application/json" disabled={fatal} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const generation=++importSequence.current;let value:unknown;try{value=JSON.parse(await file.text());}catch{if(generation!==importSequence.current)return;setError('Could not read this manifest. Choose a valid JSON dataset file.');return;}if(generation!==importSequence.current)return;try{p.onBasemapChange(parseDataset(value));}catch(reason){setError((reason as Error).message);}}}/></label><div className="import-note">Replace the basemap without moving the camera.<a href="/datasets/mola.json" download="dataset-example.json">Get the example manifest ↗</a></div></details>
      </section>
      {region&&<section className="regional-section" aria-label="Regional data">
        <div className="section-label">03 / REGIONAL DATA</div>
        {region.terrain?<><p className="caption">Overlays apply only inside the prepared Gale footprint.</p><RegionalLayers prefix="Explore " settings={p.overlays} onChange={p.onOverlayChange}/>{localError&&<p className="error" role="alert">{localError} <button onClick={()=>setLocalRetry(n=>n+1)}>Retry overlays</button></p>}<label className="check"><input type="checkbox" checked={p.conditionsVisible} onChange={e=>p.onConditionsChange(e.target.checked)}/>Historical conditions</label>{p.conditionsVisible&&p.data&&<div className="observation-card"><strong>Curiosity · Sol {p.data.environment.sol}</strong><p>REMS {lmstLabel(p.conditionsHour)} temperature: {weather?.temperatureK?.toFixed(1)??'Unavailable'} K<br/>Pressure: {weather?.pressurePa?.toFixed(1)??'Unavailable'} Pa<br/>Wind: {weather?.windMps==null?'Unavailable':`${weather.windMps} m/s`}<br/>RAD: {p.data.environment.radiation.rateMicroGyH.toFixed(2)} µGy/h detector-dose proxy</p><p>Historical site observations, not a spatial forecast or astronaut dose estimate.</p><a href={p.data.environment.weatherSource} target="_blank" rel="noreferrer">REMS source ↗</a> · <a href={p.data.environment.radiation.source} target="_blank" rel="noreferrer">RAD source ↗</a></div>}</>:<p className="caption">Use Viking for color, MOLA for relief context or CTX for orbital imagery. Local elevation, slope, and environmental observations are not bundled for Jezero.</p>}
      </section>}
      <footer className="sidebar-footer">REAL DATA. ROOM TO EXPLORE.</footer>
    </aside>
    <section className="map-panel" aria-label="Interactive Mars globe">
      <div ref={container} className="globe"/>
      <div className="region-markers">{markers.map(m=><button key={m.id} className="region-marker" aria-label={`Explore ${getRegion(m.id)!.shortName} on map`} aria-pressed={m.id===p.selectedRegionId} style={{left:m.x,top:m.y}} onClick={()=>selectRegion(m.id)}><span className="marker-dot"/>{getRegion(m.id)!.shortName}</button>)}</div>
      <div className="map-header"><span className="map-caption">＋ MARS / {region?region.shortName.toUpperCase():'CHOOSE A REGION'}</span><button className="home-button" onClick={()=>{p.onRegionChange(undefined);controller.current?.home();}} disabled={fatal} aria-label="Reset globe view">Global view ↗</button></div>
      {region&&<div className="map-region-context"><span className="eyebrow">{canPlan(region)?'PREPARED EXCURSION REGION':'ORBITAL EXPLORATION'}</span><strong>{region.shortName}</strong><span>{region.terrain?'Outlined area: real terrain for planning and walking.':'Choose a basemap to inspect this region.'}</span>{canPlan(region)&&<button className="primary" disabled={!p.data} onClick={p.onExplore}>Open astronaut tablet →</button>}</div>}
      <div className="map-guide"><span>DRAG TO ROTATE</span><i/><span>SCROLL TO ZOOM</span><i/><span>SELECT A REGION TO EXPLORE</span></div>
      <div className="map-footnote">Global context is a sphere.<br/>Gale relief is relative to the patch minimum.</div>
    </section>
  </main>;
}
