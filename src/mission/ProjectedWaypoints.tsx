import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Point, TerrainData } from './data';
import { sample } from './data';

export interface SceneWaypoint extends Point { id:string; label:string }
// DOM labels are projected with the active camera, rather than estimated from heading.
export default function ProjectedWaypoints({data,points,elements}:{data:TerrainData;points:SceneWaypoint[];elements:Map<string,HTMLDivElement>}) {
  const world=useRef(new Vector3()),ndc=useRef(new Vector3()),forward=useRef(new Vector3()),delta=useRef(new Vector3());
  useFrame(({camera,size})=>{
    camera.getWorldDirection(forward.current);
    const labels:{x:number;y:number}[]=[];
    for(const p of points){
      const el=elements.get(p.id),terrain=sample(data,p);if(!el||!terrain)continue;
      world.current.set(p.x,terrain.elevation-data.meta.referenceElevationM+1.8,-p.y);
      delta.current.copy(world.current).sub(camera.position);
      ndc.current.copy(world.current).project(camera);
      const visible=delta.current.dot(forward.current)>0&&Math.abs(ndc.current.x)<.90&&Math.abs(ndc.current.y)<.88&&ndc.current.z>=-1&&ndc.current.z<=1;
      el.hidden=!visible;
      if(visible){
        const x=(ndc.current.x+1)*size.width/2,y=(1-ndc.current.y)*size.height/2;
        const clampX=(v:number)=>Math.max(85,Math.min(size.width-85,v));
        const minY=size.width<=700?280:150,maxY=Math.max(minY,size.height-(size.width<=700?330:270));
        const baseY=Math.max(minY,Math.min(maxY,y+30));
        let center=clampX(x),labelY=baseY,placed=false;
        // Place captions within the usable visor, alternating above/below and
        // then sideways. The projected diamond stays at the real scene point.
        for(const dx of [0,170,-170,340,-340]){
          if(placed)break;
          for(let row=0;row<16;row++){
            const dy=row===0?0:Math.ceil(row/2)*72*(row%2?1:-1),cy=baseY+dy,cx=clampX(x+dx);
            if(cy<minY||cy>maxY||labels.some(other=>Math.abs(other.x-cx)<164&&Math.abs(other.y-cy)<70))continue;
            center=cx;labelY=cy;placed=true;break;
          }
        }
        const offset=labelY-y-30;
        labels.push({x:center,y:labelY});
        const caption=el.querySelector<HTMLElement>('.waypoint-caption');
        if(caption){caption.style.left=`${15+center-x}px`;caption.style.setProperty('--label-offset',`${offset}px`);caption.style.setProperty('--anchor-offset',`${x-center}px`);caption.style.setProperty('--leader-top',`${Math.min(0,-offset)}px`);caption.style.setProperty('--leader-height',`${Math.abs(offset)}px`);}
        el.style.left=`${(ndc.current.x+1)*size.width/2}px`;el.style.top=`${(1-ndc.current.y)*size.height/2}px`;el.dataset.distance=String(Math.round(delta.current.length()));const distance=el.querySelector('small');if(distance)distance.textContent=`${Math.round(delta.current.length())} m`;}
    }
  });
  return null;
}
