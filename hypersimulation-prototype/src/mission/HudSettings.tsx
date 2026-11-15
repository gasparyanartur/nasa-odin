import Help from '../Help';
import { useEffect, useState, type ReactNode } from 'react';
import type { TerrainData } from './data';
import { SCIENCE } from '../datasets/geology';
import { GRAPHICS, lmstLabel, type GraphicsQuality } from './conditions';
import InfoMark from '../design/InfoMark';
import { Icon, type IconName } from '../design/icons';

export interface HudSettings {
  visor:boolean; waypoints:boolean; next:boolean; habitat:boolean; destination:boolean;
  science:string[]; marsTime:boolean; earthTime:boolean; minimap:boolean;
}
export const DEFAULT_HUD:HudSettings={visor:true,waypoints:true,next:true,habitat:true,destination:true,science:[],marsTime:true,earthTime:false,minimap:true};

/** compact: the helmet form, a pictogram and the value; the labels stay for assistive technology. */
export function MissionClocks({hour,historical,mars=true,earth=true,sol=10,compact=false}:{hour:number;historical:boolean;mars?:boolean;earth?:boolean;sol?:number;compact?:boolean}) {
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{if(!earth)return;setNow(new Date());const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[earth]);
  return <div className={`mission-clocks ${compact?'compact':''}`} aria-label="Mission clocks">
    {mars&&<div>{compact&&<Icon name="sun"/>}<small>GALE · {historical?'HISTORICAL SCENARIO':'MANUAL SCENARIO'} · SOL {sol+Math.floor(hour/24)}</small><strong data-testid="hud-lmst">{lmstLabel(hour%24)}</strong>{compact&&<b className="clock-word" aria-hidden="true">Sol {sol+Math.floor(hour/24)}</b>}<span>Simulated site time · pauses outside the HUD</span></div>}
    {earth&&<div>{compact&&<Icon name="clock"/>}<small>LIVE EARTH UTC</small><time dateTime={now.toISOString()}>{now.toISOString().slice(11,19)}</time>{compact&&<b className="clock-word" aria-hidden="true">UTC</b>}<span>{now.toISOString().slice(0,10)} · current real-world clock</span></div>}
  </div>;
}

export default function HudConfiguration({value,onChange,quality,onQuality,timeScale,onTimeScale,regionId='gale-bradbury',sol=10,data}:{data?:TerrainData;regionId?:string;sol?:number;value:HudSettings;onChange:(s:HudSettings)=>void;quality:GraphicsQuality;onQuality:(q:GraphicsQuality)=>void;timeScale:number;onTimeScale:(s:number)=>void}) {
  const row=(control:ReactNode,info:ReactNode,key?:string)=><div className="setting-row" key={key}>{control}{info}</div>;
  const toggle=(key:Exclude<keyof HudSettings,'science'>,label:string,icon:IconName,note:string|undefined,does:string)=>row(<label className="hud-setting"><input type="checkbox" aria-label={label} checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><Icon name={icon}/><span><strong>{label}</strong>{note&&<small>{note}</small>}</span></label>,<InfoMark title={label} does={does}/>);
  return <section className="hud-configuration" data-tour="display-helmet" aria-label="HUD configuration"><span className="eyebrow">TABLET / DISPLAY SETUP</span><h1>Your view of the surface.</h1><p className="subtle">Choose the navigation and time information in your visor. Display changes keep your route, position and mission clock.</p>
    <div className="configuration-grid"><fieldset><legend>Navigation <Help label="About visor navigation">The compass shows heading from true north; the round minimap stays north-up. H is habitat, D destination and the arrow your position and heading. Far markers stay at the map rim. Waypoints are projected into your scene view.</Help></legend>
      {toggle('visor','Visor overlay','helmet','Compass and visor frame','Draws the thin helmet outline and the compass strip at the top of the helmet view. Off leaves the terrain with no visor marks.')}
      {toggle('minimap','HUD minimap','area',undefined,'The round map at the top right of the helmet: north up, your position and heading, the habitat and a selected route.')}
      {toggle('waypoints','Show waypoint markers','flag','Camera-projected navigation labels','Places markers in the 3D scene where the chosen points are. The switches below pick which points get one.')}
      <div className="waypoint-options">
        {toggle('next','Next route waypoint','next',undefined,'Marks the next point of the selected route. Shown only while a route is guided.')}
        {toggle('habitat','Habitat waypoint','station',undefined,'Marks the habitat, where the excursion starts and where the return estimate leads.')}
        {toggle('destination','Destination waypoint','place',undefined,'Marks the destination of the selected route.')}
        {SCIENCE.targets.filter(t=>t.regionId===regionId).map(t=>row(<label className="hud-setting"><input type="checkbox" aria-label={`${t.name} waypoint`} checked={value.science.includes(t.id)} onChange={e=>onChange({...value,science:e.target.checked?[...value.science,t.id]:value.science.filter(id=>id!==t.id)})}/><Icon name="drill"/><span><strong>{t.name} waypoint</strong><small>Published rover visit area · navigation only</small></span></label>,<InfoMark title={`${t.name} marker`} does="Marks this published rover visit area in the helmet view, for navigation only." source={t.question}/>,t.id))}
        {data?.evidence?.markers.map(m=>row(<label className="hud-setting"><input type="checkbox" aria-label={`${m.label} waypoint`} checked={value.science.includes(m.id)} onChange={e=>onChange({...value,science:e.target.checked?[...value.science,m.id]:value.science.filter(id=>id!==m.id)})}/><Icon name="photo"/><span><strong>{m.label} waypoint</strong><small>{m.note}</small></span></label>,<InfoMark title={`${m.label} marker`} does="Marks this rover evidence point in the helmet view." source={m.note}/>,m.id))}
      </div>
    </fieldset><fieldset><legend>Time displays <Help label="About mission clocks">LMST means local mean solar time at the Mars site. Sol is a Mars day. The scenario clock advances with simulated elapsed time and pauses outside the running HUD; Earth UTC is the live real-world date and time.</Help></legend>
      {toggle('marsTime','Mars LMST on HUD','sun',`Gale site · historical Sol ${sol} anchor + simulated elapsed time`,'Shows local mean solar time at the site in the helmet. It is a simulated clock that pauses outside the HUD.')}
      {toggle('earthTime','Live Earth UTC on HUD','clock','Current date/time, independent of the Mars scenario','Shows the current real-world UTC time in the helmet, independent of the Mars scenario.')}
      <p className="caption">These switches hide or show clocks. They do not change time. Set departure and historical conditions in Explore or Station History.</p>
      {row(<label className="setup-select">Graphics quality<select aria-label="Graphics quality" value={quality} onChange={e=>onQuality(e.target.value as GraphicsQuality)}>{Object.entries(GRAPHICS).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label>,<InfoMark title="Graphics detail" does="Sets the detail of the 3D display mesh and imagery. Routing and movement keep the same analytical grid." coverage="Boxwork High uses full 1 m terrain / 0.25 m imagery; Medium uses a 2 m display mesh / 0.5 m imagery. Software graphics may use a 4 m display mesh."/>)}
      {row(<label className="setup-select">Simulation pace<select aria-label="Simulation pace" data-tour="simulation-pace" value={timeScale} onChange={e=>onTimeScale(Number(e.target.value))}><option value={1}>1×</option><option value={5}>5×</option><option value={20}>20× demo</option></select></label>,<InfoMark title="Pace" does="Speeds up movement and simulated time together, while walking."/>)}
      <p className="caption">Pace changes movement and simulated time together, while walking. Boxwork High uses full 1 m terrain / 0.25 m imagery; Medium uses a 2 m display mesh / 0.5 m imagery. Software graphics may use a 4 m display mesh. Routing and movement retain the same analytical grid. Lighting is illustrative.</p>
    </fieldset></div>
  </section>;
}
