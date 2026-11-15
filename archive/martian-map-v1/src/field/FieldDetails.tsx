import { localToGeo } from '../mission/data';
import { lmstLabel } from '../mission/conditions';
import { KINDS, anchor, effectLabel, metaFor, unitFor, type FieldRecord } from './model';
export default function FieldDetails({record}:{record:FieldRecord}){
  const point=anchor(record),[lon,lat]=localToGeo(metaFor(record.regionId),point);
  return <div className="field-detail" aria-label="Field record details"><span className="data-kind">USER FIELD LAYER / {KINDS[record.kind].toUpperCase()}</span><h3>{record.title}</h3>{record.description&&<p>{record.description}</p>}
    {record.value!==undefined&&<strong className="field-reading">{record.value} {unitFor(record.kind)}</strong>}
    <p className="field-effect">{effectLabel(record)}</p><dl><dt>Source / attribution</dt><dd>{record.source}</dd><dt>Uncertainty / limitations</dt><dd>{record.uncertainty}</dd><dt>Anchor location</dt><dd>{lat.toFixed(6)}° N / {lon.toFixed(6)}° E<br/>E {point.x.toFixed(1)} · N {point.y.toFixed(1)} m{record.points.length>1?` · ${record.points.length} vertices; anchor = first vertex`:''}</dd>{record.radiusM!==undefined&&<><dt>Declared extent</dt><dd>{record.radiusM} m radius · circular footprint</dd></>}
    <dt>Observation UTC</dt><dd>{record.observedAt}</dd><dt>Simulated context</dt><dd>Gale · {record.regionId==='gale-boxwork'?'Boxwork':'Bradbury'} · Sol {record.context.sol} · {lmstLabel(record.context.lmstHour)} · {record.context.elapsedS.toFixed(1)} s elapsed<br/>{record.context.positionSource.replaceAll('-',' ')}</dd><dt>Created / updated UTC</dt><dd>{record.createdAt}<br/>{record.updatedAt}</dd>{record.importedFrom&&<><dt>Imported from</dt><dd>{record.importedFrom}<br/>{record.importedAt}</dd></>}</dl>
    <p className="caption">User-supplied evidence or interpretation. Published source layers remain intact. Point readings are not spatial fields or forecasts.</p>
  </div>;
}
