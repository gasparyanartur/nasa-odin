import { LMST_HOUR_SECONDS } from '../conditions';
import { localToGeo, RoutePlanningError, type ConditionEvaluation, type Environment, type Point, type ReturnResult, type Route, type RouteDiagnostics, type RouteResult, type Settings, type TerrainData } from '../data';

export type PlannerData = Pick<TerrainData, 'meta'|'heights'|'slopes'|'valid'|'environment'>;
export interface PlannerRequest { start:Point; goal:Point; settings?:Partial<Settings>; mode?:'shortest'|'gentler'; elapsedS?:number }
export type CompleteSettings = Required<Settings>;
const defaults:CompleteSettings={speedMps:.8,maxSlopeDeg:20,maxDurationMin:90,doseRateMicroGyH:10,maxDoseMicroGy:50,temperatureK:220,minTemperatureK:180,windMps:0,maxWindMps:25,conditionsMode:'manual',departureHour:12,dwellMin:0,exclusions:[]};
const ranges={speedMps:[.1,3],maxSlopeDeg:[1,45],maxDurationMin:[1,480],doseRateMicroGyH:[0,10000],maxDoseMicroGy:[.01,100000],temperatureK:[100,350],minTemperatureK:[100,350],windMps:[0,200],maxWindMps:[0,200],departureHour:[0,24],dwellMin:[0,240]} as const;
function number(value:unknown,min:number,max:number,label:string,exclusive=false):asserts value is number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||(exclusive?value>=max:value>max))throw new RoutePlanningError(`${label} must be a finite number from ${min} to ${max}${exclusive?' (exclusive)':''}.`);
}
function point(p:Point,label:string){if(!p)throw new RoutePlanningError(`${label} is missing.`);number(p.x,-1e6,1e6,`${label} east coordinate`);number(p.y,-1e6,1e6,`${label} north coordinate`);}
export function settingsFor(input:Partial<Settings>={}):CompleteSettings {
  for(const key of Object.keys(input))if(!(key in defaults))throw new RoutePlanningError(`Unknown route setting: ${key}.`);
  const s={...defaults,...input};
  for(const key of Object.keys(ranges) as (keyof typeof ranges)[]){const [min,max]=ranges[key];number(s[key],min,max,key,key==='departureHour');}
  if(!['manual','historical'].includes(s.conditionsMode))throw new RoutePlanningError('Conditions mode must be manual or historical.');
  if(!Array.isArray(s.exclusions)||s.exclusions.length>30)throw new RoutePlanningError('At most 30 travel restrictions are supported.');
  for(const e of s.exclusions){point(e,'Restriction');number(e.radius,5,500,'Restriction radius');}
  return s;
}

// Python round() uses ties-to-even; Math.round() would move half-cell endpoints.
export function roundCell(value:number){const floor=Math.floor(value),fraction=value-floor;return fraction===.5?(floor%2===0?floor:floor+1):Math.round(value);}
type Entry=[number,number,number];
const less=(a:Entry,b:Entry)=>a[0]<b[0]||(a[0]===b[0]&&(a[1]<b[1]||(a[1]===b[1]&&a[2]<b[2])));
class Heap {
  items:Entry[]=[];
  push(item:Entry){const a=this.items;let i=a.length;a.push(item);while(i){const p=(i-1)>>1;if(!less(item,a[p]))break;a[i]=a[p];i=p;}a[i]=item;}
  pop(){const a=this.items,result=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&less(a[c+1],a[c]))c++;if(!less(a[c],last))break;a[i]=a[c];i=c;}a[i]=last;}return result;}
}

export class TerrainPlanner {
  readonly n:number; readonly step:number; readonly half:number;
  constructor(readonly data:PlannerData){
    this.n=data.meta.size;this.step=data.meta.stepM;this.half=(this.n-1)*this.step/2;
    if(!Number.isInteger(this.n)||this.n<2||!Number.isFinite(this.step)||this.step<=0||[data.heights.length,data.slopes.length,data.valid.length].some(n=>n!==this.n*this.n))throw new RoutePlanningError('Terrain arrays do not match their manifest.');
  }
  cell(p:Point){if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>this.half||Math.abs(p.y)>this.half)throw new RoutePlanningError('Point is outside the prepared terrain footprint.');return roundCell((this.half-p.y)/this.step)*this.n+roundCell((p.x+this.half)/this.step);}
  point(i:number):[number,number,number]{return [(i%this.n)*this.step-this.half,this.half-Math.floor(i/this.n)*this.step,this.data.heights[i]];}
  base(i:number,limit:number){return !!this.data.valid[i]&&Number.isFinite(this.data.heights[i])&&Number.isFinite(this.data.slopes[i])&&this.data.slopes[i]<=limit;}
  permitted(limit:number,exclusions:Settings['exclusions']){
    for(const e of exclusions)this.cell(e);
    const mask=new Uint8Array(this.n*this.n),margin=this.step/Math.sqrt(2);
    for(let row=0;row<this.n;row++)for(let col=0;col<this.n;col++){
      const i=row*this.n+col,r=Math.min(row+1,this.n-1),c=Math.min(col+1,this.n-1);
      if(![i,row*this.n+c,r*this.n+col,r*this.n+c].every(j=>this.base(j,limit)))continue;
      const x=col*this.step-this.half,y=this.half-row*this.step;
      if(!exclusions.some(e=>(x-e.x)**2+(y-e.y)**2<=(e.radius+margin)**2))mask[i]=1;
    }
    return mask;
  }
  endpoints(start:Point,goal:Point,s:CompleteSettings,labels=['Habitat / start','Destination']){
    const cells:number[]=[],info:RouteDiagnostics['endpoints']=[];
    for(const [k,p] of [start,goal].entries()){
      const e:RouteDiagnostics['endpoints'][number]={label:labels[k],x:p.x,y:p.y,reasons:[],exclusionIndices:[]};info.push(e);
      let i:number;
      try{i=this.cell(p);}catch{e.reasons.push(`Outside the prepared footprint (east ±${this.half} m, north ±${this.half} m).`);cells.push(-1);continue;}
      cells.push(i);[e.x,e.y]=this.point(i);const row=Math.floor(i/this.n),col=i%this.n,slopes:number[]=[];let valid=true;
      for(let r=row;r<Math.min(row+2,this.n);r++)for(let c=col;c<Math.min(col+2,this.n);c++){const j=r*this.n+c;if(!this.base(j,Infinity))valid=false;else slopes.push(this.data.slopes[j]);}
      if(!valid)e.reasons.push('Missing or invalid terrain in the walking interpolation footprint.');
      if(slopes.length){e.slopeDeg=Math.max(...slopes);if(e.slopeDeg>s.maxSlopeDeg)e.reasons.push(`Walking-footprint slope ${e.slopeDeg.toFixed(1)}° exceeds the ${s.maxSlopeDeg}° limit.`);}
      s.exclusions.forEach((area,j)=>{const distance=Math.hypot(e.x-area.x,e.y-area.y);if(distance<=area.radius+this.step/Math.sqrt(2)){e.exclusionIndices.push(j);e.reasons.push(`Exclusion #${j+1}: center E ${area.x} / N ${area.y} m, radius ${area.radius} m; endpoint is ${distance.toFixed(1)} m from its center (including the cell margin).`);}});
    }
    const diagnostics:RouteDiagnostics={code:'blocked_endpoints',endpoints:info,slopeLimitDeg:s.maxSlopeDeg,stepM:this.step,activeExclusionCount:s.exclusions.length,notes:[]};
    if(info.some(e=>e.reasons.length))throw new RoutePlanningError(info.filter(e=>e.reasons.length).map(e=>`${e.label} is blocked: ${e.reasons.join(' ')}`).join(' '),diagnostics);
    return {start:cells[0],goal:cells[1],mask:this.permitted(s.maxSlopeDeg,s.exclusions),diagnostics};
  }
  connected(mask:Uint8Array,start:number,goal:number){
    if(!mask[start]||!mask[goal])return false;
    const seen=new Uint8Array(mask.length),stack=[start];seen[start]=1;
    while(stack.length){const i=stack.pop()!;if(i===goal)return true;const r=Math.floor(i/this.n),c=i%this.n;
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const nr=r+dr,nc=c+dc,j=nr*this.n+nc;if(nr>=0&&nr<this.n&&nc>=0&&nc<this.n&&mask[j]&&!seen[j]){seen[j]=1;stack.push(j);}}
    }return false;
  }
  disconnected(start:number,goal:number,s:CompleteSettings,d:RouteDiagnostics):never {
    d.code='disconnected';const notes=d.notes;
    if(!this.connected(this.permitted(Infinity,[]),start,goal))notes.push('Missing or invalid terrain separates these endpoints even with slope and exclusion constraints removed.');
    else {
      const noExclusions=this.connected(this.permitted(s.maxSlopeDeg,[]),start,goal),noSlope=this.connected(this.permitted(Infinity,s.exclusions),start,goal);
      if(!noExclusions)notes.push(`Terrain above the ${s.maxSlopeDeg}° slope limit separates these endpoints even without exclusions.`);
      if(!noSlope)notes.push('Active exclusions separate these endpoints even with the slope limit removed.');
      if(noExclusions)notes.push('A connected path exists at the current slope limit when active exclusions are removed; the exclusions block the connection.');
      if(noSlope)notes.push('Removing the slope limit restores a connected path with current exclusions retained; slopes block the connection.');
      if(noExclusions&&noSlope)notes.push('Slope limits and exclusions together close the available corridors.');
    }
    throw new RoutePlanningError('No connected route satisfies the terrain and exclusion constraints. '+notes.join(' '),d);
  }
  edge(a:number,b:number,s:CompleteSettings,mode:Route['mode']){
    const dr=Math.floor(b/this.n)-Math.floor(a/this.n),dc=b%this.n-a%this.n,flat=Math.hypot(dr,dc)*this.step;
    // NumPy subtracts the prepared float32 heights before converting to Python float.
    const dz=Math.fround(this.data.heights[b]-this.data.heights[a]),distance=Math.hypot(flat,dz),grade=dz/flat,slope=Math.max(this.data.slopes[a],this.data.slopes[b]);
    const seconds=distance/s.speedMps*(1+3*Math.max(0,grade)+1.5*Math.max(0,-grade));
    const cost=mode==='shortest'?distance:distance*(1+4*(slope/s.maxSlopeDeg)**2+8*Math.max(0,grade));
    return {cost,distance,seconds,dz,slope,grade};
  }
  search(startPoint:Point,goalPoint:Point,s:CompleteSettings,mode:Route['mode']='shortest',dijkstra=false):Route {
    const {start,goal,mask,diagnostics}=this.endpoints(startPoint,goalPoint,s);
    if(start===goal){diagnostics.code='same_cell';throw new RoutePlanningError('Select two different terrain cells.',diagnostics);}
    const best=new Float64Array(mask.length).fill(Infinity),parent=new Int32Array(mask.length).fill(-1),queue=new Heap();best[start]=0;queue.push([0,0,start]);
    const goalR=Math.floor(goal/this.n),goalC=goal%this.n;
    while(queue.items.length){const [,cost,i]=queue.pop();if(cost!==best[i])continue;if(i===goal)break;const r=Math.floor(i/this.n),c=i%this.n;
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
        const nr=r+dr,nc=c+dc,j=nr*this.n+nc;if(nr<0||nr>=this.n||nc<0||nc>=this.n||!mask[j])continue;
        if(dr&&dc&&(!mask[r*this.n+nc]||!mask[nr*this.n+c]))continue;
        const edge=this.edge(i,j,s,mode),next=cost+edge.cost;
        if(next<best[j]){best[j]=next;parent[j]=i;const h=dijkstra?0:Math.hypot(goalR-nr,goalC-nc)*this.step;queue.push([next+h,next,j]);}
      }
    }
    if(!Number.isFinite(best[goal]))this.disconnected(start,goal,s,diagnostics);
    const cells=[goal];while(cells[cells.length-1]!==start)cells.push(parent[cells[cells.length-1]]);cells.reverse();
    let distance=0,seconds=0,ascent=0,descent=0,maximum=0;
    const profile=[{distanceM:0,elapsedS:0,elevationM:this.data.heights[start],slopeDeg:this.data.slopes[start]}],segments:NonNullable<Route['segments']>=[];
    for(let k=1;k<cells.length;k++){
      const e=this.edge(cells[k-1],cells[k],s,mode);
      segments.push({fromDistanceM:distance,distanceM:e.distance,durationS:e.seconds,slopeDeg:e.slope,gradePercent:e.grade*100,cost:e.cost,slopePenalty:mode==='gentler'?e.distance*4*(e.slope/s.maxSlopeDeg)**2:0,uphillPenalty:mode==='gentler'?e.distance*8*Math.max(0,e.grade):0});
      distance+=e.distance;seconds+=e.seconds;ascent+=Math.max(0,e.dz);descent+=Math.max(0,-e.dz);maximum=Math.max(maximum,e.slope);
      profile.push({distanceM:distance,elapsedS:seconds,elevationM:this.data.heights[cells[k]],slopeDeg:e.slope});
    }
    const points=cells.map(i=>this.point(i));
    return {mode,points,geographic:points.map(([x,y,z])=>[...localToGeo(this.data.meta,{x,y}),z]),profile,segments,metrics:{distanceM:distance,durationS:seconds,ascentM:ascent,descentM:descent,maxSlopeDeg:maximum,doseMicroGy:seconds/3600*s.doseRateMicroGyH,terrainCost:best[goal]}};
  }
}

export function evaluateConditions(environment:Environment,s:CompleteSettings,seconds:number,departure=s.departureHour):ConditionEvaluation & {coverageComplete:boolean} {
  let cold=0,unknown=0,missing=false;const temperatures:number[]=[],records=new Map(environment.weather.map(r=>[r.hour,r.temperatureK]));
  if(s.conditionsMode==='manual'){temperatures.push(s.temperatureK);if(s.temperatureK<s.minTemperatureK)cold=seconds;}
  else {
    const start=departure*LMST_HOUR_SECONDS,end=start+seconds;let cursor=start;
    const first=records.get(Math.trunc(start/LMST_HOUR_SECONDS+1e-10));missing=first==null;if(!missing)temperatures.push(first!);
    while(cursor<end){const hour=Math.trunc(cursor/LMST_HOUR_SECONDS+1e-10),edge=Math.min(end,(hour+1)*LMST_HOUR_SECONDS),value=records.get(hour);
      if(value==null)unknown+=edge-cursor;else{temperatures.push(value);if(value<s.minTemperatureK)cold+=edge-cursor;}cursor=edge;
    }
  }
  const dose=seconds/3600*s.doseRateMicroGyH,messages:string[]=[];
  if(cold>0||(temperatures.length&&Math.min(...temperatures)<s.minTemperatureK))messages.push('Excursion temperature falls below the configured demonstration limit.');
  if(unknown>0||missing)messages.push('Historical temperature coverage is incomplete; excursion conditions are unknown beyond the available bins.');
  if(s.windMps>s.maxWindMps)messages.push('Assumed wind exceeds the configured demonstration limit.');
  if(seconds>s.maxDurationMin*60)messages.push('Excursion including return exceeds the configured time budget.');
  if(dose>s.maxDoseMicroGy)messages.push('Excursion including return exceeds the configured detector-dose proxy budget.');
  return {departureHour:departure,arrivalHour:departure+seconds/LMST_HOUR_SECONDS,minTemperatureK:temperatures.length?Math.min(...temperatures):null,coldSeconds:cold,unknownSeconds:unknown,doseMicroGy:dose,warnings:messages,coverageComplete:!missing&&unknown===0,status:messages.some(m=>m.includes('exceeds')||m.includes('below'))?'exceeds':unknown>0||missing?'unknown':'within'};
}
export function calculate(planner:TerrainPlanner,operation:'routes',req:PlannerRequest):RouteResult;
export function calculate(planner:TerrainPlanner,operation:'return',req:PlannerRequest):ReturnResult;
export function calculate(planner:TerrainPlanner,operation:'routes'|'return',req:PlannerRequest):RouteResult|ReturnResult {
  point(req.start,'Start');point(req.goal,'Destination');const s=settingsFor(req.settings),{meta,environment}=planner.data;
  if(operation==='return'){
    const elapsed=req.elapsedS??0,mode=req.mode??'shortest';number(elapsed,0,1e6,'Elapsed mission time');if(!['shortest','gentler'].includes(mode))throw new RoutePlanningError('Return route mode must be shortest or gentler.');
    const ends=planner.endpoints(req.start,req.goal,s,['Current position','Habitat']);
    if(ends.start===ends.goal)return {datasetId:meta.id,version:meta.version,route:null,warnings:evaluateConditions(environment,s,elapsed).warnings,atHabitat:true};
    const route=planner.search(req.start,req.goal,s,mode),conditions=evaluateConditions(environment,s,elapsed+route.metrics.durationS);
    return {datasetId:meta.id,version:meta.version,route,warnings:conditions.warnings,conditions};
  }
  const routes=(['shortest','gentler'] as const).map(mode=>{
    const route=planner.search(req.start,req.goal,s,mode),back=planner.search(req.goal,req.start,s,mode),total=route.metrics.durationS+s.dwellMin*60+back.metrics.durationS,conditions=evaluateConditions(environment,s,total);
    return {...route,returnRoute:back,roundTripS:total,roundTripDoseMicroGy:conditions.doseMicroGy,warnings:conditions.warnings,conditions,departures:s.conditionsMode==='historical'?Array.from({length:24},(_,h)=>evaluateConditions(environment,s,total,h)):[]};
  });
  const recommendedIndex=routes[1].warnings.length<routes[0].warnings.length||(routes[1].warnings.length===routes[0].warnings.length&&routes[1].roundTripS<routes[0].roundTripS)?1:0;
  return {datasetId:meta.id,version:meta.version,reference:meta.horizontalReference,settings:s,routes,recommendedIndex,assumptions:'Terrain candidates evaluated over outbound travel, destination dwell and return. Historical REMS hourly medians are held within their LMST bins, without extrapolation; manual mode holds the configured temperature. Wind is an assumption. RAD is a uniform fixed detector-rate proxy, not astronaut dosimetry. Recommendation compares these candidates only; no environmental path optimization or guarantee of feasibility.'};
}
