import { availableLayers, layerRange, type EnvironmentCatalog, type EnvironmentSelection } from './model';

export default function EnvironmentControls({catalog,selection,onChange,prefix=''}:{catalog:EnvironmentCatalog;selection:EnvironmentSelection;onChange:(s:EnvironmentSelection)=>void;prefix?:string}){
  const layers=availableLayers(catalog,selection),layer=layers.find(l=>l.id===selection.layerId),range=layer&&layerRange(layer),sample=layer?.samples.find(s=>s.id===selection.sampleId);
  return <section className="environment-controls" aria-label={`${prefix}Environmental layers`}>
    <span className="eyebrow">NUMERIC ENVIRONMENTAL DATA</span>
    <label>Layer<select aria-label={`${prefix}Environmental layer`} value={selection.layerId} onChange={e=>onChange({...selection,layerId:e.target.value,sampleId:undefined})}><option value="none">No environmental overlay</option>{layers.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    {layer&&<><label>Overlay opacity<input aria-label={`${prefix}Environmental opacity`} type="range" min="0" max="1" step=".05" value={selection.opacity} onChange={e=>onChange({...selection,opacity:Number(e.target.value)})}/></label>
      <div className="environment-legend"><i/><span>{range?.[0].toPrecision(3)} → {range?.[1].toPrecision(3)} {layer.unit}</span></div>
      <span className="data-kind">{layer.kind==='forecast'?'SIMULATED FORECAST':'ARCHIVED OBSERVATIONS'}</span><p>{layer.period}</p><p>{layer.note}</p>
      <details><summary>Coverage and source</summary><p>{layer.resolution}</p><p>{layer.coordinateNote}</p><p>{layer.timeBasis}</p><p>{layer.samples.filter(s=>s.value!==null).length} numeric samples; {layer.samples.filter(s=>s.value===null).length} unavailable/below-background. Point size is a visual marker, not measured extent.</p><a href={layer.sourceUrl} target="_blank" rel="noreferrer">{layer.instrument} data ↗</a> · <a href={layer.labelUrl} target="_blank" rel="noreferrer">Metadata ↗</a></details>
      {sample&&<div className="environment-inspection" aria-label={`${prefix}Environmental sample`}><strong>{sample.value===null?'Unknown / below background':`${sample.value.toPrecision(5)} ${layer.unit}`}</strong>{sample.error!=null&&<span>Source uncertainty: {sample.error.toPrecision(3)} {layer.unit}</span>}<span>{sample.lat.toFixed(4)}° N · {sample.lon.toFixed(4)}° E</span>{sample.bounds&&<span>Bin bounds: {sample.bounds.join(', ')}°</span>}{sample.utc&&<time>{sample.utc}</time>}{sample.localSolarHour!=null&&<span>Source LTST: {sample.localSolarHour.toFixed(2)} h</span>}<p>{sample.quality}</p><a href={sample.sourceUrl??layer.sourceUrl} target="_blank" rel="noreferrer">Sample source ↗</a></div>}
    </>}
  </section>;
}
