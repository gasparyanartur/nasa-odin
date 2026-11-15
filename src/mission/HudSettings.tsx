import Help from '../Help';
import { useEffect, useState } from 'react';
import type { TerrainData } from './data';
import { SCIENCE } from '../datasets/geology';
import { GRAPHICS, lmstLabel, type GraphicsQuality } from './conditions';

export interface HudSettings {
  visor:boolean; waypoints:boolean; next:boolean; habitat:boolean; destination:boolean;
  science:string[]; marsTime:boolean; earthTime:boolean; minimap:boolean;
}
export const DEFAULT_HUD:HudSettings={visor:true,waypoints:true,next:true,habitat:true,destination:true,science:[],marsTime:true,earthTime:false,minimap:true};

export function MissionClocks({hour,historical,mars=true,earth=true,sol=10}:{hour:number;historical:boolean;mars?:boolean;earth?:boolean;sol?:number}) {
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{if(!earth)return;setNow(new Date());const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[earth]);
  return <div className="mission-clocks" aria-label="Mission clocks">
    {mars&&<div><small>GALE · {historical?'HISTORICAL SCENARIO':'MANUAL SCENARIO'} · SOL {sol+Math.floor(hour/24)}</small><strong data-testid="hud-lmst">{lmstLabel(hour%24)}</strong><span>Simulated site time · pauses outside the HUD</span></div>}
    {earth&&<div><small>LIVE EARTH UTC</small><time dateTime={now.toISOString()}>{now.toISOString().slice(11,19)}</time><span>{now.toISOString().slice(0,10)} · current real-world clock</span></div>}
  </div>;
}

export default function HudConfiguration({value,onChange,quality,onQuality,timeScale,onTimeScale,regionId='gale-bradbury',sol=10,data}:{data?:TerrainData;regionId?:string;sol?:number;value:HudSettings;onChange:(s:HudSettings)=>void;quality:GraphicsQuality;onQuality:(q:GraphicsQuality)=>void;timeScale:number;onTimeScale:(s:number)=>void}) {
  const toggle=(key:Exclude<keyof HudSettings,'science'>,label:string,note?:string)=><label className="hud-setting"><input type="checkbox" aria-label={label} checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><span><strong>{label}</strong>{note&&<small>{note}</small>}</span></label>;
  return <section className="hud-configuration" aria-label="HUD configuration"><span className="eyebrow">TABLET / DISPLAY SETUP</span><h1>Your view of the surface.</h1><p className="subtle">Choose the navigation and time information in your visor. Display changes keep your route, position and mission clock.</p>
    <div className="configuration-grid"><fieldset><legend>Navigation <Help label="About visor navigation">The compass shows heading from true north; the round minimap stays north-up. H is habitat, D destination and the arrow your position and heading. Far markers stay at the map rim. Waypoints are projected into your scene view.</Help></legend>{toggle('visor','Visor overlay','Compass and visor frame')}{toggle('minimap','HUD minimap','Round local map · north-up · distant markers at rim')}{toggle('waypoints','Show waypoint markers','Camera-projected navigation labels')}
      <div className="waypoint-options">{toggle('next','Next route waypoint','Next point along planned outbound or return guidance')}{toggle('habitat','Habitat waypoint','Your configured start and return location')}{toggle('destination','Destination waypoint','The active guided destination, only when a route exists')}{SCIENCE.targets.filter(t=>t.regionId===regionId).map(t=><label className="hud-setting" key={t.id}><input type="checkbox" aria-label={`${t.name} waypoint`} checked={value.science.includes(t.id)} onChange={e=>onChange({...value,science:e.target.checked?[...value.science,t.id]:value.science.filter(id=>id!==t.id)})}/><span><strong>{t.name} waypoint</strong><small>Published rover visit area · navigation only</small></span></label>)}{data?.evidence?.markers.map(m=><label className="hud-setting" key={m.id}><input type="checkbox" aria-label={`${m.label} waypoint`} checked={value.science.includes(m.id)} onChange={e=>onChange({...value,science:e.target.checked?[...value.science,m.id]:value.science.filter(id=>id!==m.id)})}/><span><strong>{m.label} waypoint</strong><small>{m.note}</small></span></label>)}</div>
    </fieldset><fieldset><legend>Time displays <Help label="About mission clocks">LMST means local mean solar time at the Mars site. Sol is a Mars day. The scenario clock advances with simulated elapsed time and pauses outside the running HUD; Earth UTC is the live real-world date and time.</Help></legend>{toggle('marsTime','Mars LMST on HUD',`Gale site · historical Sol ${sol} anchor + simulated elapsed time`)}{toggle('earthTime','Live Earth UTC on HUD','Current date/time, independent of the Mars scenario')}<p className="caption">These switches hide or show clocks. They do not change time. Set departure and historical conditions in Explore or Station History.</p>
      <label className="setup-select">Graphics quality<select aria-label="Graphics quality" value={quality} onChange={e=>onQuality(e.target.value as GraphicsQuality)}>{Object.entries(GRAPHICS).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label><label className="setup-select">Simulation pace<select aria-label="Simulation pace" value={timeScale} onChange={e=>onTimeScale(Number(e.target.value))}><option value={1}>1×</option><option value={5}>5×</option><option value={20}>20× demo</option></select></label><p className="caption">Pace changes movement and simulated time together, while walking. Boxwork High uses full 1 m terrain / 0.25 m imagery; Medium uses a 2 m display mesh / 0.5 m imagery. Software graphics may use a 4 m display mesh. Routing and movement retain the same analytical grid. Lighting is illustrative.</p>
    </fieldset></div>
  </section>;
}
