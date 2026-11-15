export interface ScalarSample {
  id:string; lon:number; lat:number; value:number|null; error?:number|null; rawValue?:number;
  bounds?:[number,number,number,number]; utc?:string; quality:string; sourceUrl?:string; localSolarHour?:number;
}
export interface ScalarLayer {
  id:string; name:string; quantity:string; unit:string; instrument:string; kind:'observation'|'forecast';
  geometry:'cells'|'points'; sourceUrl:string; labelUrl:string; period:string; timeBasis:string;
  resolution:string; note:string; coordinateNote:string; samples:ScalarSample[];
}
export interface HourRecord { sol:number; hour:number; temperature:number|null; radiation:number|null; temperatureSamples:number; radiationSamples:number; firstSclk:string|null; lastSclk:string|null }
export interface SolRecord { sol:number; lon:number; lat:number; waypointSol:number; weatherUrl:string; radiationUrl:string|null; records:HourRecord[] }
export interface Prediction { hour:number; value:number|null; low:number|null; high:number|null; trainingSamples:number }
export interface Validation { firstTestSol:number; lastTestSol:number; samples:number; mae:number|null; pairedSamples:number; pairedModelMae:number|null; persistenceMae:number|null }
export interface EnvironmentCatalog {
  schemaVersion:1; id:string; reference:string; layers:ScalarLayer[];
  history:{firstSol:number;lastSol:number;site:string;waypointSource:string;positionNote:string;timeNote:string;qualityNote:string;sols:SolRecord[]};
  forecast:{issueSol:number;targetSol:number;trainingSols:number[];method:string;spreadNote:string;temperature:Prediction[];radiation:Prediction[];validation:Record<'temperature'|'radiation',Validation>};
  sources:{url:string;sha256:string;bytes:number}[];
}
export interface EnvironmentSelection { layerId:string; opacity:number; sampleId?:string; sol:number; hour:number }
export const DEFAULT_ENVIRONMENT:EnvironmentSelection={layerId:'none',opacity:.65,sol:28,hour:12};

export function parseCatalog(input:unknown):EnvironmentCatalog {
  const data=input as EnvironmentCatalog;
  if(!data||data.schemaVersion!==1||!Array.isArray(data.layers)||!Array.isArray(data.history?.sols)||!data.forecast||!Array.isArray(data.sources))throw new Error('Unsupported environmental data package.');
  const ids=new Set<string>();
  for(const layer of data.layers){
    if(ids.has(layer.id)||!layer.name||!layer.unit||!layer.quantity||!['cells','points'].includes(layer.geometry)||!Array.isArray(layer.samples))throw new Error('Invalid environmental layer.');ids.add(layer.id);
    const samples=new Set<string>();
    for(const s of layer.samples){
      if(samples.has(s.id)||!Number.isFinite(s.lon)||s.lon< -180||s.lon>180||!Number.isFinite(s.lat)||Math.abs(s.lat)>90||s.value!==null&&!Number.isFinite(s.value)||s.error!=null&&(!Number.isFinite(s.error)||s.error<0))throw new Error('Invalid environmental sample.');
      if(s.bounds&&(!s.bounds.every(Number.isFinite)||s.bounds[0]>=s.bounds[2]||s.bounds[1]>=s.bounds[3]||s.bounds[0]< -180||s.bounds[2]>180||s.bounds[1]< -90||s.bounds[3]>90))throw new Error('Invalid environmental footprint.');samples.add(s.id);
    }
  }
  const sols=new Set<number>();
  for(const sol of data.history.sols){
    if(sols.has(sol.sol)||sol.records.length!==24)throw new Error('Invalid historical sol.');sols.add(sol.sol);
    sol.records.forEach((r,h)=>{if(r.sol!==sol.sol||r.hour!==h||[r.temperature,r.radiation].some(v=>v!==null&&!Number.isFinite(v)))throw new Error('Invalid historical hour.');});
  }
  if(data.forecast.targetSol!==data.forecast.issueSol+1||!Array.isArray(data.forecast.trainingSols)||data.forecast.trainingSols.some(s=>!Number.isFinite(s)||s>data.forecast.issueSol))throw new Error('Invalid forecast issuance.');
  for(const q of ['temperature','radiation'] as const){
    if(!Array.isArray(data.forecast[q])||data.forecast[q].length!==24||data.forecast[q].some((r,h)=>r.hour!==h||[r.value,r.low,r.high].some(v=>v!==null&&!Number.isFinite(v)))||!data.forecast.validation?.[q])throw new Error('Invalid forecast profile.');
  }
  return data;
}

export function selectedRecord(c:EnvironmentCatalog,s:EnvironmentSelection) {
  if(s.sol===c.forecast.targetSol)return {temperature:c.forecast.temperature[s.hour]?.value??null,radiation:c.forecast.radiation[s.hour]?.value??null,forecast:true};
  const r=c.history.sols.find(v=>v.sol===s.sol)?.records[s.hour];
  return {temperature:r?.temperature??null,radiation:r?.radiation??null,forecast:false};
}

export function availableLayers(c:EnvironmentCatalog,s:EnvironmentSelection):ScalarLayer[] {
  const forecast=s.sol===c.forecast.targetSol;
  const site=c.history.sols.find(v=>v.sol===(forecast?c.forecast.issueSol:s.sol));
  const record=selectedRecord(c,s);
  return [...c.layers,...(['temperature','radiation'] as const).map(q=>({
    id:`site-${q}`,name:q==='temperature'?'Air temperature · Curiosity site':'Radiation rate · Curiosity RAD',quantity:q==='temperature'?'air_temperature':'detector_absorbed_dose_rate',
    unit:q==='temperature'?'K':'µGy/h',instrument:q==='temperature'?'Curiosity REMS':'Curiosity RAD detector E',
    kind:forecast?'forecast' as const:'observation' as const,geometry:'points' as const,
    sourceUrl:(q==='temperature'?site?.weatherUrl:site?.radiationUrl)??c.history.waypointSource,
    labelUrl:c.history.waypointSource,period:`Sol ${s.sol}, ${String(s.hour).padStart(2,'0')}:00–${String(s.hour).padStart(2,'0')}:59`,
    timeBasis:forecast?`Simulated next-sol profile issued after Sol ${c.forecast.issueSol}`:c.history.timeNote,
    resolution:c.history.positionNote,
    note:forecast?'SIMULATED site scenario. No spatial prediction, shielding, solar-event warning or astronaut dosimetry.':q==='temperature'?'Historical near-surface air temperature at the rover site; not surface temperature or a spatial field.':'Historical absorbed detector dose rate; not terrain radioactivity or astronaut dose equivalent.',
    coordinateNote:site?`Context waypoint Sol ${site.waypointSol}; no per-reading location or spatial footprint supplied.`:'No site context available.',
    samples:site?[{id:`site-${q}`,lon:site.lon,lat:site.lat,value:record[q],quality:forecast?`${c.forecast.method} ${c.forecast.spreadNote}`:c.history.qualityNote}]:[],
  }))];
}

export function layerRange(layer:ScalarLayer):[number,number] {
  const values=layer.samples.flatMap(s=>s.value===null?[]:[s.value]);
  if(!values.length)return [0,1];return [Math.min(...values),Math.max(...values)];
}
export function colorAt(value:number,range:[number,number]) {
  const t=Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0]||1)));
  return `rgb(${Math.round(54+191*t)},${Math.round(165-82*t)},${Math.round(194-133*t)})`;
}
export function sampleAt(layer:ScalarLayer,lon:number,lat:number):ScalarSample|undefined {
  if(layer.geometry==='cells')return layer.samples.find(s=>s.bounds&&lon>=s.bounds[0]&&lon<s.bounds[2]&&lat>=s.bounds[1]&&lat<s.bounds[3]);
  return layer.samples.reduce<ScalarSample|undefined>((best,s)=>{
    const d=Math.hypot((s.lon-lon)*Math.cos(lat*Math.PI/180),s.lat-lat);
    if(d>.8)return best;
    return !best||d<Math.hypot((best.lon-lon)*Math.cos(lat*Math.PI/180),best.lat-lat)?s:best;
  },undefined);
}
