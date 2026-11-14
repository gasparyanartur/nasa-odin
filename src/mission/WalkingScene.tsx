import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { BackSide, BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Line, LineBasicMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import ProjectedWaypoints, { type SceneWaypoint } from './ProjectedWaypoints';
import type { HudSettings } from './HudSettings';
import { SCIENCE } from '../datasets/geology';
import type { Alternative, Point, Pose, Settings, TerrainData } from './data';
import { advanceWalk, sample } from './data';
import { drawingRatio, type GraphicsQuality } from './conditions';
const CAMERA={near:.1,far:5000,fov:70};

function Ground({data}:{data:TerrainData}) {
  const geometry=useMemo(()=>{
    const {size:n,stepM:step,extentM:extent,referenceElevationM:base}=data.meta;
    const geo=new BufferGeometry(), vertices=new Float32Array(n*n*3), uv=new Float32Array(n*n*2);
    const indices=new Uint32Array((n-1)*(n-1)*6);let k=0;
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const i=r*n+c;vertices.set([c*step-extent/2,data.heights[i]-base,r*step-extent/2],i*3);uv.set([c/(n-1),1-r/(n-1)],i*2);
      if(r<n-1&&c<n-1&&data.valid[i]&&data.valid[i+1]&&data.valid[i+n]&&data.valid[i+n+1]){indices.set([i,i+n,i+1,i+1,i+n,i+n+1],k);k+=6;}
    }
    geo.setAttribute('position',new BufferAttribute(vertices,3));geo.setAttribute('uv',new BufferAttribute(uv,2));geo.setIndex(new BufferAttribute(indices.slice(0,k),1));geo.computeVertexNormals();return geo;
  },[data]);
  const [texture,setTexture]=useState<ReturnType<TextureLoader['load']>|null>(null);
  useEffect(()=>{
    let alive=true;const loader=new TextureLoader();const tex=loader.load(`${data.baseUrl}/ortho.jpg`,t=>{t.colorSpace=SRGBColorSpace;t.anisotropy=8;t.needsUpdate=true;if(alive)setTexture(t);});
    return()=>{alive=false;tex.dispose();};
  },[data.baseUrl]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial key={texture?.uuid??'loading'} map={texture} color={texture?'#d7a17b':'#b98261'} roughness={1}/></mesh>;
}

function Track({data,route}:{data:TerrainData;route:Alternative}) {
  const geometry=useMemo(()=>{
    const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(route.points.flatMap(([x,y,z])=>[x,z-data.meta.referenceElevationM+.4,-y]),3));return geo;
  },[data,route]);
  const line=useMemo(()=>new Line(geometry,new LineBasicMaterial({color:'#ffe4a3',transparent:true,opacity:.85})),[geometry]);
  useEffect(()=>()=>{geometry.dispose();line.material.dispose();},[geometry,line]);
  return <primitive object={line}/>;
}

function Walker({data,initialPose,settings,timeScale,onPose,onBlocked,onLock}:{data:TerrainData;initialPose:Pose;settings:Settings;timeScale:number;onPose:(p:Pose)=>void;onBlocked:(b:boolean)=>void;onLock:(b:boolean)=>void}) {
  const {camera,gl}=useThree();
  const pose=useRef({...initialPose}), keys=useRef(new Set<string>()), last=useRef(0),lastTick=useRef(0),active=useRef(false);
  useEffect(()=>{
    const element=gl.domElement;
    const isLocked=()=>document.pointerLockElement===element;
    const s=sample(data,pose.current)!;camera.position.set(pose.current.x,s.elevation-data.meta.referenceElevationM+1.7,-pose.current.y);
    camera.rotation.set(pose.current.pitch??-.12,-pose.current.heading,0,'YXZ');
    let ignoreNextMove=false;
    const lockChanged=()=>{const locked=isLocked();active.current=locked;if(locked){lastTick.current=performance.now();ignoreNextMove=true;}else keys.current.clear();onLock(locked);};
    const unlock=()=>{active.current=false;keys.current.clear();if(isLocked())document.exitPointerLock();};
    const move=(e:MouseEvent)=>{
      if(!active.current||!isLocked())return;
      // Discard the initial cursor recentering delta after taking pointer lock.
      if(ignoreNextMove){ignoreNextMove=false;return;}
      camera.rotation.y-=e.movementX*.002;
      camera.rotation.x=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,camera.rotation.x-e.movementY*.002));
    };
    const click=()=>{try{void Promise.resolve(element.requestPointerLock()).catch(()=>onLock(false));}catch{onLock(false);}};
    const down=(e:KeyboardEvent)=>{if(e.code==='Escape'){unlock();return;}if(isLocked()&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}};
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    const visibility=()=>{if(document.hidden)unlock();};
    document.addEventListener('pointerlockchange',lockChanged);document.addEventListener('mousemove',move);document.addEventListener('visibilitychange',visibility);
    element.addEventListener('click',click);window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',unlock);
    return()=>{unlock();document.removeEventListener('pointerlockchange',lockChanged);document.removeEventListener('mousemove',move);document.removeEventListener('visibilitychange',visibility);element.removeEventListener('click',click);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',unlock);};
  },[camera,gl,data,onLock]);
  useFrame(()=>{
    if(!active.current||document.pointerLockElement!==gl.domElement)return;
    const now=performance.now(),dt=Math.max(0,(now-lastTick.current)/1000)*timeScale;lastTick.current=now;
    const direction=camera.getWorldDirection(new Vector3()), heading=Math.atan2(direction.x,-direction.z);
    const k=keys.current, forward=Number(k.has('KeyW')||k.has('ArrowUp'))-Number(k.has('KeyS')||k.has('ArrowDown')),
      right=Number(k.has('KeyD')||k.has('ArrowRight'))-Number(k.has('KeyA')||k.has('ArrowLeft'));
    const advanced=advanceWalk(data,pose.current,settings,heading,forward,right,dt);
    pose.current={...advanced.pose,pitch:camera.rotation.x};
    const s=sample(data,pose.current);
    if(s)camera.position.set(pose.current.x,s.elevation-data.meta.referenceElevationM+1.7,-pose.current.y);
    last.current+=dt;
    if(last.current>.1){last.current=0;onPose({...pose.current});onBlocked(advanced.blocked);}
  });
  return null;
}

function MartianSky() {
  const uniforms=useMemo(()=>({zenith:{value:new Color('#8f685c')},horizon:{value:new Color('#d7ac8e')}}),[]);
  return <mesh><sphereGeometry args={[3800,32,16]}/><shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms} vertexShader={`varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`uniform vec3 zenith;uniform vec3 horizon;varying vec3 vDirection;void main(){float h=max(0.0,normalize(vDirection).y);gl_FragColor=vec4(mix(horizon,zenith,pow(h,0.65)),1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}/></mesh>;
}

class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="scene-unavailable" role="alert">The 3D scene could not start. Enable WebGL and return to the planner to retry.</div>:this.props.children;}
}

export default function WalkingScene(p:{hud:HudSettings;start:Point;goal:Point;next:Point;data:TerrainData;route:Alternative;settings:Settings;initialPose:Pose;timeScale:number;quality:GraphicsQuality;onPose:(p:Pose)=>void;onBlocked:(b:boolean)=>void}) {
  const [locked,setLocked]=useState(false);
  const elements=useRef(new Map<string,HTMLDivElement>());
  const points:SceneWaypoint[]=p.hud.waypoints?[
    ...(p.hud.next?[{...p.next,id:'next',label:'Next route waypoint'}]:[]),
    ...(p.hud.habitat?[{...p.start,id:'habitat',label:'Habitat'}]:[]),
    ...(p.hud.destination?[{...p.goal,id:'destination',label:'Destination'}]:[]),
    ...SCIENCE.targets.filter(t=>p.hud.science.includes(t.id)).map(t=>({...t.point,id:t.id,label:t.name})),
  ]:[];
  return <div className="walking-scene">
    <SceneBoundary><Canvas dpr={drawingRatio(p.quality,window.devicePixelRatio||1)} camera={CAMERA} gl={{antialias:true}} onCreated={({scene})=>{scene.background=new Color('#d7ac8e');}}>
      <MartianSky/><fog attach="fog" args={['#d7ac8e',450,2600]}/><hemisphereLight args={['#f2d2b4','#664b3d',1.3]}/><directionalLight color="#ffe1c0" position={[500,800,200]} intensity={1.6}/>
      <Suspense fallback={null}><Ground data={p.data}/><Track data={p.data} route={p.route}/></Suspense>
      <Walker {...p} onLock={setLocked}/><ProjectedWaypoints data={p.data} points={points} elements={elements.current}/>
      {p.settings.exclusions.map((e,i)=>{const s=sample(p.data,e);return s?<mesh key={i} position={[e.x,s.elevation-p.data.meta.referenceElevationM+.2,-e.y]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[e.radius-1,e.radius,64]}/><meshBasicMaterial color="#fa8064"/></mesh>:null;})}

    </Canvas></SceneBoundary>
    <div className="projected-waypoints" aria-label="Scene waypoint projections">{points.map(point=><div hidden key={point.id} ref={el=>{if(el)elements.current.set(point.id,el);else elements.current.delete(point.id);}} className={`projected-waypoint waypoint-${point.id}`} data-waypoint={point.id}><span aria-hidden="true">◇</span><div className="waypoint-caption"><b>{point.label}</b><small/></div></div>)}</div>
    {!locked&&<div className="walk-instructions"><span className="eyebrow">MANUAL SURFACE EXCURSION</span><h2>Take the next step.</h2><p>Click the terrain to begin. WASD to walk, mouse to look.<br/>Esc pauses the simulation and releases the mouse.</p><span>Measured terrain · simulated astronaut · illustrative lighting</span></div>}
    {locked&&<div className="reticle" aria-hidden="true">＋</div>}
  </div>;
}
