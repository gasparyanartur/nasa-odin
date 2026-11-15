import { withBase } from '../assetUrl';

export interface Point { x: number; y: number }
export interface Pose extends Point { heading: number; pitch?: number; elapsed: number }
export interface Exclusion extends Point { radius: number }
export interface Meta {
  id: string; pathsFile?:string; regionId?: 'gale-bradbury' | 'gale-boxwork'; defaultStart?: Point; defaultGoal?: Point; detail?: {baseUrl:string;scene:string}; version: number; name: string; size: number; stepM: number; extentM: number;
  origin: { longitude: number; latitude: number }; radiusM: number; bounds: [number, number, number, number];
  referenceElevationM: number; minElevationM: number; maxElevationM: number; validFraction: number;
  horizontalReference?: string; verticalReference: string; resolutionNote: string; slopeDefinition: string; attribution: string;
  sources: { name: string; url: string; catalog: string }[];
}
export interface Observation { timeLabel: string; hour: number; temperatureK: number | null; pressurePa: number | null; windMps: number | null }
export interface Environment {
  sol: number; earthDate?:string; aggregation?:string; weather: Observation[]; weatherSource: string; weatherProduct: string; weatherNote: string;
  radiation: { rateMicroGyH: number; detector?:string; source: string; product: string; note: string; observations: number };
}
export interface SiteEvidence { sourceUrl:string; path:(Point & {sol:number})[]; markers:(Point & {id:string;label:string;note:string})[] }
export interface TerrainData { evidence?:SiteEvidence; baseUrl: string; meta: Meta; heights: Float32Array; slopes: Float32Array; valid: Uint8Array; environment: Environment }
export interface Settings {
  speedMps: number; maxSlopeDeg: number; maxDurationMin: number; doseRateMicroGyH: number; maxDoseMicroGy: number;
  conditionsMode?: 'historical' | 'manual'; departureHour?: number; dwellMin?: number;
  temperatureK: number; minTemperatureK: number; windMps: number; maxWindMps: number; exclusions: Exclusion[];
}
export interface Metrics { distanceM: number; durationS: number; ascentM: number; descentM: number; maxSlopeDeg: number; doseMicroGy: number; terrainCost: number }
export interface ProfilePoint { distanceM: number; elapsedS: number; elevationM: number; slopeDeg: number }
export interface RouteSegment { fromDistanceM: number; distanceM: number; durationS: number; slopeDeg: number; gradePercent: number; cost: number; slopePenalty: number; uphillPenalty: number }
export interface Route { profile?: ProfilePoint[]; segments?: RouteSegment[]; mode: 'shortest' | 'gentler'; points: [number, number, number][]; geographic: [number, number, number][]; metrics: Metrics }
export interface ConditionEvaluation { departureHour: number; arrivalHour: number; minTemperatureK: number | null; coldSeconds: number; unknownSeconds: number; doseMicroGy: number; warnings: string[]; status: 'within' | 'exceeds' | 'unknown' }
export interface Alternative extends Route { returnRoute: Route; roundTripS: number; roundTripDoseMicroGy: number; warnings: string[]; conditions: ConditionEvaluation; departures: ConditionEvaluation[] }
export interface RouteResult { reference?:string; datasetId: string; version: number; settings: Settings; routes: Alternative[]; recommendedIndex: number; assumptions: string }
export interface ReturnResult { datasetId?:string; version?:number; conditions?:ConditionEvaluation; route: Route | null; warnings: string[]; atHabitat?: boolean }
export interface RouteDiagnostics {
  code: 'blocked_endpoints' | 'disconnected' | 'same_cell'; slopeLimitDeg: number; stepM: number; activeExclusionCount: number;
  endpoints: { label: string; x: number; y: number; slopeDeg?: number; reasons: string[]; exclusionIndices: number[] }[];
  notes: string[];
}
export class RoutePlanningError extends Error {
  constructor(message: string, public diagnostics?: RouteDiagnostics) { super(message); this.name='RoutePlanningError'; }
}

export async function loadTerrain(signal?: AbortSignal, baseUrl = withBase('/gale')): Promise<TerrainData> {
  const get = async (file: string) => {
    let r: Response;
    try { r = await fetch(`${baseUrl}/${file}`, { signal }); }
    catch (error) { if ((error as Error).name === 'AbortError') throw error; throw new Error(`Local Gale data could not load (${file}). Check the prepared data package and retry.`); }
    if (!r.ok) throw new Error(`Local Gale data could not load (${file}). Restore the prepared data package and retry.`);
    return r;
  };
  const [meta, h, s, v, environment] = await Promise.all([
    get('manifest.json').then(r => r.json()), get('height.f32').then(r => r.arrayBuffer()),
    get('slope.f32').then(r => r.arrayBuffer()), get('valid.u8').then(r => r.arrayBuffer()),
    get('environment.json').then(r => r.json()),
  ]);
  if (h.byteLength !== meta.size**2*4 || s.byteLength !== h.byteLength || v.byteLength !== meta.size**2) throw new Error('Gale data arrays do not match their manifest.');
  if (meta.detail) meta.detail = { ...meta.detail, baseUrl: withBase(meta.detail.baseUrl) };
  const evidence=meta.detail?await get('evidence.json').then(r=>r.json()):undefined;
  return { baseUrl, meta, evidence, heights: new Float32Array(h), slopes: new Float32Array(s), valid: new Uint8Array(v), environment };
}

export function localToGeo(meta: Meta, p: Point): [number, number] {
  return [meta.origin.longitude+p.x/(meta.radiusM*Math.cos(meta.origin.latitude*Math.PI/180))*180/Math.PI,
    meta.origin.latitude+p.y/meta.radiusM*180/Math.PI];
}
export function geoToLocal(meta: Meta, lon: number, lat: number): Point {
  return { x: (lon-meta.origin.longitude)*Math.PI/180*meta.radiusM*Math.cos(meta.origin.latitude*Math.PI/180), y: (lat-meta.origin.latitude)*Math.PI/180*meta.radiusM };
}

export function sample(data: TerrainData, point: Point) {
  const { size, stepM, extentM } = data.meta;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x)>extentM/2 || Math.abs(point.y)>extentM/2) return null;
  const col=(point.x+extentM/2)/stepM, row=(extentM/2-point.y)/stepM;
  const x0=Math.floor(col), y0=Math.floor(row), x1=Math.min(size-1,x0+1), y1=Math.min(size-1,y0+1);
  const ids=[y0*size+x0,y0*size+x1,y1*size+x0,y1*size+x1];
  if (ids.some(i => !data.valid[i])) return null;
  const dx=col-x0, dy=row-y0;
  const z=(data.heights[ids[0]]*(1-dx)+data.heights[ids[1]]*dx)*(1-dy)+(data.heights[ids[2]]*(1-dx)+data.heights[ids[3]]*dx)*dy;
  return { elevation: z, slope: Math.max(...ids.map(i => data.slopes[i])) };
}

export function canMove(data: TerrainData, a: Point, b: Point, settings: Pick<Settings, 'maxSlopeDeg' | 'exclusions'>): boolean {
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(data.meta.stepM/2)));
  for (let i=1;i<=n;i++) {
    const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};
    const v=sample(data,p);
    if (!v || v.slope>settings.maxSlopeDeg || settings.exclusions.some(e => Math.hypot(e.x-p.x,e.y-p.y)<=e.radius)) return false;
  }
  return true;
}

// Integrate the full mission interval in small physical steps, independent of drawing FPS.
export function advanceWalk(data: TerrainData, pose: Pose, settings: Pick<Settings, 'speedMps' | 'maxSlopeDeg' | 'exclusions'>, heading: number, forward: number, right: number, seconds: number) {
  const next={...pose,heading,elapsed:pose.elapsed+seconds};
  const length=Math.hypot(forward,right)||1;
  let remaining=seconds, blocked=false;
  while(remaining>1e-8&&(forward||right)) {
    const step=Math.min(.1,remaining), amount=settings.speedMps*step/length;
    let target={x:next.x+(Math.sin(heading)*forward+Math.cos(heading)*right)*amount,y:next.y+(Math.cos(heading)*forward-Math.sin(heading)*right)*amount};
    const from=sample(data,next),to=sample(data,target),flat=Math.hypot(target.x-next.x,target.y-next.y);
    if(from&&to&&flat>0) {
      const grade=(to.elevation-from.elevation)/flat;
      const penalty=Math.hypot(1,grade)*(1+3*Math.max(0,grade)+1.5*Math.max(0,-grade));
      target={x:next.x+(target.x-next.x)/penalty,y:next.y+(target.y-next.y)/penalty};
    }
    if(!canMove(data,next,target,settings)){blocked=true;break;}
    next.x=target.x;next.y=target.y;remaining-=step;
  }
  return {pose:next,blocked};
}

export function routeProgress(route: Route, point: Point) {
  let nearest=Infinity, index=0, along=0, bestAlong=0, total=0;
  const points=route.points;
  for (let i=0;i<points.length-1;i++) {
    const a=points[i], b=points[i+1], dx=b[0]-a[0],dy=b[1]-a[1];
    const length=Math.hypot(dx,dy);
    const t=Math.max(0,Math.min(1,((point.x-a[0])*dx+(point.y-a[1])*dy)/(length*length||1)));
    const d=Math.hypot(point.x-a[0]-t*dx,point.y-a[1]-t*dy);
    if (d<nearest) { nearest=d; index=i+1; bestAlong=along+t*length; }
    along+=length; total=along;
  }
  return { offRouteM: nearest, remainingM: Math.max(0,total-bestAlong), target: points[Math.min(points.length-1,index+3)] };
}
