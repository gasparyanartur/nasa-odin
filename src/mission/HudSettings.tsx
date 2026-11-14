import { useEffect, useState } from 'react';
import { SCIENCE } from '../datasets/geology';
import { GRAPHICS, lmstLabel, type GraphicsQuality } from './conditions';

export interface HudSettings {
  visor:boolean; waypoints:boolean; next:boolean; habitat:boolean; destination:boolean;
  science:string[]; marsTime:boolean; earthTime:boolean; minimap:boolean;
}
export const DEFAULT_HUD:HudSettings={visor:true,waypoints:true,next:true,habitat:true,destination:true,science:[],marsTime:true,earthTime:false,minimap:true};

export function MissionClocks({hour,historical,mars=true,earth=true}:{hour:number;historical:boolean;mars?:boolean;earth?:boolean}) {
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{if(!earth)return;setNow(new Date());const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[earth]);
  return <div className="mission-clocks" aria-label="Mission clocks">
    {mars&&<div><small>GALE · {historical?'HISTORICAL SCENARIO':'MANUAL SCENARIO'} · SOL {10+Math.floor(hour/24)}</small><strong data-testid="hud-lmst">{lmstLabel(hour%24)}</strong><span>Simulated site time · pauses outside the HUD</span></div>}
    {earth&&<div><small>LIVE EARTH UTC</small><time dateTime={now.toISOString()}>{now.toISOString().slice(11,19)}</time><span>{now.toISOString().slice(0,10)} · current real-world clock</span></div>}
  </div>;
}

export default function HudConfiguration({value,onChange,quality,onQuality,timeScale,onTimeScale}:{value:HudSettings;onChange:(s:HudSettings)=>void;quality:GraphicsQuality;onQuality:(q:GraphicsQuality)=>void;timeScale:number;onTimeScale:(s:number)=>void}) {
  const toggle=(key:Exclude<keyof HudSettings,'science'>,label:string,note?:string)=><label className="hud-setting"><input type="checkbox" aria-label={label} checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><span><strong>{label}</strong>{note&&<small>{note}</small>}</span></label>;
  return <section className="hud-configuration" aria-label="HUD configuration"><span className="eyebrow">TABLET / DISPLAY SETUP</span><h1>Your view of the surface.</h1><p className="subtle">Choose the navigation and time information in your visor. Display changes keep your route, position and mission clock.</p>
    <div className="configuration-grid"><fieldset><legend>Navigation</legend>{toggle('visor','Visor overlay','Compass and visor frame')}{toggle('minimap','HUD minimap')}{toggle('waypoints','Show waypoint markers','Camera-projected navigation labels')}
      <div className="waypoint-options">{toggle('next','Next route waypoint')}{toggle('habitat','Habitat waypoint')}{toggle('destination','Destination waypoint')}{SCIENCE.targets.map(t=><label className="hud-setting" key={t.id}><input type="checkbox" aria-label={`${t.name} waypoint`} checked={value.science.includes(t.id)} onChange={e=>onChange({...value,science:e.target.checked?[...value.science,t.id]:value.science.filter(id=>id!==t.id)})}/><span><strong>{t.name} waypoint</strong><small>Published rover visit area · navigation only</small></span></label>)}</div>
    </fieldset><fieldset><legend>Time displays</legend>{toggle('marsTime','Mars LMST on HUD','Gale site · historical Sol 10 anchor + simulated elapsed time')}{toggle('earthTime','Live Earth UTC on HUD','Current date/time, independent of the Mars scenario')}<p className="caption">These switches hide or show clocks. They do not change time. Set departure and historical conditions in Explore or Station History.</p>
      <label className="setup-select">Graphics quality<select aria-label="Graphics quality" value={quality} onChange={e=>onQuality(e.target.value as GraphicsQuality)}>{Object.entries(GRAPHICS).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label><label className="setup-select">Simulation pace<select aria-label="Simulation pace" value={timeScale} onChange={e=>onTimeScale(Number(e.target.value))}><option value={1}>1×</option><option value={5}>5×</option><option value={20}>20× demo</option></select></label><p className="caption">Pace changes movement and simulated time together, while walking. Lighting is illustrative.</p>
    </fieldset></div>
  </section>;
}
