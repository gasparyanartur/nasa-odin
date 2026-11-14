import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial } from 'three';
import type { Exclusion, TerrainData } from '../mission/data';
import { sample } from '../mission/data';
import { colorFor, type FieldRecord } from './model';

// Densify in local meters so lines follow the same bilinear terrain as walking.
function Boundary({record,data}:{record:Pick<FieldRecord,'points'|'kind'|'radiusM'>;data:TerrainData}){
  const line=useMemo(()=>{
    let points=record.points;
    if(record.kind==='obstacle')points=Array.from({length:97},(_,i)=>({x:record.points[0].x+record.radiusM!*Math.cos(i/96*Math.PI*2),y:record.points[0].y+record.radiusM!*Math.sin(i/96*Math.PI*2)}));
    else if(record.kind==='unit')points=[...points,points[0]];
    const vertices:number[]=[];
    // Independent segments avoid bridging missing terrain.
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/data.meta.stepM));
      let previous:typeof a|undefined;
      for(let j=0;j<=steps;j++){
        const q={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps},s=sample(data,q);
        if(previous&&s){const prev=sample(data,previous);if(prev)vertices.push(previous.x,prev.elevation-data.meta.referenceElevationM+.3,-previous.y,q.x,s.elevation-data.meta.referenceElevationM+.3,-q.y);}
        previous=s?q:undefined;
      }
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
    // LineSegments are used below with this prepared geometry.
    return {geometry,material:new LineBasicMaterial({color:colorFor(record.kind),transparent:true,opacity:.85})};
  },[record,data]);
  useEffect(()=>()=>{line.geometry.dispose();line.material.dispose();},[line]);
  return <lineSegments geometry={line.geometry} material={line.material}/>;
}
export default function FieldGeometry({records,data}:{records:FieldRecord[];data:TerrainData}){
  return <group>{records.filter(r=>r.visible&&['unit','contact','obstacle'].includes(r.kind)&&!(r.kind==='obstacle'&&r.restrictTravel)).map(r=><Boundary key={r.id} record={r} data={data}/>)}</group>;
}

export function RestrictionBoundaries({exclusions,data}:{exclusions:Exclusion[];data:TerrainData}){const records=useMemo(()=>exclusions.map(e=>({kind:'obstacle' as const,points:[e],radiusM:e.radius})),[exclusions]);return <group>{records.map((record,i)=><Boundary key={i} record={record} data={data}/>)}</group>;}
