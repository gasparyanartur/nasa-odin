import {useState} from 'react';
import InfoMark from '../design/InfoMark';
import BlockedButton from '../design/Blocked';
import type {TerrainData} from './data';
import {traceDistance,traceDuration} from './traverses';
import type {useTraverses} from './useTraverses';
import type {usePreviousPaths} from './usePreviousPaths';
import {recordedPaths,PATH_COLORS,type PreviousPath} from './previous-paths';
const KIND={rover:'Historical rover path',example:'Prepared plan, not walked',walk:'Recorded walk'} as const;
const length=(m:number)=>m>=1000?`${(m/1000).toFixed(2)} km`:`${Math.round(m)} m`;
/** One short line per path with its switch; the description, source and saved context sit behind each path's info mark. */
export default function TraverseHistory({store,library,data,onSave}:{store:ReturnType<typeof useTraverses>;library:ReturnType<typeof usePreviousPaths>;data:TerrainData;onSave:(name:string)=>void}){
  const [name,setName]=useState('');
  const paths=[...library.paths,...recordedPaths(store.records,data)],shown=paths.filter(library.show);
  const time=(p:PreviousPath)=>p.elapsedS!==undefined?`${(p.elapsedS/60).toFixed(2)} min walked`:p.estimatedDurationS!==undefined?`${(p.estimatedDurationS/60).toFixed(1)} min estimated`:'Travel time unknown';
  return <section className="traverse-history" aria-label="Previous paths">
    {library.error&&<p role="alert">{library.error} <button onClick={library.retry}>Retry previous paths</button></p>}
    <ul className="path-list">{paths.map((p,i)=><li className={`saved-traverse path-${p.kind}`} key={p.id} data-path-id={p.id}>
      <label><input type="checkbox" aria-label={`Show path ${p.name}`} checked={library.show(p)} onChange={e=>library.toggle(p.id,e.target.checked)}/><i className="path-swatch" style={{background:PATH_COLORS[i%PATH_COLORS.length]}}/><strong>{p.name}</strong><span className="path-list__len">{length(traceDistance(p.points))}</span></label>
      <InfoMark title={p.name} does={<>{KIND[p.kind]}. {time(p)}. {p.description}</>} source={p.sourceUrl?<>{p.solRange?`Curiosity, Sol ${p.solRange[0]} to ${p.solRange[1]}. `:''}<a href={p.sourceUrl} target="_blank" rel="noreferrer">Published rover waypoint source ↗</a></>:p.walk?'Recorded in this browser.':undefined} coverage={p.walk?<>{new Date(p.walk.savedAt).toLocaleString()} · {p.walk.plannedMode??'free exploration'}. {p.datasetId} v{p.version}. Habitat E {p.walk.habitat.x.toFixed(0)} / N {p.walk.habitat.y.toFixed(0)}; destination E {p.walk.destination.x.toFixed(0)} / N {p.walk.destination.y.toFixed(0)} m. At save: {p.walk.settings.speedMps} m/s, {p.walk.settings.maxSlopeDeg}° slope, {p.walk.settings.conditionsMode??'manual'}, departure {p.walk.settings.departureHour??12}:00, {p.walk.settings.exclusions.length} restrictions.</>:undefined}/>
      {p.walk&&<button className="text-button path-list__delete" aria-label={`Delete traverse ${p.name}`} onClick={()=>{if(store.remove(p.id))library.toggle(p.id,false);}}>Delete</button>}
    </li>)}</ul>
    {shown.length===2&&<div className="traverse-comparison" role="status"><strong>{shown[1].name} minus {shown[0].name}</strong><p>{(traceDistance(shown[1].points)-traceDistance(shown[0].points)).toFixed(1)} m distance{shown.every(p=>p.kind==='walk')?` · ${(shown[1].elapsedS!-shown[0].elapsedS!).toFixed(1)} s walked`:''}</p></div>}
    <details className="route-more"><summary><span>Save this walk</span><small>{length(traceDistance(store.samples))} · {(traceDuration(store.samples)/60).toFixed(1)} min so far</small></summary>
      <label>Name<input aria-label="Traverse name" maxLength={100} placeholder="e.g. Ridge approach" value={name} onChange={e=>setName(e.target.value)}/></label>
      <BlockedButton className="secondary full" block={store.unread?{reason:'Your saved walks could not be read.',fix:{label:'Replace unread history',run:store.recover}}:traceDistance(store.samples)<.5?{reason:'Walk on the surface first, then save the walk here.'}:undefined} onClick={()=>onSave(name)}>Save executed traverse</BlockedButton>
      {store.notice&&<p role="status" className="caption">{store.notice}</p>}{store.limit&&<p role="alert">Recording limit reached. The trace ends at its last recorded sample. Save it, then restart to record another.</p>}{store.error&&<p role="alert">{store.error}</p>}
    </details>
    <div className="button-row path-list__actions"><button className="text-button" onClick={store.backup}>Download my walks</button>{store.unread&&<button onClick={store.recover}>Replace unread history</button>}<InfoMark title="Previous paths" does="Turn paths on to show them on the map and in the helmet, in their legend colour. Loading a path does not move your astronaut or change the guidance. Two paths shown together are compared." source="Historical and example paths come with this site. Your walks stay in this browser, 20 at most." coverage="Only paths for this terrain and version can be shown. Rover paths have no travel time."/></div>
    {store.records.some(r=>r.datasetId!==data.meta.id||r.version!==data.meta.version)&&<details className="route-more"><summary><span>Other sites</span><small>{store.records.filter(r=>r.datasetId!==data.meta.id||r.version!==data.meta.version).length} walks</small></summary>{store.records.filter(r=>r.datasetId!==data.meta.id||r.version!==data.meta.version).map(r=><article className="saved-traverse" key={r.id}><strong>{r.name}</strong><p>{r.datasetId} v{r.version}</p><button className="text-button" aria-label={`Delete archived traverse ${r.name}`} onClick={()=>store.remove(r.id)}>Delete</button></article>)}</details>}
  </section>;
}
