import { useState } from 'react';
import { costBreakdown, profileEdge, routeDifferences } from './route-explanation';
import type { Alternative, Settings } from './data';
const delta=(v:number,digits=1)=>`${v>0?'+':''}${v.toFixed(digits)}`;
export default function RouteExplanation({routes,selected,edge,onEdge,settings}:{routes:Alternative[];selected:number;edge?:number;onEdge:(edge:number|undefined)=>void;settings:Settings}) {
  const [metric,setMetric]=useState<'elevationM'|'slopeDeg'>('elevationM');
  const route=routes[selected],points=route.profile,segments=route.segments;
  if(!points?.length||!segments?.length)return <p className="error" role="alert">Route profiles are unavailable. Restart the updated planner API and compare again.</p>;
  const change=routeDifferences(routes[0],routes[1]),cost=costBreakdown(route);
  const selectedEdge=edge===undefined?undefined:segments[edge];
  const selectedPoint=edge===undefined?undefined:points[edge+1];
  const min=metric==='slopeDeg'?0:Math.min(...points.map(p=>p.elevationM)),max=Math.max(min+1,...points.map(p=>p[metric]));
  const width=680,height=160,total=route.metrics.distanceM||1;
  const x=(m:number)=>40+m/total*(width-55),y=(v:number)=>15+(1-(v-min)/(max-min))*(height-45);
  const line=points.map(p=>`${x(p.distanceM)},${y(p[metric])}`).join(' ');
  const selectDistance=(m:number)=>onEdge(profileEdge(route,m));
  return <section className="route-explanation" aria-label="Explain route comparison"><header><div><span className="data-kind">DERIVED FROM NUMERIC TERRAIN</span><h3>Why these routes differ</h3></div><label>Profile <select aria-label="Route profile metric" value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="elevationM">Elevation</option><option value="slopeDeg">Terrain slope</option></select></label></header>
    <p>Gentler minus shortest: <b>{delta(change.distanceM)} m</b> outbound, <b>{delta(change.durationS/60)} min</b> travel, <b>{delta(change.ascentM)} m</b> ascent, and <b>{delta(change.maxSlopeDeg)}°</b> maximum local slope.</p>
    {Math.abs(change.distanceM)<.001&&Math.abs(change.durationS)<.001&&Math.abs(change.maxSlopeDeg)<.001&&<p>The candidates coincide under the current endpoints and constraints; the gentler objective has not produced a distinct alternative.</p>}
    <div className="profile-plot"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric==='elevationM'?'Elevation':'Terrain slope'} profile of selected outbound route`} onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect();selectDistance(Math.max(0,Math.min(total,((e.clientX-b.left)/b.width*width-40)/(width-55)*total)));}} onClick={e=>{const b=e.currentTarget.getBoundingClientRect();selectDistance(Math.max(0,Math.min(total,((e.clientX-b.left)/b.width*width-40)/(width-55)*total)));}}>
      <line x1="40" y1="15" x2="40" y2={height-30}/><line x1="40" y1={height-30} x2={width-15} y2={height-30}/><polyline points={line}/><text x="2" y="18">{max.toFixed(1)}</text><text x="2" y={height-30}>{min.toFixed(1)}</text><text x="40" y={height-8}>0 m</text><text x={width-90} y={height-8}>{total.toFixed(0)} m</text>
      {selectedPoint&&<><line className="profile-cursor" x1={x(selectedPoint.distanceM)} x2={x(selectedPoint.distanceM)} y1="15" y2={height-30}/><circle cx={x(selectedPoint.distanceM)} cy={y(selectedPoint[metric])} r="4"/></>}
    </svg></div>
    <label className="profile-slider">Inspect outbound distance <output>{selectedPoint?.distanceM.toFixed(1)??'0.0'} m</output><input aria-label="Profile distance" type="range" min="0" max={total} step="1" value={selectedPoint?.distanceM??0} onChange={e=>selectDistance(Number(e.target.value))}/></label>
    {selectedEdge&&<div className="segment-inspection" aria-label="Selected route segment"><strong>Highlighted segment {edge!+1}</strong><span>{selectedEdge.distanceM.toFixed(1)} m · {selectedEdge.durationS.toFixed(1)} s · {selectedEdge.gradePercent.toFixed(1)}% directed grade</span><span>{selectedEdge.slopeDeg.toFixed(1)}° conservative terrain slope · {selectedPoint?.elevationM.toFixed(1)} m areoid elevation</span><div className="button-row"><button className="secondary" onClick={()=>document.querySelector('.terrain-workspace .surface-map')?.scrollIntoView({behavior:'smooth',block:'center'})}>Show segment on map ↑</button><button className="text-button" onClick={()=>onEdge(undefined)}>Clear highlight</button></div></div>}
    <details><summary>Search cost and active constraints</summary><p>Shortest minimizes 3D length. Gentler minimizes length × (1 + 4 × (terrain slope / slope limit)² + 8 × uphill grade). A lower gentler cost does not guarantee a lower maximum slope.</p><p>Selected cost contributions: {cost.length.toFixed(1)} length + {cost.slope.toFixed(1)} slope penalty + {cost.uphill.toFixed(1)} uphill penalty = {route.metrics.terrainCost.toFixed(1)} cost units. These are search weights, not meters traveled.</p><p>Slope limit {settings.maxSlopeDeg}°; speed {settings.speedMps} m/s; {settings.exclusions.length} declared exclusions. Nodata and terrain limits block cells; exclusion influence on a particular detour has not been isolated with a counterfactual search.</p></details>
    <p className="caption">Profiles show outbound terrain at 5 m grid posts. Terrain slope is the conservative local surface gradient; directed route grade is a different quantity. Return-inclusive differences: {delta(change.roundTripS/60)} min and {delta(change.doseMicroGy,3)} µGy detector proxy. Destination stop: {settings.dwellMin??0} min. Conditions are evaluated after terrain search.</p>
  </section>;
}
