import { useEffect, useRef, useState } from 'react';
import type { Alternative, Exclusion, Point, Pose, TerrainData } from './data';
import { sample } from './data';

export type PickMode = 'inspect' | 'start' | 'goal' | 'exclude';
interface Props {
  data: TerrainData; start: Point; goal: Point; routes?: Alternative[]; selected: number;
  pose?: Pose; exclusions: Exclusion[]; slope: boolean; elevation: boolean;
  mode?: PickMode; onPick?: (p: Point) => void; onInspect?: (p: Point) => void; mini?: boolean;
}

export default function SurfaceMap(p: Props) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [images,setImages]=useState<HTMLImageElement[]>([]);
  const [imageError,setImageError]=useState(false);
  useEffect(() => {
    let active=true;
    Promise.all(['ortho.jpg','slope.png','elevation.png'].map(file => new Promise<HTMLImageElement>((resolve,reject) => {
      const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=`/gale/${file}`;
    }))).then(imgs => { if(active)setImages(imgs); }).catch(()=>{if(active)setImageError(true);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    const el=canvas.current;
    if(!el)return;
    const ctx=el.getContext('2d')!;
    const size=800, half=p.data.meta.extentM/2;
    const pixel=(v:Point)=>[(v.x+half)/(2*half)*size,(half-v.y)/(2*half)*size];
    ctx.clearRect(0,0,size,size);ctx.fillStyle='#4b463d';ctx.fillRect(0,0,size,size);
    if(images[0])ctx.drawImage(images[0],0,0,size,size);
    if(p.elevation&&images[2])ctx.drawImage(images[2],0,0,size,size);
    if(p.slope&&images[1])ctx.drawImage(images[1],0,0,size,size);
    ctx.strokeStyle='#ffffff20';ctx.lineWidth=1;
    for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*100,0);ctx.lineTo(i*100,size);ctx.moveTo(0,i*100);ctx.lineTo(size,i*100);ctx.stroke();}
    p.exclusions.forEach(e=>{const [x,y]=pixel(e);ctx.beginPath();ctx.arc(x,y,e.radius/(2*half)*size,0,Math.PI*2);ctx.fillStyle='#e46e5d70';ctx.fill();ctx.strokeStyle='#ffb49b';ctx.lineWidth=2;ctx.stroke();});
    p.routes?.forEach((route,i)=>{
      ctx.beginPath();route.points.forEach(([x,y],j)=>{const q=pixel({x,y});if(j===0)ctx.moveTo(...q as [number,number]);else ctx.lineTo(...q as [number,number]);});
      ctx.strokeStyle=i===p.selected?'#f7c383':'#70c5c0';ctx.lineWidth=i===p.selected?4:2;ctx.globalAlpha=i===p.selected?1:.65;ctx.stroke();ctx.globalAlpha=1;
    });
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
    <canvas ref={canvas} width={800} height={800} role="img" aria-label={p.mini?'Astronaut minimap':'Gale terrain selection map'}
      onPointerMove={e=>{if(!p.mini)p.onInspect?.(point(e));}}
      onClick={e=>{if(!p.mini){const q=point(e as unknown as React.PointerEvent<HTMLCanvasElement>);if(sample(p.data,q))p.onPick?.(q);}}} />
    {!images.length&&<span className="image-warning" role={imageError?'alert':undefined}>{imageError?'Local imagery is unavailable. Restore the Gale assets and reload.':'Loading local imagery…'}</span>}
  </div>;
}
