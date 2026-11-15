import { expect, type Page } from '@playwright/test';
import type { Work, Reply, Operation } from '../src/mission/planner/protocol';
type Audit={work:Omit<Work,'data'>;reply?:Reply};
declare global {interface Window {plannerTest:{events:Audit[];fail:Partial<Record<Operation,boolean>>;delay:Partial<Record<Operation,number>>;terminated:number}}}
// Test-only boundary observation/fault injection. No production debug hooks.
export async function observePlanner(page:Page,options:{fail?:Partial<Record<Operation,boolean>>;delay?:Partial<Record<Operation,number>>}={}){
  await page.addInitScript((options)=>{
    const Original=window.Worker;
    window.plannerTest={events:[],fail:options.fail??{},delay:options.delay??{},terminated:0};
    window.Worker=class extends Original {
      stopped=false;
      override postMessage(work:Work,transfer:Transferable[]){
        if(!['routes','return'].includes(work?.operation)){super.postMessage(work,transfer);return;}
        const audit:Audit={work:{id:work.id,operation:work.operation,request:work.request}};window.plannerTest.events.push(audit);
        const onReply=(event:MessageEvent<Reply>)=>{if(event.data.id===work.id){audit.reply=event.data;this.removeEventListener('message',onReply);}};
        this.addEventListener('message',onReply);
        if(window.plannerTest.fail[work.operation]){queueMicrotask(()=>this.dispatchEvent(new Event('error')));return;}
        const delay=window.plannerTest.delay[work.operation]??0;
        if(delay)setTimeout(()=>{if(!this.stopped)super.postMessage(work,transfer);},delay);else super.postMessage(work,transfer);
      }
      override terminate(){this.stopped=true;window.plannerTest.terminated++;super.terminate();}
    } as typeof Worker;
  },options);
}
export const plannerCount=(page:Page)=>page.evaluate(()=>window.plannerTest.events.length);
export async function plannerReply(page:Page,operation:Operation,after=0,minElapsed=0){
  const find=()=>page.evaluate(({operation,after,minElapsed})=>window.plannerTest.events.slice(after).find(e=>e.work.operation===operation&&(e.work.request.elapsedS??0)>=minElapsed&&e.reply),{operation,after,minElapsed});
  await expect.poll(find,{timeout:60000}).toBeTruthy();return (await find())!;
}
