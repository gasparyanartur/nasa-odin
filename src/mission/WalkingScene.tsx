import { useEffect, useRef, useState } from 'react';
import { SCIENCE } from '../datasets/geology';
import { anchor, colorFor, type FieldRecord } from '../field/model';
import type { HudSettings } from './HudSettings';
import { advanceWalk, type Alternative, type Point, type Pose, type Settings, type TerrainData } from './data';
import type { GraphicsQuality } from './conditions';
import { createSurface, type SurfaceEngine } from './surface/renderer';

interface Props {
  imagery:'colour'|'grey';onUnavailable:()=>void;fields:FieldRecord[];onFieldSelect:(id:string)=>void;hud:HudSettings;
  start:Point;goal:Point;next:Point;data:TerrainData;route:Alternative;settings:Settings;initialPose:Pose;
  timeScale:number;quality:GraphicsQuality;onPose:(p:Pose)=>void;onBlocked:(b:boolean)=>void;
}
export default function WalkingScene(p:Props){
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<SurfaceEngine|null>(null),latest=useRef(p);latest.current=p;
  const [locked,setLocked]=useState(false),[ready,setReady]=useState(false),[status,setStatus]=useState('Loading measured surface…'),[error,setError]=useState('');
  const labels=useRef(new Map<string,HTMLDivElement>());
  const points=[...(p.hud.waypoints?[
    ...(p.hud.next?[{...p.next,id:'next',label:'Next route waypoint'}]:[]),
    ...(p.hud.habitat?[{...p.start,id:'habitat',label:'Habitat'}]:[]),
    ...(p.hud.destination?[{...p.goal,id:'destination',label:'Destination'}]:[]),
    ...(p.data.evidence?.markers??[]).filter(m=>p.hud.science.includes(m.id)),
    ...SCIENCE.targets.filter(t=>t.regionId===(p.data.meta.regionId??'gale-bradbury')&&p.hud.science.includes(t.id)).map(t=>({...t.point,id:t.id,label:t.name})),
  ]:[]),...p.fields.filter(r=>r.visible).map(r=>({...anchor(r),id:`field-${r.id}`,label:r.title}))];
  const currentPoints=useRef(points);currentPoints.current=points;
  useEffect(()=>{
    const el=canvas.current!,controller=new AbortController();let disposed=false,frame=0,previous=0,send=0,ignoreMove=false,active=false;
    let pose={...latest.current.initialPose};const keys=new Set<string>();
    const isLocked=()=>document.pointerLockElement===el;
    const unlock=()=>{active=false;keys.clear();if(isLocked())document.exitPointerLock();};
    const changed=()=>{active=isLocked();setLocked(active);keys.clear();previous=performance.now();ignoreMove=isLocked();};
    const move=(e:MouseEvent)=>{if(!active||!isLocked())return;if(ignoreMove){ignoreMove=false;return;}pose.heading+=e.movementX*.002;pose.pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,(pose.pitch??-.12)-e.movementY*.002));};
    const click=()=>{if(!engine.current||error)return;try{void Promise.resolve(el.requestPointerLock()).catch(()=>setLocked(false));}catch{setLocked(false);}};
    const down=(e:KeyboardEvent)=>{if(e.code==='Escape'){unlock();return;}if(isLocked()&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}};
    const up=(e:KeyboardEvent)=>keys.delete(e.code),visibility=()=>{if(document.hidden)unlock();};
    document.addEventListener('pointerlockchange',changed);document.addEventListener('mousemove',move);document.addEventListener('visibilitychange',visibility);
    el.addEventListener('click',click);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',unlock);
    setReady(false);setError('');
    createSurface(el,p.data,controller.signal,p.quality,p.imagery,s=>{if(!disposed)setStatus(s);}).then(view=>{
      if(disposed){view.dispose();return;}engine.current=view;view.eye(pose);setReady(true);
      view.onLost(()=>{unlock();setReady(false);setError('The 3D display was interrupted. The mission is retained; return to the Tablet and reopen HUD to retry.');});
      const tick=(now:number)=>{
        if(disposed)return;
        const current=latest.current;
        if(active&&isLocked()){
          const dt=Math.max(0,(now-previous)/1000)*current.timeScale;
          const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
          const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
          const advanced=advanceWalk(current.data,pose,current.settings,pose.heading,forward,right,dt);pose={...advanced.pose,pitch:pose.pitch};
          send+=dt;if(send>.1){send=0;current.onPose({...pose});current.onBlocked(advanced.blocked);}
          view.eye(pose);
        }
        previous=now;
        // Caption placement is independent of each real projected diamond.
        const placed:{x:number;y:number}[]=[];
        for(const point of currentPoints.current){
          const label=labels.current.get(point.id);if(!label)continue;
          const projected=view.project(point);label.hidden=!projected.visible;if(!projected.visible)continue;
          const {sx:x,sy:y}=projected,w=el.clientWidth,h=el.clientHeight;
          const clampX=(v:number)=>Math.max(85,Math.min(w-85,v));
          const minY=w<=700?280:150,maxY=Math.max(minY,h-(w<=700?330:270)),baseY=Math.max(minY,Math.min(maxY,y+30));
          let center=clampX(x),labelY=baseY,done=false;
          for(const dx of [0,170,-170,340,-340]){if(done)break;for(let row=0;row<16;row++){const dy=row===0?0:Math.ceil(row/2)*72*(row%2?1:-1),cy=baseY+dy,cx=clampX(x+dx);if(cy<minY||cy>maxY||placed.some(q=>Math.abs(q.x-cx)<164&&Math.abs(q.y-cy)<70))continue;center=cx;labelY=cy;done=true;break;}}
          placed.push({x:center,y:labelY});const offset=labelY-y-30,caption=label.querySelector<HTMLElement>('.waypoint-caption');
          if(caption){caption.style.left=`${15+center-x}px`;caption.style.setProperty('--label-offset',`${offset}px`);caption.style.setProperty('--anchor-offset',`${x-center}px`);caption.style.setProperty('--leader-top',`${Math.min(0,-offset)}px`);caption.style.setProperty('--leader-height',`${Math.abs(offset)}px`);}
          label.style.left=`${x}px`;label.style.top=`${y}px`;label.dataset.distance=String(Math.round(projected.distance));const small=label.querySelector('small');if(small)small.textContent=`${Math.round(projected.distance)} m`;
        }
        frame=requestAnimationFrame(tick);
      };previous=performance.now();frame=requestAnimationFrame(tick);
    }).catch(e=>{if(!disposed&&e.name!=='AbortError')setError(`${e.message}. Your mission remains available on the Tablet.`);});
    return()=>{disposed=true;unlock();controller.abort();cancelAnimationFrame(frame);engine.current?.dispose();engine.current=null;document.removeEventListener('pointerlockchange',changed);document.removeEventListener('mousemove',move);document.removeEventListener('visibilitychange',visibility);el.removeEventListener('click',click);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',unlock);};
  },[p.data,p.imagery,p.quality]);
  useEffect(()=>{engine.current?.quality(p.quality);},[p.quality,ready]);
  useEffect(()=>{
    const view=engine.current;if(!view)return;const ids:string[]=[];
    const overlay=(id:string,kind:'line'|'polygon'|'points',points:Point[],color:string)=>{ids.push(id);view.overlay(id,kind,points,color);};
    if(p.data.evidence){overlay('rover-path','line',p.data.evidence.path,'#a5d8d0');overlay('drill-positions','points',p.data.evidence.markers,'#a5d8d0');}
    overlay('route','line',p.route.points.map(([x,y])=>({x,y})),'#ffe4a3');
    for(const r of p.fields.filter(r=>r.visible&&['unit','contact','obstacle'].includes(r.kind)&&!(r.kind==='obstacle'&&r.restrictTravel))){const points=r.kind==='obstacle'?Array.from({length:97},(_,i)=>({x:r.points[0].x+r.radiusM!*Math.cos(i/96*Math.PI*2),y:r.points[0].y+r.radiusM!*Math.sin(i/96*Math.PI*2)})):r.points;overlay(`field-${r.id}`,r.kind==='contact'?'line':'polygon',points,colorFor(r.kind));}
    p.settings.exclusions.forEach((e,i)=>overlay(`restriction-${i}`,'polygon',Array.from({length:97},(_,k)=>({x:e.x+e.radius*Math.cos(k/96*Math.PI*2),y:e.y+e.radius*Math.sin(k/96*Math.PI*2)})),'#ffaf85'));
    return()=>ids.forEach(id=>view.remove(id));
  },[ready,p.route,p.fields,p.settings.exclusions]);
  return <div className="walking-scene">
    <canvas className="surface-canvas" ref={canvas} aria-label="Measured surface simulator"/>
    {status&&<div className="surface-status" role="status">{status}</div>}
    {error&&<div className="scene-unavailable" role="alert"><p>{error}</p><button onClick={p.onUnavailable}>Open Tablet · keep mission</button></div>}
    <div className="projected-waypoints" aria-label="Scene waypoint projections">{points.map(point=><div hidden key={point.id} ref={el=>{if(el)labels.current.set(point.id,el);else labels.current.delete(point.id);}} className={`projected-waypoint waypoint-${point.id} ${point.id.startsWith('field-')?'field-waypoint':''}`} data-waypoint={point.id}><span aria-hidden="true">◇</span><div className="waypoint-caption">{point.id.startsWith('field-')?<button aria-label={`Inspect field record ${point.label}`} onClick={()=>{if(!locked)p.onFieldSelect(point.id.slice(6));}}>{point.label}</button>:<b>{point.label}</b>}<small/></div></div>)}</div>
    {ready&&!locked&&!error&&<div className="walk-instructions"><span className="eyebrow">MANUAL SURFACE EXCURSION</span><h2>Take the next step.</h2><p>Click the terrain to begin. WASD to walk, mouse to look.<br/>Esc pauses the simulation and releases the mouse.<br/>Then select a field marker to inspect its record.</p><span>Measured terrain · simulated astronaut · illustrative lighting</span></div>}
    {locked&&<div className="reticle" aria-hidden="true">＋</div>}
  </div>;
}
