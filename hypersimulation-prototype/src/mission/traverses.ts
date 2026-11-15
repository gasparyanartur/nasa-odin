import type { Point, Pose, Settings } from './data';

export const TRAVERSE_KEY='martian-map.traverses.v1';
export const MAX_TRAVERSES=20, MAX_SAMPLES=12000;
export interface Traverse {
  id:string; name:string; savedAt:string; datasetId:string; version:number;
  regionId:string; settings:Settings; habitat:Point; destination:Point;
  plannedMode?:string; reached:boolean; samples:Pose[];
}
export function traceDistance(points:Point[]) {
  return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
}
export function traceDuration(points:Pose[]) {return points.length?points[points.length-1].elapsed-points[0].elapsed:0;}
export function appendSample(points:Pose[],pose:Pose,force=false):Pose[] {
  const last=points.at(-1);
  if(last&&pose.elapsed<last.elapsed)return points;
  if(last&&pose.elapsed===last.elapsed&&pose.x===last.x&&pose.y===last.y)return points;
  if(last&&!force&&Math.hypot(pose.x-last.x,pose.y-last.y)<1&&pose.elapsed-last.elapsed<5)return points;
  return [...points,{...pose}];
}
function finite(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v);}
function point(v:any){return v&&finite(v.x)&&finite(v.y)&&Math.abs(v.x)<=100000&&Math.abs(v.y)<=100000;}
export function parseTraverses(raw:string):Traverse[] {
  const payload=JSON.parse(raw);
  if(payload?.schema!==1||!Array.isArray(payload.records)||payload.records.length>MAX_TRAVERSES)throw new Error('Unsupported traverse history.');
  const ids=new Set<string>();
  for(const r of payload.records){
    if(!r||typeof r.id!=='string'||ids.has(r.id)||typeof r.name!=='string'||r.name.length>100||typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt))||typeof r.datasetId!=='string'||typeof r.regionId!=='string'||!Number.isInteger(r.version)||typeof r.reached!=='boolean'||!point(r.habitat)||!point(r.destination)||!r.settings||!Array.isArray(r.settings.exclusions)||!Array.isArray(r.samples)||r.samples.length<2||r.samples.length>MAX_SAMPLES)throw new Error('Invalid traverse history.');
    ids.add(r.id);
    let previous=-1;
    for(const p of r.samples){if(!point(p)||!finite(p.heading)||!finite(p.elapsed)||p.elapsed<previous||p.elapsed<0)throw new Error('Invalid traverse samples.');previous=p.elapsed;}
    for(const key of ['speedMps','maxSlopeDeg','maxDurationMin','doseRateMicroGyH','maxDoseMicroGy','temperatureK','minTemperatureK','windMps','maxWindMps'])if(!finite(r.settings[key]))throw new Error('Invalid traverse assumptions.');
  }
  return payload.records;
}
export function loadTraverses(storage:Pick<Storage,'getItem'>){
  try{const raw=storage.getItem(TRAVERSE_KEY);return {records:raw?parseTraverses(raw):[],error:'',unread:false};}
  catch{return {records:[] as Traverse[],error:'Saved traverses could not be read. The original storage is preserved. Download a backup or explicitly replace it before saving.',unread:true};}
}
export function writeTraverses(storage:Pick<Storage,'setItem'>,records:Traverse[]){
  const raw=JSON.stringify({schema:1,records});parseTraverses(raw);storage.setItem(TRAVERSE_KEY,raw);
}
