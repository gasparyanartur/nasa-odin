import { expect, it } from 'vitest';
import { BrowserPlanner } from './client';
import type { PlannerData } from './core';
import type { Reply, Work } from './protocol';
import type { Meta, Environment } from '../data';
class TestWorker extends EventTarget {
  messages:Work[]=[];terminated=false;
  postMessage(work:Work){this.messages.push(work);}
  terminate(){this.terminated=true;}
  reply(reply:Reply){this.dispatchEvent(new MessageEvent('message',{data:reply}));}
}
function setup(){
  const data:PlannerData={meta:{id:'test',size:2,stepM:1} as Meta,environment:{} as Environment,heights:new Float32Array(4),slopes:new Float32Array(4),valid:new Uint8Array(4)};
  const workers:TestWorker[]=[],planner=new BrowserPlanner(data,()=>{const worker=new TestWorker();workers.push(worker);return worker as unknown as Worker;});
  return {data,workers,planner};
}
const request={start:{x:0,y:0},goal:{x:1,y:1}};
const result={datasetId:'test',version:1,routes:[],recommendedIndex:0,settings:{} as never,assumptions:''};
it('copies terrain once per worker without detaching rendering arrays, reuses idle workers and disposes',async()=>{
  const {data,workers,planner}=setup();const first=planner.compare(request),worker=workers[0];
  expect(worker.messages[0].data!.heights).not.toBe(data.heights);expect(data.heights.byteLength).toBe(16);
  worker.reply({id:1,result});await expect(first).resolves.toEqual(result);
  const second=planner.compare(request);expect(worker.messages[1].data).toBeUndefined();worker.reply({id:2,result});await second;
  planner.dispose();expect(worker.terminated).toBe(true);
});
it('aborts in-flight CPU work, ignores late replies and initializes its replacement',async()=>{
  const {workers,planner}=setup(),controller=new AbortController(),first=planner.compare(request,controller.signal);const aborted=expect(first).rejects.toMatchObject({name:'AbortError'});
  controller.abort();await aborted;expect(workers[0].terminated).toBe(true);
  const second=planner.compare(request);workers[0].reply({id:1,result});expect(workers[1].messages[0].data).toBeDefined();workers[1].reply({id:2,result});await second;planner.dispose();
});
it('separates route and return work, supersedes only the same lane, and rejects disposed requests',async()=>{
  const {workers,planner}=setup(),first=planner.returnToHabitat(request),aborted=expect(first).rejects.toMatchObject({name:'AbortError'});
  const routes=planner.compare(request);const latest=planner.returnToHabitat(request);await aborted;
  expect(workers[0].terminated).toBe(true);expect(workers[1].terminated).toBe(false);
  workers[1].reply({id:2,result});await routes;
  const stopped=expect(latest).rejects.toMatchObject({name:'AbortError'});planner.dispose();await stopped;expect(workers[2].terminated).toBe(true);
});
it('preserves diagnostics and recovers after a worker crash',async()=>{
  const {workers,planner}=setup(),first=planner.compare(request),failed=expect(first).rejects.toThrow(/interrupted/);
  workers[0].dispatchEvent(new Event('error'));await failed;expect(workers[0].terminated).toBe(true);
  const second=planner.compare(request),blocked=expect(second).rejects.toMatchObject({name:'RoutePlanningError',diagnostics:{code:'same_cell'}});
  workers[1].reply({id:2,error:{message:'Select different cells',diagnostics:{code:'same_cell'} as never}});await blocked;
  const third=planner.compare(request);workers[1].reply({id:3,result});await third;planner.dispose();
});
it('does not start a worker for an already aborted request',async()=>{
  const {workers,planner}=setup(),controller=new AbortController();controller.abort();await expect(planner.compare(request,controller.signal)).rejects.toMatchObject({name:'AbortError'});expect(workers).toHaveLength(0);
});
