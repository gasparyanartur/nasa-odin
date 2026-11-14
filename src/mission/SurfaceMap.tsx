import { useEffect, useRef, useState } from 'react';
import type { Alternative, Exclusion, Point, Pose, TerrainData } from './data';
import { geoToLocal, sample } from './data';
import { SCIENCE, type GeologySettings } from '../datasets/geology';
import { OVERLAYS, type OverlaySettings } from '../datasets/catalog';

export type PickMode = 'inspect' | 'start' | 'goal' | 'exclude';
interface Props {
  geology?: GeologySettings; targetId?:string; onTargetSelect?:(id:string)=>void; highlightedEdge?:number;
  data: TerrainData; start: Point; goal: Point; routes?: Alternative[]; selected: number;
  pose?: Pose; exclusions: Exclusion[]; overlays: OverlaySettings;
  mode?: PickMode; onPick?: (p: Point) => void; onInspect?: (p: Point) => void; mini?: boolean;
}

export default function SurfaceMap(p: Props) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [images,setImages]=useState<HTMLImageElement[]>([]);
  const [imageError,setImageError]=useState(false);
  useEffect(() => {
    let active=true;setImages([]);setImageError(false);
    Promise.all(OVERLAYS.map(layer=>layer.file).map(file => new Promise<HTMLImageElement>((resolve,reject) => {
      const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=`${p.data.baseUrl}/${file}`;
    }))).then(imgs => { if(active)setImages(imgs); }).catch(()=>{if(active)setImageError(true);});
    return()=>{active=false;};
  },[p.data.baseUrl]);
  useEffect(()=>{
    const el=canvas.current;
    if(!el)return;
    const ctx=el.getContext('2d')!;
    const size=800, half=p.data.meta.extentM/2;
    const pixel=(v:Point)=>[(v.x+half)/(2*half)*size,(half-v.y)/(2*half)*size];
    ctx.clearRect(0,0,size,size);ctx.fillStyle='#4b463d';ctx.fillRect(0,0,size,size);
    OVERLAYS.forEach((layer,index)=>{const state=p.overlays[layer.id];if(state.visible&&images[index]){ctx.globalAlpha=state.opacity;ctx.drawImage(images[index],0,0,size,size);}});ctx.globalAlpha=1;
    if(p.geology?.visible&&!p.mini){
      ctx.save();const region=SCIENCE.regions['gale-bradbury'];ctx.globalAlpha=p.geology.opacity;
      for(const unit of region.units)for(const polygon of unit.polygons){
        ctx.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const q=pixel(geoToLocal(p.data.meta,lon,lat));if(i===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);});ctx.closePath();}
        ctx.fillStyle=unit.color;ctx.fill('evenodd');
      }
      if(p.geology.contacts){ctx.strokeStyle='#18231e';ctx.lineWidth=2;for(const contact of region.contacts){ctx.setLineDash(contact.type.toLowerCase().includes('approx')?[8,5]:[]);for(const line of contact.lines){ctx.beginPath();line.forEach(([lon,lat],i)=>{const q=pixel(geoToLocal(p.data.meta,lon,lat));if(i===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);});ctx.stroke();}}}
      ctx.restore();
    }
    ctx.strokeStyle='#ffffff20';ctx.lineWidth=1;
    for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*100,0);ctx.lineTo(i*100,size);ctx.moveTo(0,i*100);ctx.lineTo(size,i*100);ctx.stroke();}
    p.exclusions.forEach(e=>{const [x,y]=pixel(e);ctx.beginPath();ctx.arc(x,y,e.radius/(2*half)*size,0,Math.PI*2);ctx.fillStyle='#e46e5d70';ctx.fill();ctx.strokeStyle='#ffb49b';ctx.lineWidth=2;ctx.stroke();});
    p.routes?.forEach((route,i)=>{
      ctx.beginPath();route.points.forEach(([x,y],j)=>{const q=pixel({x,y});if(j===0)ctx.moveTo(...q as [number,number]);else ctx.lineTo(...q as [number,number]);});
      ctx.strokeStyle=i===p.selected?'#f7c383':'#70c5c0';ctx.lineWidth=i===p.selected?4:2;ctx.globalAlpha=i===p.selected?1:.65;ctx.stroke();ctx.globalAlpha=1;
    });
    if(p.highlightedEdge!==undefined&&p.routes?.[p.selected]){
      const route=p.routes[p.selected],a=route.points[p.highlightedEdge],b=route.points[p.highlightedEdge+1];
      if(a&&b){ctx.beginPath();const pa=pixel({x:a[0],y:a[1]}),pb=pixel({x:b[0],y:b[1]});ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.strokeStyle='#fff7d4';ctx.lineWidth=11;ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt';}
    }
    if(!p.mini)for(const target of SCIENCE.targets){const[x,y]=pixel(target.point);ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle=target.id===p.targetId?'#ecd09c':'#26382e';ctx.fill();ctx.strokeStyle='#e4d2a2';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=target.id===p.targetId?'#1c2922':'#ffe8b9';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(target.id==='rocknest'?'R':'Y',x,y);}
    for(const [label,v,color] of [['H',p.start,'#a9debd'],['D',p.goal,'#f4bc81']] as const){
      const[x,y]=pixel(v);ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fillStyle='#14201c';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=color;ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y);
    }
    if(p.pose){const[x,y]=pixel(p.pose);ctx.save();ctx.translate(x,y);ctx.rotate(p.pose.heading);ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(-9,10);ctx.lineTo(0,6);ctx.lineTo(9,10);ctx.closePath();ctx.fillStyle='#f3fff1';ctx.strokeStyle='#133330';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();}
    if(!p.mini){ctx.fillStyle='#111e1bd9';ctx.fillRect(22,746,142,33);ctx.fillStyle='#e9dfc9';ctx.font='14px monospace';ctx.textAlign='left';ctx.fillText('N ↑    250 m',32,763);}
  },[p,images]);
  function point(e:React.PointerEvent<HTMLCanvasElement>):Point{
    const r=e.currentTarget.getBoundingClientRect();const half=p.data.meta.extentM/2;
    return{x:(e.clientX-r.left)/r.width*half*2-half,y:half-(e.clientY-r.top)/r.height*half*2};
  }
  return <div className={`surface-map ${p.mini?'mini':''}`}>
    <canvas ref={canvas} width={800} height={800} data-highlighted-edge={p.highlightedEdge??''} role="img" aria-label={p.mini?'Astronaut minimap':'Gale terrain selection map'}
      onPointerMove={e=>{if(!p.mini)p.onInspect?.(point(e));}}
      onClick={e=>{if(!p.mini){const q=point(e as unknown as React.PointerEvent<HTMLCanvasElement>);if(sample(p.data,q)){const target=!p.mode||p.mode==='inspect'?SCIENCE.targets.find(t=>Math.hypot(t.point.x-q.x,t.point.y-q.y)<20):undefined;if(target&&p.onTargetSelect)p.onTargetSelect(target.id);else p.onPick?.(q);}}}} />
    {!images.length&&<span className="image-warning" role={imageError?'alert':undefined}>{imageError?'Local imagery is unavailable. Restore the Gale assets and reload.':'Loading local imagery…'}</span>}
  </div>;
}
