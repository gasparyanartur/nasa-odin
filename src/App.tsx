import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import GlobeExplorer from './GlobeExplorer';
import SurfaceMap, { type PickMode } from './mission/SurfaceMap';
import { BASEMAPS, OVERLAYS, canPlan, defaultOverlays, getRegion, type RegionId, type OverlayId, type OverlaySettings } from './datasets/catalog';
const WalkingScene = lazy(() => import('./mission/WalkingScene'));
import { api, loadTerrain, localToGeo, routeProgress, sample, type Alternative, type Point, type Pose, type ReturnResult, type RouteResult, type Settings, type TerrainData } from './mission/data';

const HOME={x:0,y:0}, GOAL={x:600,y:450};
const defaults:Settings={speedMps:.8,maxSlopeDeg:20,maxDurationMin:90,doseRateMicroGyH:10,maxDoseMicroGy:50,temperatureK:220,minTemperatureK:180,windMps:0,maxWindMps:25,exclusions:[]};
const duration=(s:number)=>`${Math.ceil(s/60)} min`;
const distance=(m:number)=>m>=1000?`${(m/1000).toFixed(2)} km`:`${Math.round(m)} m`;

export default function App(){
  const [selectedRegionId,setSelectedRegionId]=useState<RegionId>();
  const region=getRegion(selectedRegionId);
  const [basemap,setBasemap]=useState(BASEMAPS[0]),[basemapVisible,setBasemapVisible]=useState(true),[basemapOpacity,setBasemapOpacity]=useState(1);
  const [overlays,setOverlays]=useState(defaultOverlays),[conditionsVisible,setConditionsVisible]=useState(true);
  const slope=overlays.slope.visible,elevation=overlays.elevation.visible;
  function changeOverlay(id:OverlayId,patch:Partial<OverlaySettings[OverlayId]>){setOverlays(previous=>({...previous,[id]:{...previous[id],...patch}}));}
  const [view,setView]=useState<'globe'|'plan'|'walk'>('globe');
  const [data,setData]=useState<TerrainData>(), [dataError,setDataError]=useState(''),[retry,setRetry]=useState(0);
  const [start,setStart]=useState<Point>(HOME),[goal,setGoal]=useState<Point>(GOAL),[settings,setSettings]=useState<Settings>(defaults);
  const [result,setResult]=useState<RouteResult>(),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [mode,setMode]=useState<PickMode>('inspect'),[inspection,setInspection]=useState<Point>(HOME);
  const [weatherHour,setWeatherHour]=useState(12);
  const [timeScale,setTimeScale]=useState(1);
  const [pose,setPose]=useState<Pose>({...HOME,heading:0,elapsed:0}),[blocked,setBlocked]=useState(false),[back,setBack]=useState<ReturnResult>(),[returnError,setReturnError]=useState('');
  const request=useRef<AbortController|null>(null),returnRequest=useRef<AbortController|null>(null),lastReturn=useRef<Point>({x:Infinity,y:Infinity});
  const route=result?.routes[selected];
  useEffect(()=>{
    setDataError('');
    if(!canPlan(region)){setData(undefined);return;}
    const c=new AbortController();
    loadTerrain(c.signal,region!.terrain!.baseUrl).then(d=>{
      if(c.signal.aborted)return;
      setData(d);const weather=d.environment.weather.find(w=>w.hour>=12&&w.temperatureK!==null)??d.environment.weather[0];
      setSettings(s=>({...s,doseRateMicroGyH:Number(d.environment.radiation.rateMicroGyH.toFixed(3)),temperatureK:weather?.temperatureK??220,windMps:weather?.windMps??0}));
    }).catch(e=>{if(e.name!=='AbortError')setDataError(e.message);});
    return()=>c.abort();
  },[retry,selectedRegionId]);
  useEffect(()=>()=>{request.current?.abort();returnRequest.current?.abort();},[]);
  function invalidate(){request.current?.abort();returnRequest.current?.abort();setBusy(false);request.current=null;returnRequest.current=null;setResult(undefined);setBack(undefined);setError('');setReturnError('');}
  function changeRegion(id?:RegionId){
    if(id===selectedRegionId)return;
    invalidate();setData(undefined);setSelectedRegionId(id);setStart(HOME);setGoal(GOAL);setSelected(0);setSettings(defaults);setWeatherHour(12);setMode('inspect');setInspection(HOME);setPose({...HOME,heading:0,elapsed:0});setBlocked(false);setTimeScale(1);lastReturn.current={x:Infinity,y:Infinity};setView('globe');
  }
  function changeSettings(next:Settings){invalidate();setSettings(next);setPose(p=>({...p,elapsed:0}));}
  function pick(p:Point){
    const q={x:Math.round(p.x/5)*5,y:Math.round(p.y/5)*5};setInspection(q);
    if(mode==='inspect')return;
    invalidate();setPose({...start,heading:0,elapsed:0});
    if(mode==='start'){setStart(q);setPose({...q,heading:0,elapsed:0});}
    if(mode==='goal')setGoal(q);
    if(mode==='exclude')setSettings(s=>({...s,exclusions:[...s.exclusions,{...q,radius:40}].slice(-30)}));
    if(mode!=='exclude')setMode('inspect');
  }
  async function plan(){
    if(!data||!canPlan(region))return;request.current?.abort();const c=new AbortController();request.current=c;setBusy(true);setError('');setResult(undefined);setBack(undefined);
    try{const r=await api<RouteResult>('/api/routes',{datasetId:data.meta.id,start,goal,settings},c.signal);if(request.current!==c||c.signal.aborted)return;setResult(r);setSelected(0);setPose({...start,heading:Math.atan2(goal.x-start.x,goal.y-start.y),elapsed:0});lastReturn.current={x:Infinity,y:Infinity};}
    catch(e){if(request.current===c&&(e as Error).name!=='AbortError')setError((e as Error).message);}
    finally{if(request.current===c)setBusy(false);}
  }
  const updatePose=useCallback((p:Pose)=>setPose(p),[]);
  useEffect(()=>{
    if(view!=='walk'||!route||!data)return;
    if(Math.hypot(pose.x-lastReturn.current.x,pose.y-lastReturn.current.y)<(back?.atHabitat?5:25))return;
    lastReturn.current={x:pose.x,y:pose.y};returnRequest.current?.abort();const c=new AbortController();returnRequest.current=c;
    setBack(undefined);setReturnError('');
    api<ReturnResult>('/api/return',{datasetId:data.meta.id,start:{x:pose.x,y:pose.y},goal:start,settings,mode:route.mode,elapsedS:pose.elapsed},c.signal)
      .then(r=>{if(returnRequest.current===c&&!c.signal.aborted)setBack(r);}).catch(e=>{if(returnRequest.current===c&&e.name!=='AbortError')setReturnError(e.message);});
  },[view,route,data,pose,start,settings]);
  function reset(){invalidate();setStart(HOME);setGoal(GOAL);setSelected(0);setMode('inspect');setInspection(HOME);setPose({...HOME,heading:0,elapsed:0});setBlocked(false);setTimeScale(1);lastReturn.current={x:Infinity,y:Infinity};setView('plan');setSettings(s=>({...s,exclusions:[]}));}
  const observed=data?.environment.weather.find(w=>w.hour===weatherHour);
  const measured=data&&sample(data,inspection),local=data&&sample(data,pose),geo=data&&localToGeo(data.meta,inspection);
  const progress=route?routeProgress(route,pose):null;
  const totalReturn=pose.elapsed+(back?.route?.metrics.durationS??0);
  const reached=route&&Math.hypot(pose.x-goal.x,pose.y-goal.y)<8;
  const alerts=[...(route?.warnings??[]),...(back?.warnings??[])];
  if(blocked)alerts.push('Movement stopped: terrain limit, exclusion, or coverage boundary.');
  if(progress&&progress.offRouteM>25)alerts.push('You are more than 25 m off the planned route.');
  if(pose.elapsed>settings.maxDurationMin*60)alerts.push('Elapsed time exceeds the configured excursion budget.');
  if(pose.elapsed/3600*settings.doseRateMicroGyH>settings.maxDoseMicroGy)alerts.push('Accumulated detector-dose proxy exceeds the configured budget.');
  if(back?.route&&totalReturn>settings.maxDurationMin*60)alerts.push('Current return estimate exceeds the remaining time budget.');

  return <>
    <nav className="mission-nav" aria-label="Main navigation"><a className="nav-brand" href="#" onClick={e=>{e.preventDefault();setView('globe');}}>◉ <span>MARTIAN MAP</span></a><div className="view-tabs">{(['globe','plan','walk'] as const).map((v,i)=><button key={v} aria-current={view===v?'page':undefined} disabled={v==='walk'?!route:v==='plan'?!canPlan(region):false} onClick={()=>setView(v)}>{String(i+1).padStart(2,'0')} <span>{v==='globe'?'Explore':v==='plan'?'Plan excursion':'Surface HUD'}</span></button>)}</div><span className="nav-site"><i/> {region?`${region.shortName.toUpperCase()} / REAL DATA`:'MARS / SELECT A REGION'}</span></nav>
    {dataError&&<div className="data-error" role="alert">{dataError} <button onClick={()=>setRetry(n=>n+1)}>Retry local data</button></div>}
    <div style={{display:view==='globe'?'block':'none'}}><GlobeExplorer data={data} dataError={dataError} route={route} selectedRegionId={selectedRegionId} onRegionChange={changeRegion} onExplore={()=>{if(canPlan(region))setView('plan');}} basemap={basemap} onBasemapChange={setBasemap} visible={basemapVisible} onVisibleChange={setBasemapVisible} opacity={basemapOpacity} onOpacityChange={setBasemapOpacity} overlays={overlays} onOverlayChange={changeOverlay} conditionsVisible={conditionsVisible} onConditionsChange={setConditionsVisible}/></div>
    {view==='plan'&&canPlan(region)&&<main className="mission-layout">
      <aside className="mission-sidebar"><div className="eyebrow">{region?.shortName.toUpperCase()} / EXCURSION</div><h1>Find your <br/>way forward.</h1><p className="subtle">A measured landscape. Two ways through it.</p>
        <section><div className="section-label">01 / SET YOUR ENDPOINTS</div><div className="endpoint"><span className="point-label habitat">H</span><div><strong>Habitat / start</strong><small>{start.x.toFixed(0)} E · {start.y.toFixed(0)} N m</small></div><button aria-pressed={mode==='start'} onClick={()=>setMode('start')}>Place</button></div><div className="endpoint"><span className="point-label destination">D</span><div><strong>Destination</strong><small>{goal.x.toFixed(0)} E · {goal.y.toFixed(0)} N m</small></div><button aria-pressed={mode==='goal'} onClick={()=>setMode('goal')}>Place</button></div><div className="button-row"><button className="secondary" aria-pressed={mode==='exclude'} onClick={()=>setMode(mode==='exclude'?'inspect':'exclude')}>＋ Exclusion</button><button className="text-button" disabled={!settings.exclusions.length} onClick={()=>changeSettings({...settings,exclusions:[]})}>Clear exclusions</button></div><p className="caption">Exclusions are user-declared 40 m areas, not measured hazards.</p></section>
        <section><div className="section-label">02 / MISSION ASSUMPTIONS</div><div className="settings-grid">
          {([['speedMps','Walking speed','m/s',.1,3,.1],['maxSlopeDeg','Slope limit','°',1,45,1],['maxDurationMin','Time budget','min',1,480,1],['doseRateMicroGyH','Detector rate proxy','µGy/h',0,10000,.01],['maxDoseMicroGy','Dose proxy budget','µGy',.01,100000,1]] as const).map(([key,label,unit,min,max,step])=><label key={key}>{label}<span><input aria-label={label} type="number" min={min} max={max} step={step} value={settings[key]} onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))changeSettings({...settings,[key]:e.target.valueAsNumber});}}/> {unit}</span></label>)}
        </div><details><summary>Departure conditions and limits</summary><div className="settings-grid">{([['temperatureK','Temperature','K',100,350],['minTemperatureK','Minimum temperature','K',100,350],['windMps','Wind assumption','m/s',0,200],['maxWindMps','Maximum wind','m/s',0,200]] as const).map(([key,label,unit,min,max])=><label key={key}>{label}<span><input aria-label={label} type="number" min={min} max={max} step=".1" value={settings[key]} onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))changeSettings({...settings,[key]:e.target.valueAsNumber});}}/> {unit}</span></label>)}</div></details><p className="caption">Demonstration settings. Dose refers to a rover-detector proxy; limits are not astronaut safety standards.</p><button className="primary full" disabled={!data||busy} onClick={()=>void plan()}>{busy?'Finding terrain-aware paths…':'Compare routes →'}</button>{error&&<p className="error" role="alert">{error}</p>}</section>
        {result&&<section><div className="section-label">03 / CHOOSE YOUR TRAVERSE</div>{result.routes.map((r,i)=><button className={`route-card ${selected===i?'selected':''}`} key={r.mode} aria-pressed={selected===i} onClick={()=>{setSelected(i);setBack(undefined);lastReturn.current={x:Infinity,y:Infinity};}}><span>{r.mode==='shortest'?'01 / SHORTEST PERMITTED':'02 / GENTLER TERRAIN'}<b>{distance(r.metrics.distanceM)}</b></span><strong>{duration(r.metrics.durationS)} <small>outbound · {Math.round(r.metrics.ascentM)} m ascent</small></strong><small>{r.metrics.maxSlopeDeg.toFixed(1)}° max slope · {r.roundTripDoseMicroGy.toFixed(2)} µGy return-inclusive proxy</small><small>Excursion including return: {duration(r.roundTripS)}</small></button>)}{route&&<><div className="warning-list">{route.warnings.map(w=><p role="status" key={w}>{w}</p>)}</div><button className="primary full" onClick={()=>{setPose({...start,heading:Math.atan2(goal.x-start.x,goal.y-start.y),elapsed:0});lastReturn.current={x:Infinity,y:Infinity};setView('walk');}}>Walk selected route →</button></>}</section>}
        <button className="text-button reset" onClick={reset}>↺ Reset example excursion</button>
      </aside>
      <section className="terrain-workspace" aria-label="Gale route planner">
        <header className="workspace-header"><div><div className="eyebrow">SELECTED REGION</div><h2>{region?.name}</h2></div><span className="tag">2 × 2 KM / 5 M GRID</span></header>
        <div className="layer-bar"><span>LAYERS</span>{OVERLAYS.map(layer=><label key={layer.id}><input aria-label={layer.name} type="checkbox" checked={overlays[layer.id].visible} onChange={e=>changeOverlay(layer.id,{visible:e.target.checked})}/>{layer.name}<input className="planner-opacity" aria-label={`${layer.name} opacity`} type="range" min="0" max="100" value={overlays[layer.id].opacity*100} onChange={e=>changeOverlay(layer.id,{opacity:Number(e.target.value)/100})}/></label>)}<span className="pick-mode">{mode==='inspect'?'Hover to inspect':mode==='exclude'?'Click to add exclusion':`Click to place ${mode==='start'?'habitat':'destination'}`}</span></div>
        {data?<SurfaceMap data={data} start={start} goal={goal} routes={result?.routes} selected={selected} exclusions={settings.exclusions} overlays={overlays} mode={mode} onPick={pick} onInspect={setInspection}/>:<div className="loading-data">{dataError?'Local data unavailable.':'Opening the prepared terrain…'}</div>}
        <div className="inspection" aria-label="Terrain inspection"><span><small>LOCATION</small>{geo?`${geo[1].toFixed(5)}° N / ${geo[0].toFixed(5)}° E`:'—'}</span><span><small>AREOID ELEVATION</small>{measured?`${measured.elevation.toFixed(1)} m`:'Outside valid data'}</span><span><small>LOCAL MAX SLOPE</small>{measured?`${measured.slope.toFixed(1)}°`:'—'}</span><span><small>DISPLAY LEGEND</small>{[...(overlays.imagery.visible?['Orthoimage']:[]),...(elevation?['Elevation: teal low → rust high']:[]),...(slope?['Slope: teal 0° → rust 30°']:[])].join(' · ')||'No imagery layers selected'}</span></div>
        {conditionsVisible&&<div className="environment-strip"><label className="history-hour">SOL {data?.environment.sol??'—'} / <select aria-label="Historical hour" value={weatherHour} onChange={e=>{const hour=Number(e.target.value);setWeatherHour(hour);const w=data?.environment.weather.find(v=>v.hour===hour);if(w)changeSettings({...settings,temperatureK:w.temperatureK??settings.temperatureK,windMps:w.windMps??settings.windMps});}}>{data?.environment.weather.map(w=><option key={w.hour} value={w.hour}>{String(w.hour).padStart(2,'0')}:00 LMST</option>)}</select></label><div><strong>{observed?.temperatureK?.toFixed(1)??'—'} K</strong><small>REMS air temperature</small></div><div><strong>{observed?.pressurePa?.toFixed(1)??'—'} Pa</strong><small>REMS pressure</small></div><div><strong>{observed?.windMps===null?'Unavailable':observed?.windMps??'—'}</strong><small>REMS wind · missing stays missing</small></div><div><strong>{data?.environment.radiation.rateMicroGyH.toFixed(2)??'—'} µGy/h</strong><small>RAD detector E · mean observed rate</small></div></div>}
        {data&&<details className="provenance"><summary>Data coverage, references and assumptions ↗</summary><p>{data.meta.resolutionNote}</p><p>{data.meta.slopeDefinition} Valid terrain: {(data.meta.validFraction*100).toFixed(1)}% of patch. Native fine-hazard coverage still requires field verification.</p><p>{data.meta.verticalReference}</p><p>{data.environment.weatherNote}</p><p>{data.environment.radiation.note}</p><p>{result?.assumptions??'Route duration uses configured speed with uphill/downhill penalties. Environmental values are site-level context, not a spatial forecast.'}</p><div className="source-links">{data.meta.sources.map(s=><a key={s.url} href={s.catalog} target="_blank" rel="noreferrer">{s.name} ↗</a>)}<a href={data.environment.weatherSource} target="_blank" rel="noreferrer">REMS source ↗</a><a href={data.environment.radiation.source} target="_blank" rel="noreferrer">RAD source ↗</a></div><p>{data.meta.attribution}</p></details>}
      </section>
    </main>}
    {view==='walk'&&data&&route&&<main className="hud-page"><Suspense fallback={<div className="loading-data">Opening the surface HUD…</div>}><WalkingScene data={data} route={route} settings={settings} initialPose={pose} timeScale={timeScale} onPose={updatePose} onBlocked={setBlocked}/></Suspense><header className="hud-heading"><span className="eyebrow">{region?.shortName.toUpperCase()} / SURFACE EXCURSION</span><h2>{reached?'Destination reached.':route.mode==='shortest'?'On the shortest traverse.':'Taking the gentler path.'}</h2><span>Simulated position · mission clock pauses with Esc</span></header><aside className="hud-map"><SurfaceMap data={data} start={start} goal={goal} routes={result?.routes} selected={selected} pose={pose} exclusions={settings.exclusions} overlays={{...defaultOverlays(),imagery:{visible:true,opacity:1}}} mini/><div><span>H HABITAT</span><span>D DESTINATION</span></div></aside><div className="hud-bottom"><div><small>NEXT WAYPOINT</small><strong>{progress?distance(Math.hypot(progress.target[0]-pose.x,progress.target[1]-pose.y)):'—'}</strong><span>{progress?`${((Math.atan2(progress.target[0]-pose.x,progress.target[1]-pose.y)*180/Math.PI+360)%360).toFixed(0)}° bearing · ${distance(progress.remainingM)} remaining`:'—'}</span></div><div><small>HEADING</small><strong>{((pose.heading*180/Math.PI+360)%360).toFixed(0)}°</strong><span>{local?.elevation.toFixed(1)} m areoid elevation</span></div><div><small>MISSION ELAPSED</small><strong data-testid="elapsed">{pose.elapsed.toFixed(1)} s</strong><span>{(pose.elapsed/3600*settings.doseRateMicroGyH).toFixed(3)} µGy proxy</span></div><div><small>RETURN TO HABITAT</small><strong>{back?.atHabitat?'At habitat':back?.route?duration(back.route.metrics.durationS):returnError?'Unavailable':'Checking…'}</strong><span>{back?.route?`${duration(Math.max(0,settings.maxDurationMin*60-totalReturn))} time reserve`:'Rechecked every 25 m'}</span></div><div><small>DEPARTURE SCENARIO</small><strong>{settings.temperatureK.toFixed(1)} K</strong><span>{settings.windMps.toFixed(1)} m/s assumed wind</span></div></div><div className="hud-alerts" aria-live="polite">{Array.from(new Set(alerts)).map(a=><p key={a}>{a}</p>)}{returnError&&<p>{returnError}</p>}{reached&&<p className="success">Destination reached. Return to the habitat or end the demonstration.</p>}</div><div className="hud-actions"><button className="secondary" onClick={()=>setView('plan')}>← Return to planner</button><button className="secondary" onClick={reset}>Reset excursion</button><label className="pace-control">Simulation pace <select aria-label="Simulation pace" value={timeScale} onChange={e=>setTimeScale(Number(e.target.value))}><option value={1}>1×</option><option value={5}>5×</option><option value={20}>20× demo</option></select></label></div><div className="pose-readout" data-testid="position">E {pose.x.toFixed(1)} / N {pose.y.toFixed(1)} m</div></main>}
  </>;
}
