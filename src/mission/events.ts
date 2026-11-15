import type {Point} from './data';
export type EventKind='solar'|'dust';
export interface ExpeditionEvent {id:string;kind:EventKind;atS:number;createdS:number;center:Point;radiusM:number;acknowledged:boolean;endedS?:number}
export const EVENT_NAMES={solar:'Solar-particle scenario',dust:'Local dust scenario'};
export function eventStatus(event:ExpeditionEvent,elapsed:number){return event.endedS!==undefined?'ended':elapsed>=event.atS?'active':'scheduled';}
export function inDanger(event:ExpeditionEvent,point:Point,habitat:Point){return event.kind==='solar'?Math.hypot(point.x-habitat.x,point.y-habitat.y)>event.radiusM:Math.hypot(point.x-event.center.x,point.y-event.center.y)<=event.radiusM;}
export function eventInstruction(event:ExpeditionEvent,point:Point,habitat:Point){return event.kind==='solar'?(inDanger(event,point,habitat)?'Danger · return to habitat':'At demonstration shelter · remain here'):(inDanger(event,point,habitat)?'Danger · leave the marked dust area':'Caution · avoid the marked dust area');}
export function circle(center:Point,radius:number){return Array.from({length:97},(_,i)=>({x:center.x+radius*Math.cos(i/96*Math.PI*2),y:center.y+radius*Math.sin(i/96*Math.PI*2)}));}

/** A joined outer ring and inner ring use the renderer's even-odd polygon fill. */
export function exposedArea(habitat:Point,radius:number,extentM:number){
  const h=extentM/2,corner={x:-h,y:-h},inner=circle(habitat,radius);
  return [corner,{x:h,y:-h},{x:h,y:h},{x:-h,y:h},corner,...inner,corner];
}
