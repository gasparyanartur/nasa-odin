import { describe,expect,it } from 'vitest';
import { costBreakdown,profileEdge,routeDifferences } from './route-explanation';
import type { Alternative } from './data';
const first={metrics:{distanceM:10,durationS:20,ascentM:2,maxSlopeDeg:8,terrainCost:17},roundTripS:45,roundTripDoseMicroGy:1,
  segments:[{fromDistanceM:0,distanceM:4,slopePenalty:2,uphillPenalty:1},{fromDistanceM:4,distanceM:6,slopePenalty:3,uphillPenalty:1}]} as unknown as Alternative;
describe('route explanations and map/profile correspondence',()=>{
  it('maps cumulative profile distance to actual route-edge indices, including endpoints',()=>{
    expect(profileEdge(first,0)).toBe(0);expect(profileEdge(first,4)).toBe(0);expect(profileEdge(first,4.1)).toBe(1);expect(profileEdge(first,10)).toBe(1);expect(profileEdge(first,100)).toBe(1);
    expect(profileEdge({...first,segments:[]},0)).toBeUndefined();
  });
  it('reports actual metric differences rather than assuming gentler always improves slope',()=>{
    const second={...first,metrics:{...first.metrics,distanceM:12,durationS:18,ascentM:3,maxSlopeDeg:9},roundTripS:43,roundTripDoseMicroGy:.8};
    expect(routeDifferences(first,second)).toEqual({distanceM:2,durationS:-2,ascentM:1,maxSlopeDeg:1,roundTripS:-2,doseMicroGy:expect.closeTo(-.2)});
    expect(costBreakdown(first)).toEqual({length:10,slope:5,uphill:2});
  });
});
