import { RoutePlanningError, type RouteResult, type ReturnResult } from '../data';
import type { PlannerData, PlannerRequest } from './core';
import type { Operation, Reply, Work } from './protocol';
interface Slot { worker:Worker; initialized:boolean; cancel?:()=>void }
export type WorkerFactory=()=>Worker;
const abort=()=>new DOMException('Route calculation cancelled.','AbortError');
export class BrowserPlanner {
  private slots:Partial<Record<Operation,Slot>>={};
  private sequence=0;
  constructor(private data:PlannerData,private createWorker:WorkerFactory=()=>new Worker(new URL('./worker.ts',import.meta.url),{type:'module'})){}
  compare(request:PlannerRequest,signal?:AbortSignal){return this.run('routes',request,signal) as Promise<RouteResult>;}
  returnToHabitat(request:PlannerRequest,signal?:AbortSignal){return this.run('return',request,signal) as Promise<ReturnResult>;}
  private run(operation:Operation,request:PlannerRequest,signal?:AbortSignal):Promise<RouteResult|ReturnResult>{
    if(signal?.aborted)return Promise.reject(abort());
    // Independent lanes: returning while walking cannot cancel a route comparison.
    // Superseding work terminates the old thread, interrupting synchronous A* too.
    this.slots[operation]?.cancel?.();
    return new Promise((resolve,reject)=>{
      let slot=this.slots[operation];
      try {if(!slot){slot={worker:this.createWorker(),initialized:false};this.slots[operation]=slot;}}catch{reject(new Error('The browser planner could not start. Enable browser workers and reload the page.'));return;}
      const current=slot,id=++this.sequence;
      const cleanup=()=>{current.worker.removeEventListener('message',message);current.worker.removeEventListener('error',failure);current.worker.removeEventListener('messageerror',failure);signal?.removeEventListener('abort',cancel);current.cancel=undefined;};
      const reset=()=>{current.worker.terminate();if(this.slots[operation]===current)delete this.slots[operation];};
      const cancel=()=>{cleanup();reset();reject(abort());};
      const failure=(event?:Event)=>{event?.preventDefault();cleanup();reset();reject(new Error('The browser planner was interrupted. Please try again.'));};
      const message=(event:MessageEvent<Reply>)=>{if(event.data.id!==id)return;cleanup();if('error' in event.data)reject(new RoutePlanningError(event.data.error.message,event.data.error.diagnostics));else resolve(event.data.result);};
      current.cancel=cancel;current.worker.addEventListener('message',message);current.worker.addEventListener('error',failure);current.worker.addEventListener('messageerror',failure);signal?.addEventListener('abort',cancel,{once:true});
      const work:Work={id,operation,request};
      try {
        const transfer:Transferable[]=[];
        if(!current.initialized){
          // Copy once per worker, never detach the arrays used by rendering/collision.
          const heights=this.data.heights.slice(),slopes=this.data.slopes.slice(),valid=this.data.valid.slice();
          work.data={meta:this.data.meta,environment:this.data.environment,heights,slopes,valid};transfer.push(heights.buffer,slopes.buffer,valid.buffer);current.initialized=true;
        }
        current.worker.postMessage(work,transfer);
      }catch{failure();}
    });
  }
  dispose(){for(const slot of Object.values(this.slots)){if(slot.cancel)slot.cancel();else slot.worker.terminate();}this.slots={};}
}
