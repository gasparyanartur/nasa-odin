import manifest from '../../public/gale/manifest.json';
import { geoToLocal, localToGeo, type Exclusion, type Meta, type Point } from '../mission/data';
export const FIELD_KEY='martian-map.field-data.v1';
export const KINDS={note:'Geological note',unit:'Geological unit interpretation',contact:'Geological contact interpretation',obstacle:'Circular obstacle',temperature:'Temperature reading',radiation:'Radiation detector reading'} as const;
export type FieldKind=keyof typeof KINDS;
export interface FieldRecord {
  id:string; regionId:'gale-bradbury'; kind:FieldKind; title:string; description:string; source:string; uncertainty:string;
  points:Point[]; visible:boolean; restrictTravel:boolean; radiusM?:number; value?:number;
  createdAt:string; updatedAt:string; observedAt:string;
  context:{sol:number;lmstHour:number;elapsedS:number;positionSource:'simulated-pose'|'map-selection'|'manual-coordinates'};
  importedFrom?:string; importedAt?:string;
}
export const fieldMeta:Meta={...manifest,id:'gale-bradbury-v1',bounds:manifest.bounds as [number,number,number,number]};
export const unitFor=(kind:FieldKind)=>kind==='temperature'?'K':kind==='radiation'?'µGy/h':undefined;
export const colorFor=(kind:FieldKind)=>kind==='obstacle'?'#ffaf85':kind==='temperature'?'#ffcf83':kind==='radiation'?'#dcb2ff':'#a7e6e4';
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Expected an object.');return v as Record<string,unknown>;};
const finite=(v:unknown,min:number,max:number,name:string)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${name} must be between ${min} and ${max}.`);return v;};
const string=(v:unknown,max:number,name:string,empty=false)=>{if(typeof v!=='string'||v.length>max||(!empty&&!v.trim()))throw new Error(`Provide ${name} (${max} characters maximum).`);return v;};
const flag=(v:unknown)=>{if(typeof v!=='boolean')throw new Error('Visibility and restriction must be booleans.');return v;};
const date=(v:unknown)=>{const text=string(v,40,'a UTC timestamp');if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(text)||!Number.isFinite(Date.parse(text)))throw new Error('Timestamps must be valid UTC ISO dates ending in Z.');if(new Date(text).toISOString().slice(0,19)!==text.slice(0,19))throw new Error('Invalid calendar date.');return text;};
function cross(a:Point,b:Point,c:Point){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function intersects(a:Point,b:Point,c:Point,d:Point){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  const on=(p:Point,q:Point,r:Point)=>Math.abs(cross(p,q,r))<1e-7&&r.x>=Math.min(p.x,q.x)-1e-7&&r.x<=Math.max(p.x,q.x)+1e-7&&r.y>=Math.min(p.y,q.y)-1e-7&&r.y<=Math.max(p.y,q.y)+1e-7;
  return (abC*abD<0&&cdA*cdB<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function validateRecord(value:unknown):FieldRecord {
  const r=object(value),kind=r.kind as FieldKind;if(!Object.hasOwn(KINDS,kind))throw new Error('Unsupported field record type.');
  const id=string(r.id,80,'a record ID');if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Record IDs use letters, digits, underscores or hyphens.');
  if(r.regionId!=='gale-bradbury')throw new Error('Field data currently supports the prepared Gale region only.');
  if(!Array.isArray(r.points)||r.points.length>100)throw new Error('Geometry requires at most 100 vertices.');
  const half=fieldMeta.extentM/2,points=r.points.map(p=>{const q=object(p);return{x:finite(q.x,-half,half,'Easting'),y:finite(q.y,-half,half,'Northing')};});
  const min=kind==='unit'?3:kind==='contact'?2:1;
  if(points.length<min||(!['unit','contact'].includes(kind)&&points.length!==1))throw new Error(`${KINDS[kind]} requires ${min}${min>1?' or more':''} point${min>1?'s':''}.`);
  for(let i=1;i<points.length;i++)if(Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)<.01)throw new Error('Consecutive vertices must be distinct.');
  if(kind==='unit'){
    if(points.some((p,i)=>points.some((q,j)=>j>i&&Math.hypot(p.x-q.x,p.y-q.y)<.01)))throw new Error('Polygon vertices must be distinct; the closing edge is automatic.');
    const area=points.reduce((sum,p,i)=>{const n=points[(i+1)%points.length];return sum+p.x*n.y-n.x*p.y;},0)/2;
    if(Math.abs(area)<1)throw new Error('A geological polygon must enclose at least 1 m².');
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(j!==i+1&&!(i===0&&j===points.length-1)&&intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))throw new Error('Polygon edges must not cross or touch themselves.');
  }
  const restrictTravel=flag(r.restrictTravel);if(restrictTravel&&kind!=='obstacle')throw new Error('Only circular obstacles can restrict travel.');
  const context=object(r.context),positionSource=context.positionSource as FieldRecord['context']['positionSource'];
  if(!['simulated-pose','map-selection','manual-coordinates'].includes(positionSource))throw new Error('Provide coordinate provenance.');
  if(!Number.isInteger(context.sol))throw new Error('Scenario sol must be an integer.');
  const record:FieldRecord={id,regionId:'gale-bradbury',kind,title:string(r.title,100,'a title'),description:string(r.description,4000,'a description',true),source:string(r.source,300,'a source / attribution'),uncertainty:string(r.uncertainty,1000,'uncertainty / limitations'),points,visible:flag(r.visible),restrictTravel,createdAt:date(r.createdAt),updatedAt:date(r.updatedAt),observedAt:date(r.observedAt),context:{sol:finite(context.sol,0,100000,'Scenario sol'),lmstHour:finite(context.lmstHour,0,23.999999,'Scenario LMST hour'),elapsedS:finite(context.elapsedS,0,1000000,'Simulated elapsed seconds'),positionSource}};
  if(kind==='obstacle')record.radiusM=finite(r.radiusM,5,500,'Obstacle radius (m)');
  if(kind==='temperature'||kind==='radiation')record.value=finite(r.value,0,kind==='temperature'?1000:1000000,`Reading (${unitFor(kind)})`);
  if(r.importedFrom!==undefined)record.importedFrom=string(r.importedFrom,200,'an import filename');
  if(r.importedAt!==undefined)record.importedAt=date(r.importedAt);
  return record;
}
export function validateRecords(value:unknown):FieldRecord[]{
  if(!Array.isArray(value)||value.length>100)throw new Error('A field layer supports at most 100 records.');
  const records=value.map(validateRecord);if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('Duplicate field record IDs.');
  if(fieldExclusions(records).length>30)throw new Error('At most 30 field restrictions can be active.');return records;
}
export function fieldExclusions(records:FieldRecord[]):Exclusion[]{return records.filter(r=>r.kind==='obstacle'&&r.restrictTravel).map(r=>({...r.points[0],radius:r.radiusM!}));}
export function restrictionKey(records:FieldRecord[]){return JSON.stringify(fieldExclusions(records).sort((a,b)=>a.x-b.x||a.y-b.y||a.radius-b.radius));}
export function anchor(r:FieldRecord):Point {return r.points[0];}
export function effectLabel(r:FieldRecord){return r.kind==='obstacle'?(r.restrictTravel?'Declared restriction · changes routes and walking':'Obstacle annotation · no travel restriction'):r.kind==='temperature'||r.kind==='radiation'?'Point reading only · does not change scenario or exposure':'User geological interpretation · visual annotation only';}
export function exportFields(records:FieldRecord[]){
  return {type:'FeatureCollection',schema:'martian-map-field-data',version:1,planet:'Mars',reference:'EPSG:104905',features:records.map(r=>{
    const {points,...properties}=r,coordinates=points.map(p=>localToGeo(fieldMeta,p));
    const geometry=r.kind==='unit'?{type:'Polygon',coordinates:[[...coordinates,coordinates[0]]]}:r.kind==='contact'?{type:'LineString',coordinates}:{type:'Point',coordinates:coordinates[0]};
    return {type:'Feature',id:r.id,geometry,properties:{...properties,units:unitFor(r.kind)}};
  })};
}
export function importFields(value:unknown):FieldRecord[]{
  const c=object(value);if(c.type!=='FeatureCollection'||c.schema!=='martian-map-field-data'||c.version!==1||c.planet!=='Mars'||c.reference!=='EPSG:104905')throw new Error('Choose a Martian Map v1 Mars GeoJSON file (EPSG:104905), not Earth GeoJSON.');
  if(!Array.isArray(c.features)||c.features.length>100)throw new Error('Import at most 100 features.');
  return validateRecords(c.features.map(feature=>{
    const f=object(feature),p=object(f.properties),g=object(f.geometry);if(f.type!=='Feature'||f.id!==p.id)throw new Error('Feature and record IDs must agree.');
    const kind=p.kind,expected=kind==='unit'?'Polygon':kind==='contact'?'LineString':'Point';if(g.type!==expected)throw new Error('Geometry does not match the field record type.');
    let raw:unknown=g.coordinates;
    if(g.type==='Point')raw=[raw];
    if(g.type==='Polygon'){
      if(!Array.isArray(raw)||raw.length!==1||!Array.isArray(raw[0]))throw new Error('Geological polygons require one closed outer ring; holes are unsupported.');
      const ring=raw[0];if(ring.length<4||JSON.stringify(ring[0])!==JSON.stringify(ring[ring.length-1]))throw new Error('Polygon rings must be closed.');raw=ring.slice(0,-1);
    }
    if(!Array.isArray(raw)||raw.length>100)throw new Error('Invalid geometry coordinates.');
    const points=raw.map(q=>{if(!Array.isArray(q)||q.length!==2)throw new Error('Coordinates must be east-positive longitude / latitude pairs.');const lon=finite(q[0],-180,180,'Longitude'),lat=finite(q[1],-90,90,'Latitude');const local=geoToLocal(fieldMeta,lon,lat);return{x:Math.round(local.x*1e6)/1e6,y:Math.round(local.y*1e6)/1e6};});
    if(p.units!==unitFor(kind as FieldKind))throw new Error('Reading units do not match their record type.');
    return {...p,points};
  }));
}
export function mergeFields(current:FieldRecord[],incoming:FieldRecord[]){const records=new Map(current.map(r=>[r.id,r]));incoming.forEach(r=>records.set(r.id,r));return validateRecords([...records.values()]);}
export function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
