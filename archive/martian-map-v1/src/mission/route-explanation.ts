import type { Alternative, Route } from './data';
export function profileEdge(route:Route,distanceM:number) {
  const segments=route.segments??[];
  if(!segments.length)return undefined;
  const index=segments.findIndex(s=>s.fromDistanceM+s.distanceM>=distanceM);
  return Math.min(segments.length-1,index<0?segments.length-1:index);
}
export function routeDifferences(a:Alternative,b:Alternative) {
  return {distanceM:b.metrics.distanceM-a.metrics.distanceM,durationS:b.metrics.durationS-a.metrics.durationS,
    ascentM:b.metrics.ascentM-a.metrics.ascentM,maxSlopeDeg:b.metrics.maxSlopeDeg-a.metrics.maxSlopeDeg,
    roundTripS:b.roundTripS-a.roundTripS,doseMicroGy:b.roundTripDoseMicroGy-a.roundTripDoseMicroGy};
}
export function costBreakdown(route:Route) {
  return {length:route.metrics.distanceM,slope:(route.segments??[]).reduce((n,s)=>n+s.slopePenalty,0),
    uphill:(route.segments??[]).reduce((n,s)=>n+s.uphillPenalty,0)};
}
