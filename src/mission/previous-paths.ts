import type {Point,TerrainData} from './data';
import type {Traverse} from './traverses';
export interface PreviousPath {
  id:string;name:string;kind:'walk'|'rover'|'example';datasetId:string;version:number;regionId:string;
  points:Point[];description:string;sourceUrl?:string;solRange?:[number,number];defaultVisible?:boolean;
  elapsedS?:number;estimatedDurationS?:number;walk?:Traverse;
}
export function parsePreviousPaths(value:unknown,data:Pick<TerrainData,'meta'>):PreviousPath[]{
  const payload=value as {schema?:unknown;paths?:PreviousPath[]};
  if(payload?.schema!==1||!Array.isArray(payload.paths)||payload.paths.length>20)throw new Error('Unsupported previous-path library.');
  const ids=new Set<string>();
  for(const p of payload.paths){
    if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!['rover','example'].includes(p.kind)||p.datasetId!==data.meta.id||p.version!==data.meta.version||p.regionId!==data.meta.regionId||typeof p.description!=='string'||!Array.isArray(p.points)||p.points.length<2||p.points.length>12000||p.points.some(q=>!q||!Number.isFinite(q.x)||!Number.isFinite(q.y)||Math.abs(q.x)>data.meta.extentM/2||Math.abs(q.y)>data.meta.extentM/2)||p.elapsedS!==undefined||p.kind==='rover'&&p.estimatedDurationS!==undefined||p.estimatedDurationS!==undefined&&(!Number.isFinite(p.estimatedDurationS)||p.estimatedDurationS<0))throw new Error('Previous path does not match the terrain or its provenance.');
    ids.add(p.id);
  }
  return payload.paths;
}
export function recordedPaths(records:Traverse[],data:TerrainData):PreviousPath[]{
  return records.filter(r=>r.datasetId===data.meta.id&&r.version===data.meta.version).map(r=>({id:r.id,name:r.name,kind:'walk',datasetId:r.datasetId,version:r.version,regionId:r.regionId,points:r.samples,description:r.reached?'Destination reached':'Partial / free walk',elapsedS:r.samples.at(-1)!.elapsed-r.samples[0].elapsed,walk:r}));
}
export const PATH_COLORS=['#d6aeff','#95e979','#b9dad7','#f6bc88','#8fbaff'];
