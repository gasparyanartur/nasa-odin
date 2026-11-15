import { calculate, TerrainPlanner } from './core';
import { RoutePlanningError } from '../data';
import type { Work, Reply } from './protocol';
const scope=self as unknown as {onmessage:((e:MessageEvent<Work>)=>void)|null;postMessage:(reply:Reply)=>void};
let planner:TerrainPlanner|undefined;
scope.onmessage=({data:work})=>{
  try {
    if(work.data)planner=new TerrainPlanner(work.data);
    if(!planner)throw new Error('The planner has no terrain. Reopen the site and try again.');
    const result=work.operation==='routes'?calculate(planner,'routes',work.request):calculate(planner,'return',work.request);
    scope.postMessage({id:work.id,result});
  }catch(error){scope.postMessage({id:work.id,error:{message:error instanceof Error?error.message:'Route planning failed. Please try again.',diagnostics:error instanceof RoutePlanningError?error.diagnostics:undefined}});}
};
