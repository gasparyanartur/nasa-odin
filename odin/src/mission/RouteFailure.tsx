import type { RouteDiagnostics, TerrainData } from './data';
import type { FieldRecord } from '../field/model';

export default function RouteFailure({diagnostics,data,manualCount,restrictions,onField}: {
  diagnostics:RouteDiagnostics; data:TerrainData; manualCount:number; restrictions:FieldRecord[]; onField:(id:string)=>void;
}) {
  const implicated=new Set(diagnostics.endpoints.flatMap(e=>e.exclusionIndices));
  return <div className="route-failure" role="alert" aria-label="Why this route is unavailable">
    <strong>Route unavailable</strong>
    <p>{diagnostics.code==='blocked_endpoints'?'An endpoint cannot be used under the current constraints.':diagnostics.code==='same_cell'?'The endpoints occupy the same planning cell.':'Both endpoints are usable, but no permitted corridor connects them.'}</p>
    {diagnostics.endpoints.map(e=><div className="route-failure-endpoint" key={e.label}>
      <b>{e.label} · {e.reasons.length?'Blocked':'Usable'}</b>
      <span>E {e.x.toFixed(0)} / N {e.y.toFixed(0)} m{e.slopeDeg!==undefined?` · footprint slope ${e.slopeDeg.toFixed(1)}°`:''}</span>
      {e.reasons.length>0&&<ul>{e.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>}
    </div>)}
    {diagnostics.notes.map(note=><p key={note}>{note}</p>)}
    {diagnostics.activeExclusionCount>0&&<div><b>Active exclusions: {diagnostics.activeExclusionCount}</b>
      <ul>{Array.from({length:manualCount},(_,i)=><li key={`manual-${i}`}>#{i+1} Manual exclusion{implicated.has(i)?', covers an endpoint':''}. Use Clear exclusions to remove manual areas.</li>)}
      {restrictions.map((record,i)=><li key={record.id}>#{manualCount+i+1} Saved field restriction: <button className="text-button" onClick={()=>onField(record.id)}>{record.title}</button>{implicated.has(manualCount+i)?', covers an endpoint':''}{!record.visible?' (annotation hidden; restriction active)':''}.</li>)}</ul>
    </div>}
    <details><summary>How terrain is checked</summary><p>{diagnostics.stepM} m planning grid · slope limit {diagnostics.slopeLimitDeg}°. Slopes are checked across the walking interpolation footprint, so nearby terrain can block an endpoint. Exclusions include a {(diagnostics.stepM/Math.sqrt(2)).toFixed(1)} m cell margin.</p><p>{data.meta.slopeDefinition}</p><p>Environmental limits are evaluated after a path is found; they do not cause this terrain rejection.</p></details>
    <p>{diagnostics.code==='same_cell'?'Choose endpoints in different planning cells.':diagnostics.code==='disconnected'?'Choose endpoints in the same connected area or review the stated constraints.':'Move a blocked endpoint or review the stated constraint.'} Compare again after editing. Constraints stay in effect until you edit them.</p>
  </div>;
}
