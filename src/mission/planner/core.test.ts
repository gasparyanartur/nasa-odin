import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { calculate, evaluateConditions, roundCell, settingsFor, TerrainPlanner, type PlannerData, type PlannerRequest } from './core';
import { RoutePlanningError, type Environment, type Meta, type Route, type RouteResult } from '../data';
import { LMST_HOUR_SECONDS } from '../conditions';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
function real(folder:string):PlannerData {
  const bytes=(name:string)=>readFileSync(`public/${folder}/${name}`);
  const floats=(name:string)=>{const b=bytes(name);return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
  return {meta:read(`public/${folder}/manifest.json`),environment:read(`public/${folder}/environment.json`),heights:floats('height.f32'),slopes:floats('slope.f32'),valid:Uint8Array.from(bytes('valid.u8'))};
}
function flat(n=9):PlannerData{return {meta:{size:n,stepM:1,id:'test',version:1,origin:{latitude:0,longitude:0},radiusM:3389500} as Meta,environment:{weather:[]} as unknown as Environment,heights:new Float32Array(n*n),slopes:new Float32Array(n*n),valid:new Uint8Array(n*n).fill(1)};}
const settings=settingsFor();
function close(actual:unknown,expected:unknown,path='result'){
  if(typeof expected==='number'){expect(typeof actual,path).toBe('number');expect(Math.abs((actual as number)-expected),path).toBeLessThanOrEqual(1e-7*Math.max(1,Math.abs(expected)));}
  else if(Array.isArray(expected)){expect(Array.isArray(actual),path).toBe(true);expect((actual as unknown[]).length,path).toBe(expected.length);expected.forEach((e,i)=>close((actual as unknown[])[i],e,`${path}[${i}]`));}
  else if(expected!==null&&typeof expected==='object'){for(const [key,e] of Object.entries(expected))close((actual as Record<string,unknown>)?.[key],e,`${path}.${key}`);}
  else expect(actual,path).toEqual(expected);
}
describe.skipIf(!process.env.PLANNER_PYTHON_REFERENCE)('Python reference parity on prepared terrain',()=>{
  if(!process.env.PLANNER_PYTHON_REFERENCE)return;
  const python=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
  // Python is an explicit offline verification dependency, never a browser runtime.
  const cases=JSON.parse(execFileSync(python,['-m','scripts.planner-reference'],{maxBuffer:20*1024*1024,timeout:120000}).toString()) as {name:string;folder:string;operation:'routes'|'return';request:PlannerRequest;result:unknown}[];
  for(const fixture of cases)it(fixture.name,()=>{
    const planner=new TerrainPlanner(real(fixture.folder));
    if((fixture.result as {detail?:string}).detail){
      let failure:RoutePlanningError|undefined;try{if(fixture.operation==='routes')calculate(planner,'routes',fixture.request);else calculate(planner,'return',fixture.request);}catch(e){failure=e as RoutePlanningError;}
      expect(failure).toBeInstanceOf(RoutePlanningError);close({detail:failure!.message,diagnostics:failure!.diagnostics},fixture.result);
    }else {
      const actual=fixture.operation==='routes'?calculate(planner,'routes',fixture.request):calculate(planner,'return',fixture.request);
      close(actual,fixture.result);
    }
  },20000);
});
it('A* agrees with Dijkstra for both objectives around a terrain barrier',()=>{
  const data=flat();for(let i=0;i<data.heights.length;i++)data.heights[i]=Math.sin(i*17)*.2;
  for(let r=2;r<7;r++)data.valid[r*9+4]=0;data.valid[5*9+4]=1;
  const planner=new TerrainPlanner(data);
  for(const mode of ['shortest','gentler'] as const){const a=planner.search({x:-3,y:-3},{x:3,y:3},settings,mode),d=planner.search({x:-3,y:-3},{x:3,y:3},settings,mode,true);expect(a.metrics.terrainCost).toBeCloseTo(d.metrics.terrainCost,9);}
});
it('prevents corner cutting and explains disconnected nodata/slope/exclusion barriers',()=>{
  for(const barrier of ['nodata','slope','exclusion']){
    const data=flat(25),s=settingsFor(barrier==='exclusion'?{exclusions:[-12,-6,0,6,12].map(y=>({x:0,y,radius:5}))}:{});
    for(let row=0;row<25;row++){if(barrier==='nodata')data.valid[row*25+12]=0;if(barrier==='slope')data.slopes[row*25+12]=30;}
    const planner=new TerrainPlanner(data);
    expect(()=>planner.search({x:-12,y:0},{x:12,y:0},s)).toThrow(/No connected route/);
    try{planner.search({x:-12,y:0},{x:12,y:0},s);}catch(e){expect((e as RoutePlanningError).diagnostics?.code).toBe('disconnected');expect((e as RoutePlanningError).diagnostics?.notes.join(' ')).toMatch(barrier==='nodata'?/Missing or invalid/:barrier==='slope'?/slope limit/:/exclusions/);}
  }
  const data=flat();data.valid[1]=data.valid[9]=0;expect(()=>new TerrainPlanner(data).search({x:-4,y:4},{x:4,y:-4},settings)).toThrow(/blocked/);
});
it('preserves directed travel, profile sums and walking interpolation footprints',()=>{
  const data=flat();for(let i=0;i<data.heights.length;i++)data.heights[i]=(i%9)*.2;
  const t=new TerrainPlanner(data),up=t.search({x:-3,y:0},{x:3,y:0},settings,'gentler'),down=t.search({x:3,y:0},{x:-3,y:0},settings,'gentler');
  expect(up.metrics.durationS).toBeGreaterThan(down.metrics.durationS);
  expect(up.profile!.at(-1)!.distanceM).toBe(up.metrics.distanceM);
  expect(up.segments!.reduce((n,s)=>n+s.cost,0)).toBeCloseTo(up.metrics.terrainCost,9);
  data.valid[4*9+5]=0;expect(()=>t.search({x:0,y:0},{x:-3,y:0},settings)).toThrow(/walking interpolation footprint/);
});
it('rounds half cells like Python and rejects invalid numerical settings',()=>{
  expect([.5,1.5,2.5,3.5].map(roundCell)).toEqual([0,2,2,4]);
  for(const patch of [{speedMps:0},{departureHour:24},{dwellMin:NaN},{maxSlopeDeg:Infinity},{exclusions:[{x:0,y:0,radius:1}]}])expect(()=>settingsFor(patch)).toThrow();
});
it('keeps missing hourly conditions unknown, handles zero duration and sol boundaries',()=>{
  const environment=real('gale').environment,s=settingsFor({conditionsMode:'historical',departureHour:23.75});
  const end=evaluateConditions(environment,s,LMST_HOUR_SECONDS/2);expect(end.unknownSeconds).toBeCloseTo(LMST_HOUR_SECONDS/4);expect(end.status).toBe('unknown');
  const absent=evaluateConditions({...environment,weather:[]},s,0);expect(absent.status).toBe('unknown');expect(absent.unknownSeconds).toBe(0);expect(absent.coverageComplete).toBe(false);
  expect(evaluateConditions(environment,settingsFor({temperatureK:220,minTemperatureK:230,doseRateMicroGyH:8}),1800)).toMatchObject({coldSeconds:1800,doseMicroGy:4,status:'exceeds'});
});

it('cannot jump diagonally between two valid walking footprints across blocked corners',()=>{
  const data=flat(5);data.valid.fill(0);
  for(const offset of [0,1])for(let row=offset;row<offset+2;row++)for(let col=offset;col<offset+2;col++)data.valid[row*5+col]=1;
  const planner=new TerrainPlanner(data),mask=planner.permitted(20,[]);
  expect(mask[0]).toBe(1);expect(mask[6]).toBe(1);expect(mask[1]).toBe(0);expect(mask[5]).toBe(0);
  expect(()=>planner.search({x:-2,y:2},{x:-1,y:1},settings)).toThrow(/No connected route/);
});
