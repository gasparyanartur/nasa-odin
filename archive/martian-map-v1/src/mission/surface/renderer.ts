import { createScene3d } from './scene3d.js';
import { createTerrain, toUint16 } from './terrain.js';
import { sample, type Point, type Pose, type TerrainData } from '../data';
import type { GraphicsQuality } from '../conditions';
import { drawingRatio } from '../conditions';

export const projectedPoint=(p:Point,scale:{x:number;y:number})=>({x:p.x/scale.x,y:p.y/scale.y});
export const groundPoint=(p:Point,scale:{x:number;y:number})=>({x:p.x*scale.x,y:p.y*scale.y});
export interface SurfaceEngine {
  eye(p:Pose):void; project(p:Point):{visible:boolean;sx:number;sy:number;distance:number};
  overlay(id:string,kind:'line'|'polygon'|'points',points:Point[],color:string,pattern?:'diagonal'|'cross'):void;
  remove(id:string):void; quality(q:GraphicsQuality):void; dispose():void;
  onLost(fn:()=>void):()=>void; stats():unknown;
}

export async function createSurface(canvas:HTMLCanvasElement,data:TerrainData,signal:AbortSignal,quality:GraphicsQuality,imagery:'colour'|'grey',progress:(s:string)=>void):Promise<SurfaceEngine>{
  const bitmaps:ImageBitmap[]=[];
  const get=async(path:string)=>{const r=await fetch(path,{signal});if(!r.ok)throw new Error(`Surface asset unavailable: ${path}`);return r;};
  const image=async(path:string)=>{const bitmap=await createImageBitmap(await (await get(path)).blob());if(signal.aborted){bitmap.close();throw new DOMException('Aborted','AbortError');}bitmaps.push(bitmap);return bitmap;};
  let native:ReturnType<typeof createScene3d>|undefined;
  try{
    progress('Loading measured terrain…');
    let scene:any,terrain:any,scale={x:1,y:1},overview:ImageBitmap;
    if(data.meta.detail){
      const base=data.meta.detail.baseUrl;
      scene=await (await get(`${base}/scene.json`)).json();scale=scene.ground_scale;
      const buffers=await Promise.all([get(`${base}/${scene.core.dem}`).then(r=>r.arrayBuffer()),get(`${base}/${scene.surround.dem}`).then(r=>r.arrayBuffer())]);
      terrain=createTerrain(scene,{core:toUint16(buffers[0],scene.core.dem_samples**2,'core'),surround:toUint16(buffers[1],scene.surround.dem_samples**2,'surround')});
      overview=await image(`${base}/${scene.imagery[imagery].overview}`);
    }else{
      const m=data.meta,n=m.size;
      const core=Float32Array.from(data.heights,(z,i)=>data.valid[i]?z:-32767);
      scene={core:{size_m:m.extentM,dem_samples:n,tiles:[['ortho.jpg']],slope_cells:n-1},surround:{size_m:m.extentM,dem_samples:n},height:{offset_m:0,scale_m:1,nodata:-32767},ground_scale:scale};
      terrain={core,surround:core,heightAt:(x:number,y:number)=>sample(data,{x,y})?.elevation??null};
      overview=await image(`${data.baseUrl}/ortho.jpg`);
    }
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    native=createScene3d(canvas,{scene,terrain,textures:{overview},sky:'#c6a58a',background:'#17231f',maxPixelRatio:2,adaptiveDisplay:!!data.meta.detail,lowDetail:quality==='low'||(!!data.meta.detail&&quality==='medium')});
    const renderer=native;
    renderer.setView('walk');renderer.setHillshade(true);renderer.setDrawingRatio(drawingRatio(quality,devicePixelRatio||1));
    let disposed=false;
    const engine:SurfaceEngine={
      eye(p){const q=projectedPoint(p,scale);renderer.setEye({...q,heading_deg:p.heading*180/Math.PI,pitch_deg:(p.pitch??-.12)*180/Math.PI});},
      project(p){const q=projectedPoint(p,scale);return renderer.projectNavigation(q.x,q.y);},
      overlay(id,kind,points,color,pattern='diagonal'){renderer.setOverlay(id,{kind,coords:points.map(p=>{const q=projectedPoint(p,scale);return[q.x,q.y];}),style:{color,casing:'#17231f',casing_px:0,width_px:2,size_px:7,pattern,hatch_color:color}});},
      remove:id=>renderer.setOverlay(id,null),
      quality:q=>renderer.setDrawingRatio(drawingRatio(q,devicePixelRatio||1)),
      onLost:fn=>renderer.onContextLost(fn),stats:()=>renderer.getStats(),
      dispose(){if(disposed)return;disposed=true;renderer.dispose();bitmaps.forEach(b=>b.close());},
    };
    // Overview gives immediate context; detail arrives without changing the camera or mission.
    if(data.meta.detail){
      const base=data.meta.detail.baseUrl,cfg=scene.imagery[imagery];
      progress('Loading detailed imagery…');
      void (async()=>{
        const surround=await image(`${base}/${cfg.surround}`);if(disposed)return;renderer.setCoreTile('surround',surround);
        const half=await image(`${base}/${cfg.half_res}`);if(disposed)return;renderer.setCoreTile('core_half',half);
        if(quality==='high')for(let r=0;r<cfg.tiles.length;r++)for(let c=0;c<cfg.tiles[r].length;c++){
          const bitmap=await image(`${base}/${cfg.tiles[r][c]}`);if(disposed)return;renderer.setCoreTile(`core_${r}_${c}`,bitmap);
        }
        progress('');
      })().catch(e=>{if(!disposed&&!signal.aborted)progress(`Detailed imagery could not finish: ${e.message}. Reopen HUD to retry; the overview and mission remain available.`);});
    }else{renderer.setCoreTile('core_0_0',overview);progress('');}
    return engine;
  }catch(e){native?.dispose();bitmaps.forEach(b=>b.close());throw e;}
}
