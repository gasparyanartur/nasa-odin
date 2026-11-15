import {type ExpeditionEvent} from './events';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Alternative, Exclusion, Point, Pose, TerrainData } from './data';
import { geoToLocal, sample } from './data';
import { SCIENCE, type GeologySettings } from '../datasets/geology';
import { OVERLAYS, type OverlaySettings } from '../datasets/catalog';

import { anchor, colorFor, type FieldRecord } from '../field/model';

import { FULL_MAP, boundViewport, zoomViewport, mapPoint, type MapViewport } from './mapViewport';
import { colorAt, layerRange, type ScalarLayer } from '../environment/model';

export type PickMode = 'inspect' | 'start' | 'goal' | 'exclude' | 'field';
interface Props {
  imagery?:'colour'|'grey';
  traces?:{id:string;label:string;points:Point[];color:string;dashed?:boolean}[];events?:ExpeditionEvent[];
  environmentLayer?:ScalarLayer; environmentOpacity?:number;
  mapLabel?:string; fields?:FieldRecord[]; selectedField?:string; onFieldSelect?:(id:string)=>void; draft?:FieldRecord; active?:boolean; geology?: GeologySettings; targetId?:string; onTargetSelect?:(id:string)=>void; highlightedEdge?:number;
  data: TerrainData; start: Point; goal?: Point; routes?: Alternative[]; selected: number;
  pose?: Pose; exclusions: Exclusion[]; overlays: OverlaySettings;
  mode?: PickMode; onPick?: (p: Point) => void; onInspect?: (p: Point) => void; mini?: boolean;
}

export default function SurfaceMap(p: Props) {
  const canvas=useRef<HTMLCanvasElement>(null),frame=useRef<HTMLDivElement>(null),tools=useRef<HTMLDivElement>(null);
  const [displaySize,setDisplaySize]=useState<number>();
  const [viewport,setViewport]=useState<MapViewport>(FULL_MAP);
  const current=useRef(viewport);current.current=viewport;
  const pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef({moved:false,start:{x:0,y:0}});
  const update=(v:MapViewport)=>{current.current=v;setViewport(v);};
  const [images,setImages]=useState<HTMLImageElement[]>([]);
  const [imageError,setImageError]=useState(false);
  useLayoutEffect(()=>{
    const el=frame.current,parent=el?.parentElement;if(!el||!parent||p.mini||p.active===false)return;
    let scheduled=0;
    const fit=()=>{
      if(!el.clientWidth)return;
      const width=el.clientWidth-2,controls=tools.current?.offsetHeight??64;
      const constrained=['auto','scroll'].includes(getComputedStyle(parent).overflowY);
      // Use the unscrolled content position, so panning/scrolling never resizes the map.
      const top=constrained?el.getBoundingClientRect().top+parent.scrollTop+window.scrollY:(document.querySelector('.context-bar')?.getBoundingClientRect().bottom??0);
      const tablet=parent.closest('.tablet-device');
      const siblings=Array.from(parent.children).filter(node=>node!==el).reduce((sum,node)=>sum+(node as HTMLElement).offsetHeight,0);
      const available=tablet?parent.clientHeight-siblings-controls-60:window.innerHeight-top-controls-20;
      const side=Math.floor(Math.min(width,Math.max(Math.min(160,width),available)));
      setDisplaySize(previous=>previous===side?previous:side);
    };
    const schedule=()=>{cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(fit);};
    const observer=new ResizeObserver(schedule);observer.observe(parent);observer.observe(el);observer.observe(document.body);
    for(const sibling of parent.children)if(sibling!==el)observer.observe(sibling);
    if(tools.current)observer.observe(tools.current);
    window.addEventListener('resize',schedule);fit();
    return()=>{observer.disconnect();cancelAnimationFrame(scheduled);window.removeEventListener('resize',schedule);};
  },[p.active,p.mini,p.data]);
  useEffect(()=>{const el=canvas.current;if(!el||p.mini)return;const stop=(e:WheelEvent)=>e.preventDefault();el.addEventListener('wheel',stop,{passive:false});return()=>el.removeEventListener('wheel',stop);},[p.mini]);
  useEffect(() => {
    let active=true;setImages([]);setImageError(false);
    Promise.all(OVERLAYS.map(layer=>layer.file).map(file => new Promise<HTMLImageElement>((resolve,reject) => {
      const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=`${p.data.baseUrl}/${file==='ortho.jpg'&&p.imagery==='grey'&&p.data.meta.detail?'ortho-grey.jpg':file}`;
    }))).then(imgs => { if(active)setImages(imgs); }).catch(()=>{if(active)setImageError(true);});
    return()=>{active=false;};
  },[p.data.baseUrl,p.imagery]);
  useEffect(()=>{
    const el=canvas.current;
    if(!el||p.active===false)return;
    const ctx=el.getContext('2d')!;
    const size=800, half=p.data.meta.extentM/2;
    const pixel=(v:Point)=>[(v.x+half)/(2*half)*size,(half-v.y)/(2*half)*size];
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,size,size);ctx.setTransform(viewport.zoom,0,0,viewport.zoom,viewport.x*size,viewport.y*size);ctx.fillStyle='#4b463d';ctx.fillRect(0,0,size,size);
    OVERLAYS.forEach((layer,index)=>{const state=p.overlays[layer.id];if(state.visible&&images[index]){ctx.globalAlpha=state.opacity;ctx.drawImage(images[index],0,0,size,size);}});ctx.globalAlpha=1;
    if(p.mini&&p.pose){const[x,y]=pixel(p.pose),zoom=3;ctx.setTransform(zoom,0,0,zoom,size/2-x*zoom,size/2-y*zoom);ctx.clearRect(-size,-size,size*3,size*3);OVERLAYS.forEach((layer,index)=>{const state=p.overlays[layer.id];if(state.visible&&images[index]){ctx.globalAlpha=state.opacity;ctx.drawImage(images[index],0,0,size,size);}});ctx.globalAlpha=1;}
    if(p.environmentLayer){ctx.save();ctx.beginPath();ctx.rect(0,0,size,size);ctx.clip();ctx.globalAlpha=p.environmentOpacity??.65;const layer=p.environmentLayer,range=layerRange(layer);for(const s of layer.samples){if(s.value===null)continue;ctx.fillStyle=colorAt(s.value,range);if(s.bounds){const[w,south,e,n]=s.bounds;const a=pixel(geoToLocal(p.data.meta,w,n)),b=pixel(geoToLocal(p.data.meta,e,south));ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);}else{const q=pixel(geoToLocal(p.data.meta,s.lon,s.lat));if(q[0]<0||q[0]>size||q[1]<0||q[1]>size)continue;ctx.beginPath();ctx.arc(q[0],q[1],7/viewport.zoom,0,Math.PI*2);ctx.fill();}}ctx.restore();}
    if(p.geology?.visible&&!p.mini&&SCIENCE.regions[p.data.meta.regionId??'gale-bradbury']){
      ctx.save();const region=SCIENCE.regions[p.data.meta.regionId??'gale-bradbury']!;ctx.globalAlpha=p.geology.opacity;
      for(const unit of region.units)for(const polygon of unit.polygons){
        ctx.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const q=pixel(geoToLocal(p.data.meta,lon,lat));if(i===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);});ctx.closePath();}
        ctx.fillStyle=unit.color;ctx.fill('evenodd');
      }
      if(p.geology.contacts){ctx.strokeStyle='#18231e';ctx.lineWidth=2;for(const contact of region.contacts){ctx.setLineDash(contact.type.toLowerCase().includes('approx')?[8,5]:[]);for(const line of contact.lines){ctx.beginPath();line.forEach(([lon,lat],i)=>{const q=pixel(geoToLocal(p.data.meta,lon,lat));if(i===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);});ctx.stroke();}}}
      ctx.restore();
    }
    ctx.strokeStyle='#ffffff20';ctx.lineWidth=1;
    for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*100,0);ctx.lineTo(i*100,size);ctx.moveTo(0,i*100);ctx.lineTo(size,i*100);ctx.stroke();}
    if(p.data.evidence){
      ctx.save();
      for(const marker of p.data.evidence.markers){const[x,y]=pixel(marker);ctx.fillStyle='#b9dad7';ctx.fillRect(x-4,y-4,8,8);}
      ctx.restore();
    }
    for(const e of p.events??[]){
      const center=e.kind==='solar'?p.start:e.center,[x,y]=pixel(center),radius=e.radiusM/(2*half)*size;
      ctx.save();ctx.beginPath();
      if(e.kind==='solar')ctx.rect(0,0,size,size);
      ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle='#ef634c42';ctx.fill('evenodd');ctx.strokeStyle=e.kind==='solar'?'#9defbf':'#ff9b77';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    p.exclusions.forEach(e=>{const [x,y]=pixel(e);ctx.beginPath();ctx.arc(x,y,e.radius/(2*half)*size,0,Math.PI*2);ctx.fillStyle='#e46e5d70';ctx.fill();ctx.strokeStyle='#ffb49b';ctx.lineWidth=2;ctx.stroke();});
    p.routes?.forEach((route,i)=>{
      ctx.beginPath();route.points.forEach(([x,y],j)=>{const q=pixel({x,y});if(j===0)ctx.moveTo(...q as [number,number]);else ctx.lineTo(...q as [number,number]);});
      ctx.strokeStyle=i===p.selected?'#f7c383':'#70c5c0';ctx.lineWidth=i===p.selected?4:2;ctx.globalAlpha=i===p.selected?1:.65;ctx.stroke();ctx.globalAlpha=1;
    });
    for(const trace of p.traces??[]){
      ctx.save();ctx.beginPath();trace.points.forEach((point,i)=>{const[x,y]=pixel(point);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle=trace.color;ctx.lineWidth=trace.id==='current'?2:4;ctx.setLineDash(trace.id==='current'?[4,3]:trace.dashed?[6,4]:[]);ctx.stroke();ctx.restore();
    }
    if(p.highlightedEdge!==undefined&&p.routes?.[p.selected]){
      const route=p.routes[p.selected],a=route.points[p.highlightedEdge],b=route.points[p.highlightedEdge+1];
      if(a&&b){ctx.beginPath();const pa=pixel({x:a[0],y:a[1]}),pb=pixel({x:b[0],y:b[1]});ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.strokeStyle='#fff7d4';ctx.lineWidth=11;ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt';}
    }
    const markerScale=p.mini?2:800/(el.clientWidth||800)/viewport.zoom;
    if(!p.mini)for(const target of SCIENCE.targets.filter(t=>t.regionId===(p.data.meta.regionId??'gale-bradbury'))){const[x,y]=pixel(target.point);ctx.beginPath();ctx.arc(x,y,10*markerScale,0,Math.PI*2);ctx.fillStyle=target.id===p.targetId?'#ecd09c':'#26382e';ctx.fill();ctx.strokeStyle='#e4d2a2';ctx.lineWidth=2*markerScale;ctx.stroke();ctx.fillStyle=target.id===p.targetId?'#1c2922':'#ffe8b9';ctx.font=`bold ${11*markerScale}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(target.id==='rocknest'?'R':'Y',x,y);}
    for(const [label,v,color] of [['H',p.start,'#a9debd'],['D',p.goal,'#f4bc81']] as const){
      if(!v)continue;let[x,y]=pixel(v);
      if(p.mini&&p.pose){const[px,py]=pixel(p.pose),dx=(x-px)*3,dy=(y-py)*3,d=Math.hypot(dx,dy),ratio=Math.min(1,340/(d||1));x=px+dx*ratio/3;y=py+dy*ratio/3;}
      ctx.beginPath();ctx.arc(x,y,12*markerScale,0,Math.PI*2);ctx.fillStyle='#14201c';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2*markerScale;ctx.stroke();ctx.fillStyle=color;ctx.font=`bold ${13*markerScale}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y);
    }
    for(const record of [...(p.fields??[]).filter(r=>r.visible),...(p.draft?[p.draft]:[])]){
      if(!record.points.length)continue;
      const draft=record===p.draft,color=draft?'#fff6d5':colorFor(record.kind),scale=800/(el.clientWidth||800)/viewport.zoom;
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=(record.id===p.selectedField?3:2)*scale;ctx.setLineDash(draft?[6*scale,4*scale]:[]);
      if(record.kind==='unit'||record.kind==='contact'){
        ctx.beginPath();record.points.forEach((q,i)=>{const [x,y]=pixel(q);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
        if(record.kind==='unit'&&record.points.length>=3){ctx.closePath();ctx.fillStyle=color+'33';ctx.fill();}ctx.stroke();
      }
      if(record.kind==='obstacle'){const [x,y]=pixel(record.points[0]);ctx.beginPath();ctx.arc(x,y,(record.radiusM??40)/(2*half)*size,0,Math.PI*2);ctx.fillStyle=color+'22';ctx.fill();ctx.stroke();}
      if(draft)record.points.forEach(q=>{const[x,y]=pixel(q);ctx.beginPath();ctx.arc(x,y,4*scale,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
      const[x,y]=pixel(anchor(record));ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,11*scale,0,Math.PI*2);ctx.fillStyle='#15271e';ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font=`bold ${11*scale}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(draft?'+':'F',x,y);ctx.restore();
    }
    if(p.pose){const[x,y]=pixel(p.pose);ctx.save();ctx.translate(x,y);ctx.rotate(p.pose.heading);ctx.scale(markerScale,markerScale);ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(-9,10);ctx.lineTo(0,6);ctx.lineTo(9,10);ctx.closePath();ctx.fillStyle='#f3fff1';ctx.strokeStyle='#133330';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();}
    ctx.setTransform(1,0,0,1,0,0);
    if(!p.mini){const scale=800/(el.clientWidth||800),target=80*scale/size*p.data.meta.extentM/viewport.zoom,power=10**Math.floor(Math.log10(target)),meters=[1,2,5].map(n=>n*power).filter(n=>n<=target).pop()!,length=meters/p.data.meta.extentM*size*viewport.zoom;ctx.fillStyle='#111e1bd9';ctx.fillRect(8*scale,size-42*scale,125*scale,34*scale);ctx.fillStyle='#e9dfc9';ctx.font=`${10*scale}px monospace`;ctx.textAlign='left';ctx.fillText(`N ↑   ${meters} m`,16*scale,size-25*scale);ctx.fillRect(16*scale,size-17*scale,length,2*scale);}
  },[p,images,viewport,displaySize]);
  function normalized(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
  function select(at:{x:number;y:number}){
    const q=mapPoint(current.current,at,p.data.meta.extentM);if(!sample(p.data,q))return;
    p.onInspect?.(q);
    if(p.mode==='field'){p.onPick?.(q);return;}
    const tolerance=p.data.meta.extentM/current.current.zoom*24/(canvas.current?.clientWidth||800);
    const record=(!p.mode||p.mode==='inspect')?(p.fields??[]).filter(r=>r.visible).map(r=>({record:r,distance:Math.hypot(anchor(r).x-q.x,anchor(r).y-q.y)})).filter(r=>r.distance<tolerance).sort((a,b)=>a.distance-b.distance)[0]?.record:undefined;
    if(record&&p.onFieldSelect){p.onFieldSelect(record.id);return;}
    const target=!p.mode||p.mode==='inspect'?SCIENCE.targets.filter(t=>t.regionId===(p.data.meta.regionId??'gale-bradbury')).map(t=>({target:t,distance:Math.hypot(t.point.x-q.x,t.point.y-q.y)})).filter(t=>t.distance<tolerance).sort((a,b)=>a.distance-b.distance)[0]?.target:undefined;
    if(target&&p.onTargetSelect)p.onTargetSelect(target.id);else p.onPick?.(q);
  }
  return <div ref={frame} className={`surface-map ${p.mini?'mini':''}`}>
    <canvas ref={canvas} style={!p.mini&&displaySize?{width:displaySize,height:displaySize,marginInline:'auto'}:undefined} width={800} height={800} data-pick-mode={p.mode} data-highlighted-edge={p.highlightedEdge??''} data-zoom={viewport.zoom.toFixed(2)} role="img" tabIndex={p.mini?undefined:0} data-traces={(p.traces??[]).map(t=>t.id).join(',')} data-hazards={p.events?.length??0} aria-label={p.mini?'Astronaut minimap':p.mapLabel??'Gale terrain selection map'}
      onPointerDown={e=>{if(p.mini)return;e.currentTarget.setPointerCapture(e.pointerId);const at=normalized(e);if(!pointers.current.size)gesture.current={moved:false,start:at};else gesture.current.moved=true;pointers.current.set(e.pointerId,at);}}
      onPointerMove={e=>{
        if(p.mini)return;const at=normalized(e),old=pointers.current.get(e.pointerId);
        if(!old){if(e.pointerType==='mouse')p.onInspect?.(mapPoint(current.current,at,p.data.meta.extentM));return;}
        if(Math.hypot(at.x-gesture.current.start.x,at.y-gesture.current.start.y)*e.currentTarget.clientWidth>6)gesture.current.moved=true;
        const before=Array.from(pointers.current.values());pointers.current.set(e.pointerId,at);const after=Array.from(pointers.current.values());
        if(before.length===2){
          const center=(a:typeof before)=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}),a=center(before),b=center(after);
          const d=(a:typeof before)=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
          const v=zoomViewport(current.current,current.current.zoom*d(after)/(d(before)||1),a);
          update(boundViewport({...v,x:v.x+b.x-a.x,y:v.y+b.y-a.y}));
        }else if(gesture.current.moved)update(boundViewport({...current.current,x:current.current.x+at.x-old.x,y:current.current.y+at.y-old.y}));
      }}
      onPointerUp={e=>{if(p.mini)return;if(!gesture.current.moved&&pointers.current.size===1)select(normalized(e));pointers.current.delete(e.pointerId);}}
      onPointerCancel={e=>{pointers.current.delete(e.pointerId);gesture.current.moved=true;}}
      onLostPointerCapture={e=>pointers.current.delete(e.pointerId)}
      onWheel={e=>{if(p.mini)return;const r=e.currentTarget.getBoundingClientRect();update(zoomViewport(current.current,current.current.zoom*Math.exp(-e.deltaY*.002),{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}));}}
      onKeyDown={e=>{if(p.mini)return;if(e.key==='+'||e.key==='=')update(zoomViewport(current.current,current.current.zoom*1.5));else if(e.key==='-')update(zoomViewport(current.current,current.current.zoom/1.5));else if(e.key==='Home')update(FULL_MAP);else if(e.key==='Enter')select({x:.5,y:.5});else if(e.key.startsWith('Arrow'))update(boundViewport({...current.current,x:current.current.x+(e.key==='ArrowLeft'?.1:e.key==='ArrowRight'?-.1:0),y:current.current.y+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)}));else return;e.preventDefault();}} />
    {!p.mini&&<div ref={tools} className="map-tools" aria-label="Map navigation"><button title="Zoom into the local map; wheel scrolling also zooms around the cursor." aria-label="Zoom in local map" onClick={()=>update(zoomViewport(current.current,current.current.zoom*1.5))}>＋</button><output>{viewport.zoom.toFixed(1)}×</output><button aria-label="Zoom out local map" onClick={()=>update(zoomViewport(current.current,current.current.zoom/1.5))}>−</button><button title="Restore the complete prepared terrain footprint, north-up." onClick={()=>update(FULL_MAP)}>Full area</button><span>Drag · wheel / pinch zoom · click / tap · keys: arrows, +/−, Enter</span></div>}
    {!images.length&&<span className="image-warning" role={imageError?'alert':undefined}>{imageError?'Local imagery is unavailable. Restore the Gale assets and reload.':'Loading local imagery…'}</span>}
  </div>;
}
