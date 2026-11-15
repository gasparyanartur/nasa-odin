import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FieldWorkspace, { newFieldRecord } from './field/FieldWorkspace';
import { useEnvironmentCatalog } from './environment/useEnvironment';
import { availableLayers, DEFAULT_ENVIRONMENT, sampleAt, selectedRecord } from './environment/model';
import EnvironmentControls from './environment/Controls';
import EnvironmentWorkspace from './environment/Workspace';
import FieldDetails from './field/FieldDetails';
import { fieldExclusions, restrictionKey, validateRecords, type FieldRecord } from './field/model';
import { useFieldStore } from './field/useFieldStore';
import GlobeExplorer from './GlobeExplorer';
import GeologyPanel from './GeologyPanel';
import ScienceTargets from './mission/ScienceTargets';
import DataProvenance from './mission/DataProvenance';
import RouteExplanation from './mission/RouteExplanation';
import RouteFailure from './mission/RouteFailure';
import { targetById, unitAt, type GeologySettings, type GeologySelection } from './datasets/geology';
import StationHistory from './StationHistory';
import HudConfiguration, { DEFAULT_HUD, MissionClocks } from './mission/HudSettings';
import Visor from './mission/Visor';
import TabletShell from './TabletShell';
import Help from './Help';
import ContextGuide from './ContextGuide';
import EventsPanel from './mission/EventsPanel';
import TraverseHistory from './mission/TraverseHistory';
import {usePreviousPaths} from './mission/usePreviousPaths';
import {recordedPaths,PATH_COLORS} from './mission/previous-paths';
import {useTraverses} from './mission/useTraverses';
import {EVENT_NAMES,eventInstruction,eventStatus,type EventKind,type ExpeditionEvent} from './mission/events';
import { usePlanner } from './mission/planner/usePlanner';
import { LMST_HOUR_SECONDS, historicalAt, lmstLabel, type GraphicsQuality } from './mission/conditions';
import SurfaceMap, { type PickMode } from './mission/SurfaceMap';
import { BASEMAPS, OVERLAYS, canPlan, defaultOverlays, getRegion, SUGGESTED_REGION_ID, type RegionId, type OverlayId, type OverlaySettings } from './datasets/catalog';
const WalkingScene = lazy(() => import('./mission/WalkingScene'));
import { RoutePlanningError, type RouteDiagnostics, loadTerrain, localToGeo, routeProgress, sample, type Point, type Pose, type ReturnResult, type RouteResult, type Settings, type TerrainData } from './mission/data';

const directDemo=new URLSearchParams(window.location.search).get('demo')==='yellowknife';
const directBoxwork=new URLSearchParams(window.location.search).get('demo')==='boxwork';
const HOME={x:0,y:0}, GOAL={x:600,y:450};
const defaults:Settings={conditionsMode:'historical',departureHour:12,dwellMin:0,speedMps:.8,maxSlopeDeg:20,maxDurationMin:90,doseRateMicroGyH:10,maxDoseMicroGy:50,temperatureK:220,minTemperatureK:180,windMps:0,maxWindMps:25,exclusions:[]};
const duration=(s:number)=>`${Math.ceil(s/60)} min`;
const distance=(m:number)=>m>=1000?`${(m/1000).toFixed(2)} km`:`${Math.round(m)} m`;

export default function App(){
  const [selectedRegionId,setSelectedRegionId]=useState<RegionId|undefined>(directDemo?'gale-bradbury':directBoxwork?'gale-boxwork':undefined);
  const region=getRegion(selectedRegionId);
  const [basemap,setBasemap]=useState(BASEMAPS[0]),[basemapVisible,setBasemapVisible]=useState(true),[basemapOpacity,setBasemapOpacity]=useState(1);
  const [overlays,setOverlays]=useState(()=>directDemo?{...defaultOverlays(),slope:{visible:true,opacity:.25}}:defaultOverlays()),[conditionsVisible,setConditionsVisible]=useState(true);
  const slope=overlays.slope.visible,elevation=overlays.elevation.visible;
  function changeOverlay(id:OverlayId,patch:Partial<OverlaySettings[OverlayId]>){setOverlays(previous=>({...previous,[id]:{...previous[id],...patch}}));}
  const [context,setContext]=useState<'globe'|'surface'>(directDemo||directBoxwork?'surface':'globe');
  const [tabletOpen,setTabletOpen]=useState(directDemo||directBoxwork);
  const view=context==='globe'?'globe':tabletOpen?'plan':'walk';
  function setView(next:'globe'|'plan'|'walk') { if(next==='walk'&&sceneFailed){setRendererRetry(v=>v+1);setSceneFailed(false);}setContext(next==='globe'?'globe':'surface');setTabletOpen(next==='plan'); }
  const [routeWorkflow,setRouteWorkflow]=useState<'new'|'saved'>('new');
  const [mapPanel,setMapPanel]=useState<'layers'|'evidence'|undefined>();
  const [pauseMenu,setPauseMenu]=useState(false);
  const [session,setSession]=useState(0);
  const [sceneFailed,setSceneFailed]=useState(false),[rendererRetry,setRendererRetry]=useState(0);
  const environmental=useEnvironmentCatalog(),[environmentSelection,setEnvironmentSelection]=useState(DEFAULT_ENVIRONMENT),[environmentNotice,setEnvironmentNotice]=useState('');
  const environmentLayer=environmental.catalog?availableLayers(environmental.catalog,environmentSelection).find(l=>l.id===environmentSelection.layerId):undefined;
  const [data,setData]=useState<TerrainData>(), [dataError,setDataError]=useState(''),[retry,setRetry]=useState(0);
  const planner=usePlanner(data);
  const [start,setStart]=useState<Point>(HOME),[goal,setGoal]=useState<Point>(directDemo?targetById('yellowknife')!.point:GOAL),[settings,setSettings]=useState<Settings>(directDemo?{...defaults,dwellMin:10}:defaults);
  const [guide,setGuide]=useState(directDemo),[targetId,setTargetId]=useState<string|undefined>(directDemo?'yellowknife':undefined);
  const [geology,setGeology]=useState<GeologySettings>({visible:directDemo,opacity:.35,contacts:true}),[geologySelection,setGeologySelection]=useState<GeologySelection>();
  const [profileEdge,setProfileEdge]=useState<number>();
  const [result,setResult]=useState<RouteResult>(),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[routeFailure,setRouteFailure]=useState<RouteDiagnostics>();
  const [mode,setMode]=useState<PickMode>('inspect'),[inspection,setInspection]=useState<Point>(HOME);
  const weatherHour=settings.departureHour??12;
  const [playing,setPlaying]=useState(false);
  const [imagery,setImagery]=useState<'colour'|'grey'>('colour');
  const [quality,setQuality]=useState<GraphicsQuality>('medium');
  const [hud,setHud]=useState(DEFAULT_HUD),[stationTab,setStationTab]=useState<'atlas'|'history'>('atlas'),[tabletTab,setTabletTab]=useState<'explore'|'routes'|'setup'|'field'|'events'>(directDemo?'routes':'explore');
  const visor=hud.visor;
  const [timeScale,setTimeScale]=useState(1);
  const [pose,setPose]=useState<Pose>({...HOME,heading:0,elapsed:0}),[blocked,setBlocked]=useState(false),[back,setBack]=useState<ReturnResult>(),[returnError,setReturnError]=useState('');
  const [returnRetry,setReturnRetry]=useState(0);
  const request=useRef<AbortController|null>(null),returnRequest=useRef<AbortController|null>(null),lastReturn=useRef<Point & {elapsed?:number}>({x:Infinity,y:Infinity});
  const route=result?.routes[selected];
  const [events,setEvents]=useState<ExpeditionEvent[]>([]),[returning,setReturning]=useState(false);
  const traverses=useTraverses(data,`${selectedRegionId}-${session}`,pose);
  const pathLibrary=usePreviousPaths(data);
  const eventPhases=events.map(e=>eventStatus(e,pose.elapsed)).join(',');
  const activeEvents=useMemo(()=>events.filter(e=>eventStatus(e,pose.elapsed)==='active'),[events,eventPhases]);
  const guidance=returning?back?.route??undefined:route;
  const savedPaths=useMemo(()=>data?[...pathLibrary.paths,...recordedPaths(traverses.records,data)]:[],[data,pathLibrary.paths,traverses.records]);
  const savedTraces=useMemo(()=>savedPaths.map((p,i)=>({...p,label:p.name,color:PATH_COLORS[i%PATH_COLORS.length],dashed:p.kind==='rover'})).filter(pathLibrary.show),[savedPaths,pathLibrary.visibility]);
  const mapTraces=[{id:'current',label:'Current walk',points:traverses.samples,color:'#72e8ed'},...savedTraces,...(returning&&back?.route?[{id:'return',label:'Return guidance',points:back.route.points.map(([x,y])=>({x,y})),color:'#79f0da'}]:[])];
  function openEvents(){setTabletTab('events');setMapPanel(undefined);setView('plan');}
  function addEvent(kind:EventKind,delay:number){if(events.length>=30)return;setEvents(v=>[...v,{id:crypto.randomUUID(),kind,createdS:pose.elapsed,atS:pose.elapsed+delay,center:{x:pose.x,y:pose.y},radiusM:kind==='solar'?35:60,acknowledged:false}]);}
  function updateEvent(id:string,action:'acknowledge'|'end'|'cancel'){setEvents(v=>action==='cancel'?v.filter(e=>e.id!==id):v.map(e=>e.id===id?{...e,...(action==='acknowledge'?{acknowledged:true}:{endedS:pose.elapsed})}:e));}
  function returnToHabitat(){if(!back?.route)return;setReturning(true);setView('walk');}
  useEffect(()=>{setEvents([]);setReturning(false);},[session]);
  const fieldStore=useFieldStore(),[fieldDraft,setFieldDraft]=useState<FieldRecord>(),[selectedField,setSelectedField]=useState<string>(),[fieldNotice,setFieldNotice]=useState('');
  const sharedFields=useMemo(()=>fieldStore.records.filter(r=>r.regionId===region?.id),[fieldStore.records,region?.id]);
  const activeField=sharedFields.find(r=>r.id===selectedField);
  const missionSettings=useMemo(()=>({...settings,exclusions:[...settings.exclusions,...fieldExclusions(sharedFields)]}),[settings,fieldStore.records,selectedRegionId]);
  const fieldContext=useRef({records:sharedFields,settings,data});fieldContext.current={records:sharedFields,settings,data};
  function commitFields(next:FieldRecord[]){
    next=validateRecords(next);
    const current=fieldContext.current;
    if(current.settings.exclusions.length+fieldExclusions(next).length>30)throw new Error('At most 30 active restrictions total. Clear a manual exclusion or disable another field restriction.');
    if(current.data&&next.some(r=>r.points.some(q=>!sample(current.data!,q))))throw new Error('Every record vertex must be inside valid prepared terrain.');
    if(restrictionKey(next)!==restrictionKey(current.records)){invalidate();setFieldNotice('Travel restrictions changed. Plan a route again; astronaut position and mission time are retained.');lastReturn.current={x:Infinity,y:Infinity};}
    fieldStore.replace([...fieldStore.records.filter(r=>r.regionId!==region?.id),...next]);
  }
  function undoFields(){const previous=fieldStore.past[fieldStore.past.length-1];if(!previous)return;if(settings.exclusions.length+fieldExclusions(previous.filter(r=>r.regionId===region?.id)).length>30)throw new Error('Clear manual exclusions before restoring these restrictions.');if(restrictionKey(previous.filter(r=>r.regionId===region?.id))!==restrictionKey(sharedFields)){invalidate();lastReturn.current={x:Infinity,y:Infinity};setFieldNotice('Restriction edit undone. Plan a route again; position and time are retained.');}fieldStore.undo();}
  function openFields(id?:string){setMapPanel(undefined);setSelectedField(id);setTabletTab('field');setView('plan');}
  function logHere(){setMapPanel(undefined);if(fieldDraft){setFieldNotice('Your unfinished draft is open. Save or cancel it before logging another position.');}else{setFieldDraft(newFieldRecord('note',pose,pose,weatherHour,'simulated-pose',region?.id==='gale-boxwork'?'gale-boxwork':'gale-bradbury',data?.environment.sol??10));setSelectedField(undefined);setFieldNotice('');}setTabletTab('field');setView('plan');}

  useEffect(()=>{
    setDataError('');
    if(!canPlan(region)){setData(undefined);return;}
    const c=new AbortController();
    loadTerrain(c.signal,region!.terrain!.baseUrl).then(d=>{
      if(c.signal.aborted)return;
      setData(d);if(d.meta.defaultStart){setStart(d.meta.defaultStart);setInspection(d.meta.defaultStart);setGoal(d.meta.defaultGoal!);setPose({...d.meta.defaultStart,heading:0,elapsed:0});}
      const weather=d.environment.weather.find(w=>w.hour>=12&&w.temperatureK!==null)??d.environment.weather[0];
      setSettings(s=>({...s,doseRateMicroGyH:Number(d.environment.radiation.rateMicroGyH.toFixed(3)),temperatureK:weather?.temperatureK??220,windMps:weather?.windMps??0}));
    }).catch(e=>{if(e.name!=='AbortError')setDataError(e.message);});
    return()=>c.abort();
  },[retry,selectedRegionId]);
  useEffect(()=>()=>{request.current?.abort();returnRequest.current?.abort();},[]);
  function invalidate(){setReturning(false);setProfileEdge(undefined);request.current?.abort();returnRequest.current?.abort();setBusy(false);request.current=null;returnRequest.current=null;setResult(undefined);setBack(undefined);setError('');setRouteFailure(undefined);setReturnError('');}
  function changeRegion(id?:RegionId){
    if(id===selectedRegionId)return;setMapPanel(undefined);setPauseMenu(false);setSession(v=>v+1);
    invalidate();setSelectedField(undefined);setFieldDraft(undefined);setFieldNotice('');setTargetId(undefined);setGeologySelection(undefined);setGuide(false);updateDemoUrl(false);setData(undefined);setSelectedRegionId(id);setStart(HOME);setGoal(GOAL);setSelected(0);setSettings(defaults);setPlaying(false);setMode('inspect');setInspection(HOME);setPose({...HOME,heading:0,elapsed:0});setBlocked(false);setTimeScale(1);lastReturn.current={x:Infinity,y:Infinity};setView('globe');
  }
  function changeHour(hour:number){setPlaying(false);restartScenario(hour);}
  useEffect(()=>{
    if(!playing||view!=='globe'||stationTab!=='history')return;
    const timer=window.setInterval(()=>setSettings(s=>{const next=Math.min(23.99,(s.departureHour??12)+.25);return {...s,departureHour:next};}),500);
    return()=>window.clearInterval(timer);
  },[playing,view,stationTab]);
  useEffect(()=>{if(weatherHour>=23.99||view!=='globe'||stationTab!=='history')setPlaying(false);},[weatherHour,view,stationTab]);
  function changeSettings(next:Settings){setPlaying(false);invalidate();setSettings(next);lastReturn.current={x:Infinity,y:Infinity};}
  function restartScenario(hour:number){changeSettings({...settings,departureHour:hour});setPose(p=>({...p,elapsed:0}));setSession(v=>v+1);}
  function applyEnvironmentSnapshot(){
    if(!environmental.catalog||region?.id!=='gale-bradbury')return;
    const snapshot=selectedRecord(environmental.catalog,environmentSelection);
    if(snapshot.temperature===null||snapshot.radiation===null)return;
    changeSettings({...settings,conditionsMode:'manual',temperatureK:snapshot.temperature,doseRateMicroGyH:snapshot.radiation});
    setEnvironmentNotice(`Copied ${snapshot.forecast?'simulated':'observed'} Sol ${environmentSelection.sol}, instrument hour ${environmentSelection.hour} into fixed manual mission assumptions. Previous routes were cleared; elapsed mission time, position and the Sol 10 clock anchor are retained. Plan a route again. No time-varying field was inferred.`);
  }
  function pick(p:Point){
    const step=data?.meta.stepM??5,q={x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step};setInspection(q);
    if(mode==='inspect'&&environmentLayer&&data){const [lon,lat]=localToGeo(data.meta,q);setEnvironmentSelection(s=>({...s,sampleId:sampleAt(environmentLayer,lon,lat)?.id}));}
    if(mode==='inspect'){if(data&&region){const [lon,lat]=localToGeo(data.meta,q),unit=unitAt(region.id,lon,lat);if(unit)setGeologySelection({kind:'unit',id:unit.id});}return;}
    if(mode==='exclude'&&missionSettings.exclusions.length>=30){setRouteFailure(undefined);setError('At most 30 active restrictions total, including the field layer.');return;}
    invalidate();lastReturn.current={x:Infinity,y:Infinity};
    if(mode==='start'){setStart(q);setPose({...q,heading:0,elapsed:0});setSession(v=>v+1);}
    if(mode==='goal'){setGoal(q);setTargetId(undefined);}
    if(mode==='exclude')setSettings(s=>({...s,exclusions:[...s.exclusions,{...q,radius:40}].slice(-30)}));
    if(mode!=='exclude')setMode('inspect');
  }
  function updateDemoUrl(enabled:boolean){const url=new URL(window.location.href);if(enabled)url.searchParams.set('demo','yellowknife');else url.searchParams.delete('demo');window.history.replaceState(null,'',url);}
  function selectTarget(id:string){const target=targetById(id);if(!target||target.regionId!==region?.id||!data||!canPlan(region))return;const value=sample(data,target.point);if(!value||value.slope>settings.maxSlopeDeg||missionSettings.exclusions.some(e=>Math.hypot(e.x-target.point.x,e.y-target.point.y)<=e.radius+data.meta.stepM/Math.sqrt(2)))return;invalidate();setTargetId(id);setGoal(target.point);setInspection(target.point);setMode('inspect');setGeology(g=>({...g,visible:true}));const unit=unitAt(target.regionId,target.longitude,target.latitude);if(unit)setGeologySelection({kind:'unit',id:unit.id});}
  function startDemo(){if(selectedRegionId!=='gale-bradbury')changeRegion('gale-bradbury');invalidate();setPlaying(false);setStart(HOME);setGoal(targetById('yellowknife')!.point);setTargetId('yellowknife');setGuide(true);setMode('inspect');setInspection(targetById('yellowknife')!.point);setSettings({...defaults,dwellMin:10,doseRateMicroGyH:data?.environment.radiation.rateMicroGyH??defaults.doseRateMicroGyH});setGeology({visible:true,opacity:.35,contacts:true});setOverlays({...defaultOverlays(),slope:{visible:true,opacity:.25}});setPose({...HOME,heading:0,elapsed:0});setTimeScale(1);setBlocked(false);lastReturn.current={x:Infinity,y:Infinity};updateDemoUrl(true);setTabletTab('routes');setSession(v=>v+1);setView('plan');}
  function openSuggested(){if(selectedRegionId!==SUGGESTED_REGION_ID)changeRegion(SUGGESTED_REGION_ID);setTabletTab('routes');setView('plan');}
  async function plan(){
    if(!data||!planner||!canPlan(region))return;setPlaying(false);request.current?.abort();const c=new AbortController();request.current=c;setBusy(true);setError('');setRouteFailure(undefined);setResult(undefined);setBack(undefined);
    try{const r=await planner!.compare({start,goal,settings:missionSettings},c.signal);if(request.current!==c||c.signal.aborted)return;if(r.datasetId!==data.meta.id||r.version!==data.meta.version)throw new Error('Route dataset/version does not match the active terrain. Reload the site and compare again.');setResult(r);setSelected(r.recommendedIndex);setFieldNotice('');lastReturn.current={x:Infinity,y:Infinity};}
    catch(e){if(request.current===c&&(e as Error).name!=='AbortError'){setError((e as Error).message);setRouteFailure(e instanceof RoutePlanningError?e.diagnostics:undefined);}}
    finally{if(request.current===c)setBusy(false);}
  }
  const updatePose=useCallback((p:Pose)=>setPose(p),[]);
  useEffect(()=>{
    if(view!=='walk'||!data||!planner)return;
    if(Math.hypot(pose.x-lastReturn.current.x,pose.y-lastReturn.current.y)<(back?.atHabitat?5:25)&&pose.elapsed-(lastReturn.current.elapsed??-Infinity)<60)return;
    lastReturn.current={x:pose.x,y:pose.y,elapsed:pose.elapsed};returnRequest.current?.abort();const c=new AbortController();returnRequest.current=c;
    setBack(undefined);setReturnError('');
    planner.returnToHabitat({start:{x:pose.x,y:pose.y},goal:start,settings:missionSettings,mode:route?.mode??'shortest',elapsedS:pose.elapsed},c.signal)
      .then(r=>{if(returnRequest.current===c&&!c.signal.aborted)setBack(r);}).catch(e=>{if(returnRequest.current===c&&e.name!=='AbortError')setReturnError(e.message);});
  },[view,route,data,planner,pose,start,missionSettings,returnRetry]);
  function reset(){setSession(v=>v+1);setPauseMenu(false);const HOME=data?.meta.defaultStart??{x:0,y:0},GOAL=data?.meta.defaultGoal??{x:600,y:450};setTargetId(undefined);setGuide(false);updateDemoUrl(false);setPlaying(false);invalidate();setStart(HOME);setGoal(GOAL);setSelected(0);setMode('inspect');setInspection(HOME);setPose({...HOME,heading:0,elapsed:0});setBlocked(false);setTimeScale(1);lastReturn.current={x:Infinity,y:Infinity};setTabletTab('explore');setView('plan');const weather=data?.environment.weather.find(w=>w.hour>=12&&w.temperatureK!==null);setSettings({...defaults,doseRateMicroGyH:data?.environment.radiation.rateMicroGyH??defaults.doseRateMicroGyH,temperatureK:weather?.temperatureK??defaults.temperatureK,windMps:weather?.windMps??defaults.windMps});}
  useEffect(()=>{
    if(!result||tabletTab!=='routes'||mapPanel)return;
    const panel=document.querySelector<HTMLElement>('.mission-sidebar'),options=panel?.querySelector<HTMLElement>('.route-options');
    if(panel&&options)panel.scrollTop+=options.getBoundingClientRect().top-panel.getBoundingClientRect().top-12;
  },[result,tabletTab,mapPanel]);
  const scenarioHour=weatherHour+pose.elapsed/LMST_HOUR_SECONDS;
  const observed=data&&historicalAt(data.environment,scenarioHour);
  const currentTemperature=settings.conditionsMode==='historical'?observed?.temperatureK:settings.temperatureK;
  const measured=data&&sample(data,inspection),local=data&&sample(data,pose),geo=data&&localToGeo(data.meta,inspection);
  const scienceTarget=targetById(targetId);
  const progress=guidance?routeProgress(guidance,pose):null;
  const totalReturn=pose.elapsed+(back?.route?.metrics.durationS??0);
  const reached=!returning&&route&&Math.hypot(pose.x-goal.x,pose.y-goal.y)<8;
  const alerts=[...(!returning?route?.warnings??[]:[]),...(back?.warnings??[])];
  if(settings.conditionsMode==='historical'&&currentTemperature==null)alerts.push('Historical temperature unavailable at the current mission time.');
  if(currentTemperature!=null&&currentTemperature<settings.minTemperatureK)alerts.push('Current temperature is below the configured demonstration limit.');
  if(blocked)alerts.push('Movement stopped: terrain limit, exclusion, or coverage boundary.');
  if(progress&&progress.offRouteM>25)alerts.push('You are more than 25 m off the planned route.');
  if(pose.elapsed>settings.maxDurationMin*60)alerts.push('Elapsed time exceeds the configured excursion budget.');
  if(pose.elapsed/3600*settings.doseRateMicroGyH>settings.maxDoseMicroGy)alerts.push('Accumulated detector-dose proxy exceeds the configured budget.');
  if(back?.route&&totalReturn>settings.maxDurationMin*60)alerts.push('Current return estimate exceeds the remaining time budget.');

  const currentAlerts=Array.from(new Set(alerts));
  const returnNotice=back?.atHabitat?'You are at the habitat.':returnError?`Return unavailable: ${returnError}`:back?.route?`${duration(back.route.metrics.durationS)} estimated return · terrain route available.`:'No return path available yet. Open the surface to request an estimate, or retry if unavailable.';
  return <>
    <nav inert={view==='plan'} className="mission-nav" aria-label="Main navigation">
<a className="nav-brand" href="#" onClick={e=>{e.preventDefault();setView('globe');}}>◉ <span>MARTIAN MAP</span>
</a>
<div className="view-tabs">
<button title="Explore global Mars datasets and dated observations. Mission time pauses at Station." aria-current={view==='globe'?'page':undefined} onClick={()=>setView('globe')}>Station</button>
<button title="Open local Map, Routes, Field data, Display and Events over the paused surface." aria-current={view==='plan'?'page':undefined} disabled={!region} onClick={()=>setView('plan')}>Tablet</button>
<button title="Enter the surface; click terrain to resume walking. A route is optional." aria-current={view==='walk'?'page':undefined} disabled={!data||!canPlan(region)} onClick={()=>setView('walk')}>HUD · Surface</button>
</div>
<span className="nav-site">{region?.shortName??'Choose a region'} <span className="live-dot"/> LAPTOP SIMULATION</span>
</nav>
    {view==='globe'&&<header className="context-bar">
<div>
<span className="eyebrow">STATION COMPUTER</span>
<span>Explore Mars. Choose your next excursion.</span>
</div>
<div className="context-tabs">
<button title="Inspect global map layers, coverage and available excursion regions." aria-pressed={stationTab==='atlas'} onClick={()=>setStationTab('atlas')}>Planetary atlas</button>
<button title="Inspect dated environmental records and the labeled simulated outlook." aria-pressed={stationTab==='history'} onClick={()=>setStationTab('history')}>Data & history</button><Help label="About Station tools">The atlas selects datasets and sites. Data &amp; history compares dated observations and simulated outlooks. Local walking/planning requires prepared terrain. Use Tablet for local map, route history and expedition events.</Help>
</div>
</header>}
    {view==='globe'&&stationTab==='history'&&<div className="station-analysis">
<div className="station-environment-shell">{environmental.error?<div role="alert">{environmental.error}<button onClick={environmental.retry}>Retry environmental data</button>
</div>:environmental.catalog?<EnvironmentWorkspace catalog={environmental.catalog} selection={environmentSelection} onChange={setEnvironmentSelection} onApply={region?.id==='gale-bradbury'?applyEnvironmentSnapshot:undefined} applyNotice={environmentNotice}/>:<p role="status">Loading environmental observations…</p>}</div>
<StationHistory data={data} hour={weatherHour} playing={playing} onHour={changeHour} onToggle={()=>{if(playing)setPlaying(false);else{invalidate();setPose(p=>({...p,elapsed:0}));setSession(v=>v+1);if(weatherHour>=23.99)setSettings(s=>({...s,departureHour:0}));setPlaying(true);}}} onDataset={setBasemap} onAtlas={()=>setStationTab('atlas')}/>
</div>}
    {dataError&&view!=='plan'&&<div className="data-error" role="alert">{dataError} <button onClick={()=>setRetry(n=>n+1)}>Retry local data</button>
</div>}
    <div style={{display:view==='globe'&&stationTab==='atlas'?'block':'none'}}>
<GlobeExplorer onSuggested={openSuggested} environmentCatalog={environmental.catalog} environmentSelection={environmentSelection} onEnvironmentChange={setEnvironmentSelection} geology={geology} geologySelection={geologySelection} onGeologySettings={setGeology} onGeologySelect={setGeologySelection} onDemo={startDemo} data={data} dataError={dataError} route={route} selectedRegionId={selectedRegionId} onRegionChange={changeRegion} onSurface={()=>setView('walk')} onExplore={()=>{if(canPlan(region)){setTabletTab('explore');setView('plan');}}} basemap={basemap} onBasemapChange={setBasemap} visible={basemapVisible} onVisibleChange={setBasemapVisible} opacity={basemapOpacity} onOpacityChange={setBasemapOpacity} overlays={overlays} onOverlayChange={changeOverlay} conditionsHour={weatherHour} conditionsVisible={conditionsVisible} onConditionsChange={setConditionsVisible}/>
</div>
    {context==='surface'&&data&&canPlan(region)&&<main aria-hidden={tabletOpen||undefined} className={`hud-page ${tabletOpen||pauseMenu?'surface-paused':''} ${visor?'visor-enabled':''}`}>
<Suspense fallback={<div className="loading-data">Opening the surface HUD…</div>}>
<WalkingScene paths={savedTraces} events={activeEvents} returning={returning} key={`${session}-${rendererRetry}-${quality}-${imagery}`} active={view==='walk'&&!pauseMenu} imagery={imagery} onFailure={()=>setSceneFailed(true)} onUnavailable={()=>{setView('plan');setFieldNotice('The 3D display is unavailable. Your mission is retained on the Tablet. Retry HUD to reopen the scene.');}} fields={sharedFields} onFieldSelect={setSelectedField} hud={hud} start={start} goal={returning?start:goal} next={progress?{x:progress.target[0],y:progress.target[1]}:undefined} data={data} route={guidance} settings={missionSettings} initialPose={pose} timeScale={timeScale} quality={quality} onPose={updatePose} onBlocked={setBlocked}/>
</Suspense>{!tabletOpen&&<>{visor&&<Visor waypoints={!!progress&&hud.waypoints&&hud.next} pose={pose} target={progress?{x:progress.target[0],y:progress.target[1]}:undefined}/>}<header className="hud-heading">
<span className="eyebrow">{region?.shortName.toUpperCase()} / SURFACE EXCURSION</span>
<h2>{returning?(back?.atHabitat?'Habitat reached':'Returning to habitat'):reached?'Destination reached.':!route?'Free exploration':route.mode==='shortest'?'On the shortest traverse.':'Taking the gentler path.'}</h2>
<span>{scienceTarget&&route?`Science destination: ${scienceTarget.name} · simulated position`:'Simulated position · mission clock pauses with Esc'}</span>
</header>{hud.minimap&&<aside className="hud-map">
<SurfaceMap events={activeEvents} traces={mapTraces} imagery={imagery} data={data} start={start} goal={route?goal:undefined} routes={result?.routes} fields={sharedFields} selected={selected} pose={pose} exclusions={missionSettings.exclusions} overlays={{...defaultOverlays(),imagery:{visible:true,opacity:1}}} mini/>
<div>
<span>N ↑ · H HABITAT</span>{route&&<span>D DESTINATION</span>}</div>
</aside>}<div className="hud-clock-panel">
<MissionClocks sol={data?.environment.sol??10} hour={scenarioHour} historical={settings.conditionsMode==='historical'} mars={hud.marsTime} earth={hud.earthTime}/>
</div>
<div className="hud-bottom">{progress&&<div>
<small>NEXT WAYPOINT</small>
<strong>{progress?distance(Math.hypot(progress.target[0]-pose.x,progress.target[1]-pose.y)):'—'}</strong>
<span>{progress?`${((Math.atan2(progress.target[0]-pose.x,progress.target[1]-pose.y)*180/Math.PI+360)%360).toFixed(0)}° bearing · ${distance(progress.remainingM)} remaining`:'—'}</span>
</div>}<div>
<small>HEADING</small>
<strong>{((pose.heading*180/Math.PI+360)%360).toFixed(0)}°</strong>
<span>{local?.elevation.toFixed(1)} m areoid elevation</span>
</div>
<div>
<small>MISSION ELAPSED</small>
<strong data-testid="elapsed">{pose.elapsed.toFixed(1)} s</strong>
<span>{(pose.elapsed/3600*settings.doseRateMicroGyH).toFixed(3)} µGy proxy</span>
</div>
<div>
<small>RETURN TO HABITAT</small>
<strong>{back?.atHabitat?'At habitat':back?.route?duration(back.route.metrics.durationS):returnError?'Unavailable':'Checking…'}</strong>
<span>{back?.route?`${duration(Math.max(0,settings.maxDurationMin*60-totalReturn))} time reserve`:'Updates: 25 m / 60 s'}</span>
</div>
<div>
<small>{settings.conditionsMode==='historical'?'HISTORICAL CONDITIONS':'FIXED SCENARIO'}</small>
<strong>{currentTemperature?.toFixed(1)??'—'} K</strong>
<span>{settings.windMps.toFixed(1)} m/s assumed wind</span>
</div>
</div>
<aside className="hud-events" aria-label="Visor event feed" aria-live="polite">
{activeEvents.slice(-1).map(e=><article key={e.id} className="hud-event-card danger"><span className="eyebrow">SIMULATED HAZARD · {e.acknowledged?'ACKNOWLEDGED':'NEW'}</span><strong>{eventInstruction(e,pose,start)}</strong><p>{EVENT_NAMES[e.kind]}</p><button onClick={openEvents}>Event details →</button>{e.kind==='solar'&&back?.route&&<button onClick={returnToHabitat}>Guide to habitat</button>}</article>)}
{currentAlerts.slice(0,1).map(a=><article key={a} className="hud-event-card"><span className="eyebrow">MISSION / CAUTION</span><p>{a}</p><button onClick={openEvents}>View warnings →</button></article>)}
{!activeEvents.length&&!currentAlerts.length&&<article className="hud-event-card"><span className="eyebrow">EXPEDITION / EVENTS</span><p>No active warnings</p><button onClick={openEvents}>Open event feed →</button></article>}
{(activeEvents.length>1||currentAlerts.length>1)&&<button className="event-overflow" onClick={openEvents}>All {activeEvents.length+currentAlerts.length} active events / warnings →</button>}
{reached&&<p className="success">Destination reached. Return to habitat when ready.</p>}
{returnError&&<article className="hud-event-card"><p>{returnError}</p><button onClick={()=>{lastReturn.current={x:Infinity,y:Infinity};setReturnRetry(v=>v+1);}}>Retry return estimate</button></article>}
</aside>
<div className="hud-actions">
<button className="primary" onClick={()=>{setTabletTab('explore');setView('plan');}}>Open tablet</button>
<button className="secondary" onClick={logHere}>Log here</button>
<button className="secondary" aria-expanded={pauseMenu} onClick={()=>setPauseMenu(v=>!v)}>Pause / menu</button>
</div>
      {pauseMenu&&<section className="pause-menu" aria-label="Simulation menu">
<h2>Excursion paused</h2>
<p>Click Resume, then click the terrain to walk.</p>
<button className="primary" onClick={()=>setPauseMenu(false)}>Resume</button>
<button onClick={()=>{setPauseMenu(false);setTabletTab('setup');setView('plan');}}>Display settings</button>
<button onClick={()=>{setPauseMenu(false);setView('globe');}}>Return to Station</button>
<button onClick={reset}>Restart excursion</button>
</section>}
      {activeField&&<aside className="hud-field-inspector" aria-label="HUD field inspection">
<button className="secondary" onClick={()=>setSelectedField(undefined)}>Close field inspection</button>
<FieldDetails record={activeField}/>
<button className="secondary" onClick={()=>openFields(activeField.id)}>Edit on tablet →</button>
</aside>}<div className="pose-readout" data-testid="position">E {pose.x.toFixed(1)} / N {pose.y.toFixed(1)} m</div>
</>}</main>}

    <TabletShell open={view==='plan'} title={region?.shortName??'Astronaut tablet'} onClose={()=>setView(canPlan(region)&&data?'walk':'globe')}>
      <header className="tablet-header">
<div>
<span className="eyebrow">ASTRONAUT TABLET · SIMULATED DEVICE</span>
<h1>{region?.shortName??'Local exploration'}</h1>
</div>
<span className="tablet-paused">Ⅱ Surface paused</span>
<button className="secondary" onClick={()=>setView(canPlan(region)&&data?'walk':'globe')}>{canPlan(region)&&data?'Close tablet':'Back to Station'} <kbd>Esc</kbd>
</button>
</header>
      <nav className="tablet-tabs" aria-label="Tablet tools">{([['explore','Map'],['routes','Routes'],['field','Field data'],['setup','Display'],['events','Events']] as const).map(([id,label])=>
<button key={id} title={{explore:"Inspect local terrain, layers and data provenance.",routes:"Plan terrain routes; save and compare actual walks.",field:"Create, inspect and edit shared location-linked records.",setup:"Configure visor cues, clocks, graphics and simulation pace.",events:"Inspect warnings and schedule simulated expedition hazards."}[id]} aria-label={label} disabled={id!=='explore'&&!canPlan(region)} aria-pressed={tabletTab===id} onClick={()=>{setTabletTab(id);setMapPanel(undefined);setMode('inspect');}}>{label}{id==='field'&&fieldDraft&&<span className="draft-dot"> · draft</span>}</button>)}<Help label="Using the astronaut tablet">This is the astronaut’s simulated tablet, operated with your laptop’s mouse and keyboard. The surface and mission clock pause while it is open. Closing it retains your position; click terrain to resume.</Help>
</nav>
      <ContextGuide key={tabletTab} topic={tabletTab}/>{fieldNotice&&<p className="field-notice" role="status">{fieldNotice}</p>}{dataError&&<div className="tablet-error" role="alert">{dataError} <button onClick={()=>setRetry(n=>n+1)}>Retry local data</button>
</div>}
      {error&&!routeFailure&&<div className="tablet-error" role="alert">{error}</div>}
      {!canPlan(region)?<main className="empty-context">
<h2>Orbital exploration only</h2>
<p>Local numeric terrain is not prepared at {region?.shortName}. Visit a prepared Gale site to walk or use the local map.</p>
<button className="primary" onClick={()=>setView('globe')}>Open Station atlas</button>
</main>:<>
      <div className={`tablet-main ${tabletTab==='routes'?'with-routes':''} ${mapPanel?'with-map-panel':''}`} style={{display:tabletTab==='explore'||tabletTab==='routes'?undefined:'none'}}>
      <aside className="mission-sidebar" aria-label="Routes">
<div className="route-workflow"><div className="eyebrow">ROUTES</div><div className="route-workflow-switch" role="group" aria-label="Route workflow">
<button aria-pressed={routeWorkflow==='new'} onClick={()=>{setRouteWorkflow('new');setMapPanel(undefined);}}>Plan new route</button>
<button aria-pressed={routeWorkflow==='saved'} onClick={()=>{setRouteWorkflow('saved');setMapPanel(undefined);setMode('inspect');}}>Load previous path</button>
</div></div>
{routeWorkflow==='saved'?<section aria-label="Previous paths panel"><h1>Previous paths</h1>{data&&<TraverseHistory store={traverses} library={pathLibrary} data={data} onSave={name=>{const id=traverses.save(name,missionSettings,start,goal,!!reached,route?.mode);if(id)pathLibrary.toggle(id,true);}}/>}</section>:<>{guide&&<section className="science-guide" aria-label="Guided science example">
<details>
<summary>Guided Gale example · {scienceTarget?.name??'Choose a target'}</summary>
<h3>{scienceTarget?.question??'Choose a geological question.'}</h3>
<p>Inspect the target evidence, compare terrain routes, then enter the surface.</p>
<button className="secondary" onClick={()=>{setMapPanel('evidence');setTabletTab('explore');}}>Inspect data evidence</button>
<p className="caption">Visit areas are from later sols in 2012; Sol 10 weather is a separate scenario.</p>
<button className="text-button" onClick={()=>{setGuide(false);updateDemoUrl(false);}}>Continue free exploration</button>
</details>
</section>}
        <div className="eyebrow">{region?.shortName.toUpperCase()} / EXCURSION</div>
<h1>Plan your traverse.</h1>
<p className="subtle">Compare from habitat to destination. Your astronaut stays where you left them.</p>{selectedRegionId==='gale-boxwork'&&<label>Orbital imagery<select aria-label="Boxwork imagery" value={imagery} onChange={e=>setImagery(e.target.value as 'colour'|'grey')}>
<option value="colour">HiRISE colour mosaic</option>
<option value="grey">HiRISE greyscale</option>
</select>
<small>Processed colour; not a true-colour claim. Display changes retain the mission.</small>
</label>}
        <details className="target-picker">
<summary>Science destinations</summary>
<ScienceTargets selected={targetId} onSelect={selectTarget} data={data} settings={missionSettings}/>
</details>
<section>
<div className="section-label">01 / SET YOUR ENDPOINTS <Help label="About route endpoints">H is the habitat and return destination. D is your outbound destination. Planning compares these endpoints, even if you have already walked elsewhere. Only moving H or changing departure restarts the excursion.</Help></div>
<div className="endpoint">
<span className="point-label habitat">H</span>
<div>
<strong>Habitat / start</strong>
<small>Placing a new habitat restarts the excursion.</small>
<small>{start.x.toFixed(0)} E · {start.y.toFixed(0)} N m</small>
</div>
<button title="Click valid map terrain to move the habitat and restart the excursion." aria-pressed={mode==='start'} onClick={()=>setMode('start')}>Place</button>
</div>
<div className="endpoint">
<span className="point-label destination">D</span>
<div>
<strong>Destination</strong>
<small>{goal.x.toFixed(0)} E · {goal.y.toFixed(0)} N m</small>
</div>
<button title="Click valid map terrain to set a destination; your astronaut stays in place." aria-pressed={mode==='goal'} onClick={()=>setMode('goal')}>Place</button>
</div>
<div className="button-row">
<button className="secondary" aria-pressed={mode==='exclude'} onClick={()=>setMode(mode==='exclude'?'inspect':'exclude')}>＋ Exclusion</button>
<button className="text-button" disabled={!settings.exclusions.length} onClick={()=>changeSettings({...settings,exclusions:[]})}>Clear exclusions</button>
</div>
<p className="caption">Manual exclusions are user-declared 40 m areas. Edit field restrictions in Field data.</p>
</section>
        <section>
<details className="advanced-assumptions">
<summary>Mission assumptions & limits</summary><Help label="About mission assumptions">These values define a demonstration: speed, permitted terrain slope, excursion time and detector-dose budget. Historical gaps remain unknown. µGy is a rover-detector proxy, not an astronaut safety assessment. Details are in Help · controls &amp; symbols.</Help>
<div className="section-label">DEMONSTRATION SETTINGS</div>
<div className="settings-grid">
          {([['speedMps','Walking speed','m/s',.1,3,.1],['maxSlopeDeg','Slope limit','°',1,45,1],['maxDurationMin','Time budget','min',1,480,1],['doseRateMicroGyH','Detector rate proxy','µGy/h',0,10000,.01],['maxDoseMicroGy','Dose proxy budget','µGy',.01,100000,1],['dwellMin','Destination stop','min',0,240,1]] as const).map(([key,label,unit,min,max,step])=>
<label key={key}>{label}<span>
<input aria-label={label} type="number" min={min} max={max} step={step} value={settings[key]} onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))changeSettings({...settings,[key]:e.target.valueAsNumber});}}/> {unit}</span>
</label>)}
        </div>
<label>Departure (restarts excursion)<select aria-label="Historical hour" value={Math.floor(weatherHour)} onChange={e=>changeHour(Number(e.target.value))}>{data?.environment.weather.map(w=>
<option key={w.hour} value={w.hour}>{String(w.hour).padStart(2,'0')}:00 LMST</option>)}</select>
</label>
<label className="conditions-mode">Conditions <select aria-label="Conditions mode" value={settings.conditionsMode} onChange={e=>changeSettings({...settings,conditionsMode:e.target.value as Settings['conditionsMode']})}>
<option value="historical">Historical Sol {data?.environment.sol??10}</option>
<option value="manual">Manual fixed scenario</option>
</select>
</label>
<p className="caption">{settings.conditionsMode==='historical'?`Departure ${lmstLabel(weatherHour)} · REMS temperature changes along the excursion. Wind remains an assumption.`:'Temperature and wind held at the values below.'}</p>
<details>
<summary>Departure conditions and limits</summary>
<div className="settings-grid">{([['temperatureK','Temperature','K',100,350],['minTemperatureK','Minimum temperature','K',100,350],['windMps','Wind assumption','m/s',0,200],['maxWindMps','Maximum wind','m/s',0,200]] as const).map(([key,label,unit,min,max])=>
<label key={key}>{label}<span>
<input aria-label={label} disabled={key==='temperatureK'&&settings.conditionsMode==='historical'} type="number" min={min} max={max} step=".1" value={key==='temperatureK'&&settings.conditionsMode==='historical'?(observed?.temperatureK??''):settings[key]} onChange={e=>{if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))changeSettings({...settings,[key]:e.target.valueAsNumber});}}/> {unit}</span>
</label>)}</div>
</details>
<p className="caption">Demonstration settings. Dose refers to a rover-detector proxy; limits are not astronaut safety standards.</p>
<p className="caption" aria-label="Active route constraints">Slope limit {settings.maxSlopeDeg}° · {settings.exclusions.length} manual exclusions · {fieldExclusions(sharedFields).length} saved field restrictions (including hidden annotations).</p>
</details>{error&&routeFailure&&data&&<RouteFailure diagnostics={routeFailure} data={data} manualCount={settings.exclusions.length} restrictions={sharedFields.filter(r=>r.kind==='obstacle'&&r.restrictTravel)} onField={openFields}/>}</section>
        {result&&<section className="route-options" aria-label="Route alternatives">
<div className="section-label">03 / CHOOSE YOUR TRAVERSE</div>{result.routes.map((r,i)=>
<button className={`route-card ${selected===i?'selected':''}`} key={r.mode} aria-pressed={selected===i} onClick={()=>{setReturning(false);setSelected(i);setProfileEdge(undefined);setBack(undefined);lastReturn.current={x:Infinity,y:Infinity};}}>
<span>{r.mode==='shortest'?'01 / SHORTEST PERMITTED':'02 / GENTLER TERRAIN'}{result.recommendedIndex===i?(r.conditions.status==='within'?' · RECOMMENDED':' · FEWEST WARNINGS'):''}<b>{distance(r.metrics.distanceM)}</b>
</span>
<strong>{duration(r.metrics.durationS)} <small>outbound · {Math.round(r.metrics.ascentM)} m ascent</small>
</strong>
<small>{r.metrics.maxSlopeDeg.toFixed(1)}° max slope · {r.roundTripDoseMicroGy.toFixed(2)} µGy return-inclusive proxy</small>
<small>Excursion including return: {duration(r.roundTripS)}</small>
<small className={`condition-status ${r.conditions.status}`}>{r.conditions.status==='within'?'Within configured limits':r.conditions.status==='unknown'?'Conditions unknown':'Limits exceeded'} · minimum {r.conditions.minTemperatureK?.toFixed(1)??'unknown'} K</small>{(r.conditions.coldSeconds>0||r.conditions.unknownSeconds>0)&&<small>{(r.conditions.coldSeconds/60).toFixed(1)} min below limit · {(r.conditions.unknownSeconds/60).toFixed(1)} min unknown</small>}</button>)}{route&&<>{result.routes.every(r=>r.conditions.status!=='within')&&<p className="caption">Neither evaluated candidate is within all configured limits. Other possible routes have not been ruled out.</p>}<p className="caption">Recommendation compares these two candidates under temperature, time and detector-dose limits. It is not a constrained route optimum.</p>
<div className="warning-list">{route.warnings.map(w=>
<p role="status" key={w}>{w}</p>)}</div>{route.departures.length>0&&<details className="departure-comparison">
<summary>Compare departure hours</summary>
<p className="caption">Same round trip + stop, evaluated at every hour. Select a departure, then plan a route again. Dose: {route.roundTripDoseMicroGy.toFixed(2)} µGy at every departure (fixed rate).</p>
<div className="departure-grid">{route.departures.map(d=>
<button key={d.departureHour} className={d.status} aria-label={`Depart ${d.departureHour}:00: ${d.status}`} aria-pressed={Math.floor(weatherHour)===d.departureHour} onClick={()=>changeHour(d.departureHour)}>{String(d.departureHour).padStart(2,'0')}:00<small>{d.minTemperatureK?.toFixed(0)??'—'} K · {d.status}</small>
</button>)}</div>
</details>}</>}</section>}

        {guide&&<button className="secondary full" onClick={startDemo}>Reset guided example</button>}<button className="text-button reset" onClick={reset}>↺ Reset example excursion</button>
<p className="caption">Restores example endpoints and mission settings. Saved field restrictions remain active; edit them in Field data.</p>
      {result&&<RouteExplanation routes={result.routes} selected={selected} edge={profileEdge} onEdge={setProfileEdge} settings={missionSettings}/>}</>}</aside>
      <section className="terrain-workspace" aria-label="Local terrain map">
<header className="map-toolbar">
<span>{mode==='inspect'?'LOCAL MAP':mode==='start'?'CLICK MAP · RESTART AT NEW HABITAT':mode==='goal'?'CLICK MAP · SET DESTINATION':'CLICK MAP · ADD EXCLUSION'}</span>
<div>
<button className="secondary" aria-expanded={mapPanel==='layers'} onClick={()=>setMapPanel(mapPanel==='layers'?undefined:'layers')}>Layers</button><Help label="About map layers">Imagery provides visual context; elevation and slope come from numeric terrain. Opacity only changes the display. Regional environmental bins and point readings retain their source footprint.</Help>
<button className="secondary" aria-expanded={mapPanel==='evidence'} onClick={()=>setMapPanel(mapPanel==='evidence'?undefined:'evidence')}>Inspect data</button><Help label="About data inspection">Inspect a map location to read source, units, resolution, date, coverage and uncertainty. Missing coverage stays unknown.</Help>
<button className="secondary" onClick={logHere}>Log here</button>
</div>
</header>
        {data?<SurfaceMap events={activeEvents} traces={mapTraces} imagery={imagery} environmentLayer={environmentLayer} environmentOpacity={environmentSelection.opacity} active={view==='plan'&&(tabletTab==='explore'||tabletTab==='routes')} pose={pose} fields={sharedFields} selectedField={selectedField} onFieldSelect={openFields} data={data} start={start} goal={goal} routes={result?.routes} selected={selected} geology={geology} targetId={targetId} onTargetSelect={selectTarget} highlightedEdge={profileEdge} exclusions={missionSettings.exclusions} overlays={overlays} mode={mode} onPick={pick} onInspect={setInspection}/>:<div className="loading-data">{dataError?'Local data unavailable.':'Opening the prepared terrain…'}</div>}
        <div className="trace-legend" aria-label="Traverse map legend"><span style={{color:'#72e8ed'}}>┄ Current walk</span>{savedTraces.map(t=><span key={t.id} style={{color:t.color}}>━ {t.label}</span>)}{activeEvents.length>0&&<span className="hazard-legend">● Scenario area · solar: exposed outside green shelter</span>}</div>
        <div className="inspection" aria-label="Terrain inspection">
<span>
<small>LOCATION</small>{geo?`${geo[1].toFixed(5)}° N / ${geo[0].toFixed(5)}° E`:'—'}</span>
<span>
<small>AREOID ELEVATION</small>{measured?`${measured.elevation.toFixed(1)} m`:'Outside valid data'}</span>
<span>
<small>LOCAL MAX SLOPE</small>{measured?`${measured.slope.toFixed(1)}°`:'—'}</span>

</div>


      </section>
      {mapPanel&&<aside className="map-detail-panel" aria-label={mapPanel==='layers'?'Map layers':'Data evidence'}>
<header>
<h2>{mapPanel==='layers'?'Map layers':'Data evidence'}</h2>
<button className="text-button" onClick={()=>setMapPanel(undefined)}>Close</button>
</header>{mapPanel==='layers'?<>
<div className="layer-bar">{environmental.error&&<p role="alert">{environmental.error} <button onClick={environmental.retry}>Retry environmental data</button>
</p>}{OVERLAYS.map(layer=>
<label key={layer.id}>
<input aria-label={layer.name} type="checkbox" checked={overlays[layer.id].visible} onChange={e=>changeOverlay(layer.id,{visible:e.target.checked})}/>{layer.name}<input aria-label={`${layer.name} opacity`} type="range" min="0" max="100" value={overlays[layer.id].opacity*100} onChange={e=>changeOverlay(layer.id,{opacity:Number(e.target.value)/100})}/>
</label>)}</div>
<p className="caption">{[...(elevation?['Elevation: teal low → rust high']:[]),...(slope?['Slope: teal 0° → rust 30°']:[])].join(' · ')||'Enable a numeric layer to see its display legend.'}</p>{environmental.catalog&&<details className="tablet-environment">
<summary>Environmental observations & forecast layers</summary>
<EnvironmentControls catalog={environmental.catalog} selection={environmentSelection} onChange={setEnvironmentSelection} prefix="Tablet "/>
<label>Site-data sol<select aria-label="Tablet environmental sol" value={environmentSelection.sol} onChange={e=>setEnvironmentSelection(v=>({...v,sol:Number(e.target.value)}))}>{environmental.catalog.history.sols.map(d=>
<option key={d.sol} value={d.sol}>Observed Sol {d.sol}</option>)}<option value={environmental.catalog.forecast.targetSol}>Simulated Sol {environmental.catalog.forecast.targetSol}</option>
</select>
</label>
<label>Instrument hour<input aria-label="Tablet environmental hour" type="range" min="0" max="23" step="1" value={environmentSelection.hour} onChange={e=>setEnvironmentSelection(v=>({...v,hour:Number(e.target.value)}))}/>
<output>{environmentSelection.hour}:00</output>
</label>
<p className="environment-local-note">Layers retain their source scale. A coarse bin covering this patch is regional context; point markers do not imply a local field. No MCS sounding here means unknown temperature. Analysis epoch: Sol {environmentSelection.sol}; mission clock is separate.</p>
</details>}<GeologyPanel compact regionId={region!.id} settings={geology} selection={geologySelection} onSettings={setGeology} onSelect={setGeologySelection}/>
</>:<>
{data&&<DataProvenance data={data} point={inspection} settings={missionSettings} targetId={targetId}/>}
        {data&&<details className="provenance">
<summary>Data coverage, references and assumptions ↗</summary>
<p>{data.meta.resolutionNote}</p>
<p>{data.meta.slopeDefinition} Valid terrain: {(data.meta.validFraction*100).toFixed(1)}% of patch. Native fine-hazard coverage still requires field verification.</p>
<p>{data.meta.verticalReference}</p>
<p>{data.environment.weatherNote}</p>
<p>{data.environment.radiation.note}</p>
<p>{result?.assumptions??'Route duration uses configured speed with uphill/downhill penalties. Environmental values are site-level context, not a spatial forecast.'}</p>
<div className="source-links">{data.meta.sources.map(s=>
<a key={s.url} href={s.catalog} target="_blank" rel="noreferrer">{s.name} ↗</a>)}<a href={data.environment.weatherSource} target="_blank" rel="noreferrer">REMS source ↗</a>
<a href={data.environment.radiation.source} target="_blank" rel="noreferrer">RAD source ↗</a>
</div>
<p>{data.meta.attribution}</p>
</details>}
</>}</aside>}
      </div>
    {data&&canPlan(region)&&<FieldWorkspace active={view==='plan'&&tabletTab==='field'} data={data} records={sharedFields} draft={fieldDraft} onDraft={draft=>{setFieldDraft(draft);if(!draft)setFieldNotice(n=>n.startsWith('Your unfinished')?'':n);}} selected={selectedField} onSelect={setSelectedField} pose={pose} inspection={inspection} departureHour={weatherHour} exclusions={missionSettings.exclusions} onCommit={commitFields} onUndo={undoFields} canUndo={!!fieldStore.past.length} storageError={fieldStore.error} unread={fieldStore.unread} onRecover={fieldStore.recover}/>}
    {view==='plan'&&tabletTab==='events'&&<EventsPanel events={events} elapsed={pose.elapsed} pose={pose} habitat={start} alerts={currentAlerts} onAdd={addEvent} onUpdate={updateEvent} onReturn={returnToHabitat} canReturn={!!back?.route} returnNotice={returnNotice}/>}
    {view==='plan'&&tabletTab==='setup'&&<main className="tablet-setup">
<HudConfiguration data={data} regionId={selectedRegionId} sol={data?.environment.sol??10} value={hud} onChange={setHud} quality={quality} onQuality={setQuality} timeScale={timeScale} onTimeScale={setTimeScale}/>
<aside className="mission-snapshot">
<span className="eyebrow">SHARED MISSION</span>
<h2>{region?.shortName}</h2>
<p>{scienceTarget?.name??'Custom destination'} · {route?`${distance(route.metrics.distanceM)} planned`:'Free exploration · no route required'}</p>
<p data-testid="tablet-position">E {pose.x.toFixed(1)} / N {pose.y.toFixed(1)} m · {pose.elapsed.toFixed(1)} s elapsed</p>{canPlan(region)&&<MissionClocks sol={data?.environment.sol??10} hour={scenarioHour} historical={settings.conditionsMode==='historical'}/>}<button className="primary full" disabled={!data} onClick={()=>setView('walk')}>Close tablet · return to surface</button>
<button className="secondary full" onClick={()=>setTabletTab('explore')}>Explore local map →</button>
<p className="caption">Walking pauses here. Display settings do not reset the excursion.</p>
</aside>
</main>}

      </>}
      <footer className="tablet-footer">
<div>
<span data-testid="tablet-explore-position">E {pose.x.toFixed(1)} · N {pose.y.toFixed(1)} m · {pose.elapsed.toFixed(1)} s elapsed</span>
<span className="restriction-summary">{missionSettings.exclusions.length} active restrictions · {route?'Route selected':'Free exploration'}</span>
</div>{tabletTab==='routes'?<>{route&&<button className="text-button" onClick={()=>{invalidate();lastReturn.current={x:Infinity,y:Infinity};}}>Clear guidance</button>}{routeWorkflow==='new'&&<button className="plan-route-button" title="Calculate terrain route alternatives from habitat to destination using your current mission constraints." disabled={!data||busy} onClick={()=>{setMapPanel(undefined);void plan();}}>{busy?'Planning…':'Plan route'}</button>}
<button className="primary" disabled={!data} onClick={()=>setView('walk')}>{route?'Walk selected route →':'Enter surface'}</button>
</>:<button className="primary" disabled={!data} onClick={()=>setView('walk')}>Return to surface</button>}</footer>
    </TabletShell>
  </>;
}
