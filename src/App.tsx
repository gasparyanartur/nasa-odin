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
import InfoMark from './design/InfoMark';
import { Icon } from './design/icons';
import { HudNoticeList, HudToast, useHudNotices, type HudNotice } from './mission/HudNotices';
import { LMST_HOUR_SECONDS, historicalAt, lmstLabel, type GraphicsQuality } from './mission/conditions';
import SurfaceMap, { type PickMode } from './mission/SurfaceMap';
import { BASEMAPS, OVERLAYS, canPlan, defaultOverlays, getRegion, type RegionId, type OverlayId, type OverlaySettings } from './datasets/catalog';
const WalkingScene = lazy(() => import('./mission/WalkingScene'));
import { RoutePlanningError, type RouteDiagnostics, api, loadTerrain, localToGeo, routeProgress, sample, type Point, type Pose, type ReturnResult, type RouteResult, type Settings, type TerrainData } from './mission/data';

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
  function setView(next:'globe'|'plan'|'walk') { if(next==='walk'&&sceneFailed){setSession(v=>v+1);setSceneFailed(false);}setContext(next==='globe'?'globe':'surface');setTabletOpen(next==='plan'); }
  const [mapPanel,setMapPanel]=useState<'layers'|'evidence'|undefined>();
  const [pauseMenu,setPauseMenu]=useState(false);
  const [session,setSession]=useState(0);
  const [sceneFailed,setSceneFailed]=useState(false);
  const environmental=useEnvironmentCatalog(),[environmentSelection,setEnvironmentSelection]=useState(DEFAULT_ENVIRONMENT),[environmentNotice,setEnvironmentNotice]=useState('');
  const environmentLayer=environmental.catalog?availableLayers(environmental.catalog,environmentSelection).find(l=>l.id===environmentSelection.layerId):undefined;
  const [data,setData]=useState<TerrainData>(), [dataError,setDataError]=useState(''),[retry,setRetry]=useState(0);
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
  const [hud,setHud]=useState(DEFAULT_HUD),[stationTab,setStationTab]=useState<'atlas'|'history'>('atlas'),[tabletTab,setTabletTab]=useState<'explore'|'routes'|'setup'|'field'|'closer'>(directDemo?'routes':'explore');
  const [noticeList,setNoticeList]=useState(false);
  const visor=hud.visor;
  const [timeScale,setTimeScale]=useState(1);
  const [pose,setPose]=useState<Pose>({...HOME,heading:0,elapsed:0}),[blocked,setBlocked]=useState(false),[back,setBack]=useState<ReturnResult>(),[returnError,setReturnError]=useState('');
  const [returnRetry,setReturnRetry]=useState(0);
  const request=useRef<AbortController|null>(null),returnRequest=useRef<AbortController|null>(null),lastReturn=useRef<Point & {elapsed?:number}>({x:Infinity,y:Infinity});
  const route=result?.routes[selected];
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
    if(restrictionKey(next)!==restrictionKey(current.records)){invalidate();setFieldNotice('Travel restrictions changed. Compare routes again; astronaut position and mission time are retained.');lastReturn.current={x:Infinity,y:Infinity};}
    fieldStore.replace([...fieldStore.records.filter(r=>r.regionId!==region?.id),...next]);
  }
  function undoFields(){const previous=fieldStore.past[fieldStore.past.length-1];if(!previous)return;if(settings.exclusions.length+fieldExclusions(previous.filter(r=>r.regionId===region?.id)).length>30)throw new Error('Clear manual exclusions before restoring these restrictions.');if(restrictionKey(previous.filter(r=>r.regionId===region?.id))!==restrictionKey(sharedFields)){invalidate();lastReturn.current={x:Infinity,y:Infinity};setFieldNotice('Restriction edit undone. Compare routes again; position and time are retained.');}fieldStore.undo();}
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
  function invalidate(){setProfileEdge(undefined);request.current?.abort();returnRequest.current?.abort();setBusy(false);request.current=null;returnRequest.current=null;setResult(undefined);setBack(undefined);setError('');setRouteFailure(undefined);setReturnError('');}
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
    setEnvironmentNotice(`Copied ${snapshot.forecast?'simulated':'observed'} Sol ${environmentSelection.sol}, instrument hour ${environmentSelection.hour} into fixed manual mission assumptions. Previous routes were cleared; elapsed mission time, position and the Sol 10 clock anchor are retained. Compare routes again. No time-varying field was inferred.`);
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
  async function plan(){
    if(!data||!canPlan(region))return;setPlaying(false);request.current?.abort();const c=new AbortController();request.current=c;setBusy(true);setError('');setRouteFailure(undefined);setResult(undefined);setBack(undefined);
    try{const r=await api<RouteResult>('/api/routes',{datasetId:data.meta.id,start,goal,settings:missionSettings},c.signal);if(request.current!==c||c.signal.aborted)return;if(r.datasetId!==data.meta.id||r.version!==data.meta.version)throw new Error('Route dataset/version does not match the active terrain. Reload the site and compare again.');setResult(r);setSelected(r.recommendedIndex);setFieldNotice('');lastReturn.current={x:Infinity,y:Infinity};}
    catch(e){if(request.current===c&&(e as Error).name!=='AbortError'){setError((e as Error).message);setRouteFailure(e instanceof RoutePlanningError?e.diagnostics:undefined);}}
    finally{if(request.current===c)setBusy(false);}
  }
  const updatePose=useCallback((p:Pose)=>setPose(p),[]);
  useEffect(()=>{
    if(view!=='walk'||!data)return;
    if(Math.hypot(pose.x-lastReturn.current.x,pose.y-lastReturn.current.y)<(back?.atHabitat?5:25)&&pose.elapsed-(lastReturn.current.elapsed??-Infinity)<60)return;
    lastReturn.current={x:pose.x,y:pose.y,elapsed:pose.elapsed};returnRequest.current?.abort();const c=new AbortController();returnRequest.current=c;
    setBack(undefined);setReturnError('');
    api<ReturnResult>('/api/return',{datasetId:data.meta.id,start:{x:pose.x,y:pose.y},goal:start,settings:missionSettings,mode:route?.mode??'shortest',elapsedS:pose.elapsed},c.signal)
      .then(r=>{if(returnRequest.current===c&&!c.signal.aborted)setBack(r);}).catch(e=>{if(returnRequest.current===c&&e.name!=='AbortError')setReturnError(e.message);});
  },[view,route,data,pose,start,missionSettings,returnRetry]);
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
  const progress=route?routeProgress(route,pose):null;
  const totalReturn=pose.elapsed+(back?.route?.metrics.durationS??0);
  const reached=route&&Math.hypot(pose.x-goal.x,pose.y-goal.y)<8;
  const alerts=[...(route?.warnings??[]),...(back?.warnings??[])];
  if(settings.conditionsMode==='historical'&&currentTemperature==null)alerts.push('Historical temperature unavailable at the current mission time.');
  if(currentTemperature!=null&&currentTemperature<settings.minTemperatureK)alerts.push('Current temperature is below the configured demonstration limit.');
  if(blocked)alerts.push('Movement stopped: terrain limit, exclusion, or coverage boundary.');
  if(progress&&progress.offRouteM>25)alerts.push('You are more than 25 m off the planned route.');
  if(pose.elapsed>settings.maxDurationMin*60)alerts.push('Elapsed time exceeds the configured excursion budget.');
  if(pose.elapsed/3600*settings.doseRateMicroGyH>settings.maxDoseMicroGy)alerts.push('Accumulated detector-dose proxy exceeds the configured budget.');
  if(back?.route&&totalReturn>settings.maxDurationMin*60)alerts.push('Current return estimate exceeds the remaining time budget.');
  const uniqueAlerts=Array.from(new Set(alerts));
  const notices:HudNotice[]=[...uniqueAlerts.map(text=>({text,kind:'warning' as const})),...(returnError?[{text:returnError,kind:'warning' as const}]:[]),...(reached?[{text:'Destination reached. Return to the habitat or end the demonstration.',kind:'success' as const}]:[])];
  const hudNotices=useHudNotices(notices);
  const alertCount=uniqueAlerts.length+(returnError?1:0);
  const headingDeg=((pose.heading*180/Math.PI+360)%360).toFixed(0);
  const nextDistance=progress?distance(Math.hypot(progress.target[0]-pose.x,progress.target[1]-pose.y)):undefined;
  const nextLine=progress?`${((Math.atan2(progress.target[0]-pose.x,progress.target[1]-pose.y)*180/Math.PI+360)%360).toFixed(0)}° bearing · ${distance(progress.remainingM)} remaining`:undefined;
  const returnValue=back?.atHabitat?'At habitat':back?.route?duration(back.route.metrics.durationS):returnError?'Unavailable':'Checking…';
  const returnLine=back?.route?`${duration(Math.max(0,settings.maxDurationMin*60-totalReturn))} time reserve`:'Updates: 25 m / 60 s';
  const doseProxy=`${(pose.elapsed/3600*settings.doseRateMicroGyH).toFixed(3)} µGy proxy`;
  function retryReturn(){lastReturn.current={x:Infinity,y:Infinity};setReturnRetry(v=>v+1);}
  function openTablet(tab:typeof tabletTab='explore'){setMapPanel(undefined);setTabletTab(tab);setView('plan');}
  useEffect(()=>{
    if(view!=='walk')return;
    // Helmet controls also work from the keyboard: a helmet cannot click, and pointer lock hides the cursor while walking.
    const key=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey||e.repeat)return;
      if((e.target as HTMLElement|null)?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      const k=e.key.toLowerCase();
      if(k==='t'){e.preventDefault();openTablet(noticeList?'closer':'explore');}
      else if(k==='l'){e.preventDefault();logHere();}
      else if(k==='m'){e.preventDefault();setPauseMenu(v=>!v);}
      else if(k==='n'){e.preventDefault();setNoticeList(v=>!v);}
      else if(k==='x'){e.preventDefault();hudNotices.dismiss();}
      else if(k==='r'&&returnError){e.preventDefault();retryReturn();}
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  });

  return <>
    <nav inert={view==='plan'} className="mission-nav" aria-label="Main navigation">
<a className="nav-brand" href="#" onClick={e=>{e.preventDefault();setView('globe');}}>◉ <span>MARTIAN MAP</span>
</a>
<div className="view-tabs">
<button aria-current={view==='globe'?'page':undefined} onClick={()=>setView('globe')}>Station</button>
<button aria-current={view==='plan'?'page':undefined} disabled={!region} onClick={()=>setView('plan')}>Tablet</button>
<button aria-current={view==='walk'?'page':undefined} disabled={!data||!canPlan(region)} onClick={()=>setView('walk')}>HUD · Surface</button>
</div>
<span className="nav-site">{region?.shortName??'Choose a region'} <span className="live-dot"/> LAPTOP SIMULATION</span>
</nav>
    {view==='globe'&&<header className="context-bar">
<div>
<span className="eyebrow">STATION COMPUTER</span>
<span>Explore Mars. Choose your next excursion.</span>
</div>
<div className="context-tabs">
<button aria-pressed={stationTab==='atlas'} onClick={()=>setStationTab('atlas')}>Planetary atlas</button>
<button aria-pressed={stationTab==='history'} onClick={()=>setStationTab('history')}>Data & history</button>
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
<GlobeExplorer environmentCatalog={environmental.catalog} environmentSelection={environmentSelection} onEnvironmentChange={setEnvironmentSelection} geology={geology} geologySelection={geologySelection} onGeologySettings={setGeology} onGeologySelect={setGeologySelection} onDemo={startDemo} data={data} dataError={dataError} route={route} selectedRegionId={selectedRegionId} onRegionChange={changeRegion} onSurface={()=>setView('walk')} onExplore={()=>{if(canPlan(region)){setTabletTab('explore');setView('plan');}}} basemap={basemap} onBasemapChange={setBasemap} visible={basemapVisible} onVisibleChange={setBasemapVisible} opacity={basemapOpacity} onOpacityChange={setBasemapOpacity} overlays={overlays} onOverlayChange={changeOverlay} conditionsHour={weatherHour} conditionsVisible={conditionsVisible} onConditionsChange={setConditionsVisible}/>
</div>
    {context==='surface'&&data&&canPlan(region)&&<main aria-hidden={tabletOpen||undefined} className={`hud-page ${tabletOpen||pauseMenu?'surface-paused':''} ${visor?'visor-enabled':''}`}>
<Suspense fallback={<div className="loading-data">Opening the surface HUD…</div>}>
<WalkingScene key={`${session}-${quality}-${imagery}`} active={view==='walk'&&!pauseMenu} imagery={imagery} onFailure={()=>setSceneFailed(true)} onUnavailable={()=>{setView('plan');setFieldNotice('The 3D display is unavailable. Your mission is retained on the Tablet. Retry HUD to reopen the scene.');}} fields={sharedFields} onFieldSelect={setSelectedField} hud={hud} start={start} goal={goal} next={progress?{x:progress.target[0],y:progress.target[1]}:undefined} data={data} route={route} settings={missionSettings} initialPose={pose} timeScale={timeScale} quality={quality} onPose={updatePose} onBlocked={setBlocked}/>
</Suspense>{!tabletOpen&&<>{visor&&<Visor waypoints={!!progress&&hud.waypoints&&hud.next} pose={pose} target={progress?{x:progress.target[0],y:progress.target[1]}:undefined}/>}<header className="hud-heading">
<Icon name={reached?'check':route?'route':'compass'}/>
<div>
<span className="eyebrow sr-only">{region?.shortName.toUpperCase()} / SURFACE EXCURSION</span>
<h2>{reached?'Destination reached.':!route?'Free exploration':route.mode==='shortest'?'On the shortest traverse.':'Taking the gentler path.'}</h2>
<span className="sr-only">{scienceTarget&&route?`Science destination: ${scienceTarget.name} · simulated position`:'Simulated position · mission clock pauses with Esc'}</span>
</div>
</header>
<HudToast toasts={hudNotices.toasts} onDismiss={hudNotices.dismiss}/>
<div className="hud-corner">{hud.minimap&&<aside className="hud-map">
<SurfaceMap imagery={imagery} data={data} start={start} goal={route?goal:undefined} routes={result?.routes} fields={sharedFields} selected={selected} pose={pose} exclusions={missionSettings.exclusions} overlays={{...defaultOverlays(),imagery:{visible:true,opacity:1}}} mini/>
<span className="hud-map__north" aria-hidden="true">N</span>
<div className="sr-only">
<span>H HABITAT</span>{route&&<span>D DESTINATION</span>}</div>
</aside>}<div className="hud-clock-panel">
<MissionClocks compact sol={data?.environment.sol??10} hour={scenarioHour} historical={settings.conditionsMode==='historical'} mars={hud.marsTime} earth={hud.earthTime}/>
</div>
<HudNoticeList log={hudNotices.log} open={noticeList} onToggle={()=>setNoticeList(v=>!v)} onDetails={()=>openTablet('closer')}/>
</div>
<div className="hud-bottom" role="group" aria-label="Helmet status">
<div className={`hud-chip ${alertCount?'is-warning':''}`}>
<Icon name={alertCount?'warning':'fine'}/>
<small className="sr-only">ALERTS</small>
<strong>{alertCount?`${alertCount} ${alertCount===1?'alert':'alerts'}`:'No alerts'}</strong>
</div>{progress&&<div className="hud-chip">
<Icon name="place"/>
<small className="sr-only">NEXT WAYPOINT</small>
<strong>{nextDistance}</strong>
</div>}<div className="hud-chip">
<Icon name="clock"/>
<small className="sr-only">MISSION ELAPSED</small>
<strong data-testid="elapsed">{pose.elapsed.toFixed(1)} s</strong>
</div>
<div className={`hud-chip ${returnError?'is-warning':''}`}>
<Icon name="back"/>
<small className="sr-only">RETURN TO HABITAT</small>
<strong>{returnValue}</strong>{returnError&&<button type="button" className="hud-chip__act" aria-label="Retry return estimate" onClick={retryReturn}>Retry<kbd aria-hidden="true">R</kbd></button>}</div>
</div>
<div className="hud-actions">
<button className="primary" aria-label="Open tablet" onClick={()=>openTablet('explore')}><Icon name="tablet"/>Tablet<kbd aria-hidden="true">T</kbd></button>
<button className="secondary" aria-label="Log here" onClick={logHere}><Icon name="note"/>Log<kbd aria-hidden="true">L</kbd></button>
<button className="secondary" aria-label="Pause / menu" aria-expanded={pauseMenu} onClick={()=>setPauseMenu(v=>!v)}><Icon name="pause"/>Pause<kbd aria-hidden="true">M</kbd></button>
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
</aside>}<div className="pose-readout sr-only" data-testid="position">E {pose.x.toFixed(1)} / N {pose.y.toFixed(1)} m</div>
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
      <nav className="tablet-tabs" aria-label="Tablet tools">{([['explore','Map','area'],['routes','Routes','route'],['field','Field data','note'],['setup','Display','helmet'],['closer','Look closer','look']] as const).map(([id,label,icon])=>
<button key={id} aria-label={label} disabled={id!=='explore'&&!canPlan(region)} aria-pressed={tabletTab===id} onClick={()=>{setTabletTab(id);setMapPanel(undefined);setMode('inspect');}}><Icon name={icon}/>{label}{id==='field'&&fieldDraft&&<span className="draft-dot"> · draft</span>}</button>)}<Help label="Using the astronaut tablet">This is the astronaut’s simulated tablet, operated with your laptop’s mouse and keyboard. The surface and mission clock pause while it is open. Closing it retains your position; click terrain to resume.</Help>
</nav>
      {fieldNotice&&<p className="field-notice" role="status">{fieldNotice}</p>}{dataError&&<div className="tablet-error" role="alert">{dataError} <button onClick={()=>setRetry(n=>n+1)}>Retry local data</button>
</div>}
      {error&&!routeFailure&&<div className="tablet-error" role="alert">{error}</div>}
      {!canPlan(region)?<main className="empty-context">
<h2>Orbital exploration only</h2>
<p>Local numeric terrain is not prepared at {region?.shortName}. Visit a prepared Gale site to walk or use the local map.</p>
<button className="primary" onClick={()=>setView('globe')}>Open Station atlas</button>
</main>:<>
      <div className={`tablet-main ${tabletTab==='routes'?'with-routes':''} ${mapPanel?'with-map-panel':''}`} style={{display:tabletTab==='explore'||tabletTab==='routes'?undefined:'none'}}>
      <aside className="mission-sidebar" aria-label="Route planning">{guide&&<section className="science-guide" aria-label="Guided science example">
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
<div className="section-label">01 / SET YOUR ENDPOINTS</div>
<div className="endpoint">
<span className="point-label habitat">H</span>
<div>
<strong>Habitat / start</strong>
<small>Placing a new habitat restarts the excursion.</small>
<small>{start.x.toFixed(0)} E · {start.y.toFixed(0)} N m</small>
</div>
<button aria-pressed={mode==='start'} onClick={()=>setMode('start')}>Place</button>
</div>
<div className="endpoint">
<span className="point-label destination">D</span>
<div>
<strong>Destination</strong>
<small>{goal.x.toFixed(0)} E · {goal.y.toFixed(0)} N m</small>
</div>
<button aria-pressed={mode==='goal'} onClick={()=>setMode('goal')}>Place</button>
</div>
<div className="button-row">
<button className="secondary" aria-pressed={mode==='exclude'} onClick={()=>setMode(mode==='exclude'?'inspect':'exclude')}>＋ Exclusion</button>
<button className="text-button" disabled={!settings.exclusions.length} onClick={()=>changeSettings({...settings,exclusions:[]})}>Clear exclusions</button>
</div>
<p className="caption">Manual exclusions are user-declared 40 m areas. Edit field restrictions in Field data.</p>
</section>
        <section>
<details className="advanced-assumptions">
<summary>Mission assumptions & limits</summary>
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
<InfoMark title="Conditions" does={<>Historical: REMS temperature changes along the excursion; wind remains an assumption. Manual: temperature and wind are held at the values you set.</>} source={data?.environment.weatherNote}/>
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
<button className={`route-card ${selected===i?'selected':''}`} key={r.mode} aria-pressed={selected===i} onClick={()=>{setSelected(i);setProfileEdge(undefined);setBack(undefined);lastReturn.current={x:Infinity,y:Infinity};}}>
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
<p className="caption">Same round trip + stop, evaluated at every hour. Select a departure, then compare routes again. Dose: {route.roundTripDoseMicroGy.toFixed(2)} µGy at every departure (fixed rate).</p>
<div className="departure-grid">{route.departures.map(d=>
<button key={d.departureHour} className={d.status} aria-label={`Depart ${d.departureHour}:00: ${d.status}`} aria-pressed={Math.floor(weatherHour)===d.departureHour} onClick={()=>changeHour(d.departureHour)}>{String(d.departureHour).padStart(2,'0')}:00<small>{d.minTemperatureK?.toFixed(0)??'—'} K · {d.status}</small>
</button>)}</div>
</details>}</>}</section>}
        {guide&&<button className="secondary full" onClick={startDemo}>Reset guided example</button>}<button className="text-button reset" onClick={reset}>↺ Reset example excursion</button>
<p className="caption">Restores example endpoints and mission settings. Saved field restrictions remain active; edit them in Field data.</p>
      {result&&<RouteExplanation routes={result.routes} selected={selected} edge={profileEdge} onEdge={setProfileEdge} settings={missionSettings}/>}</aside>
      <section className="terrain-workspace" aria-label="Local terrain map">
<header className="map-toolbar">
<span>{mode==='inspect'?'LOCAL MAP':mode==='start'?'CLICK MAP · RESTART AT NEW HABITAT':mode==='goal'?'CLICK MAP · SET DESTINATION':'CLICK MAP · ADD EXCLUSION'}</span>
<div>
<button className="secondary" aria-expanded={mapPanel==='layers'} onClick={()=>setMapPanel(mapPanel==='layers'?undefined:'layers')}><Icon name="layers"/>Layers</button>
<button className="secondary" aria-expanded={mapPanel==='evidence'} onClick={()=>setMapPanel(mapPanel==='evidence'?undefined:'evidence')}><Icon name="look"/>Inspect data</button>
<button className="secondary" onClick={logHere}><Icon name="note"/>Log here</button>
</div>
</header>
        {data?<SurfaceMap imagery={imagery} environmentLayer={environmentLayer} environmentOpacity={environmentSelection.opacity} active={view==='plan'&&(tabletTab==='explore'||tabletTab==='routes')} pose={pose} fields={sharedFields} selectedField={selectedField} onFieldSelect={openFields} data={data} start={start} goal={goal} routes={result?.routes} selected={selected} geology={geology} targetId={targetId} onTargetSelect={selectTarget} highlightedEdge={profileEdge} exclusions={missionSettings.exclusions} overlays={overlays} mode={mode} onPick={pick} onInspect={setInspection}/>:<div className="loading-data">{dataError?'Local data unavailable.':'Opening the prepared terrain…'}</div>}
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
<div className="layer-row" key={layer.id}><label>
<input aria-label={layer.name} type="checkbox" checked={overlays[layer.id].visible} onChange={e=>changeOverlay(layer.id,{visible:e.target.checked})}/><Icon name={layer.id==='imagery'?'photo':layer.id==='elevation'?'height':'ground'}/>{layer.name}<input aria-label={`${layer.name} opacity`} type="range" min="0" max="100" value={overlays[layer.id].opacity*100} onChange={e=>changeOverlay(layer.id,{opacity:Number(e.target.value)/100})}/>
</label><InfoMark title={layer.name} does={layer.id==='imagery'?'Shows the orbital photo base under the route and the markers.':layer.id==='elevation'?'Colours the prepared terrain by height. Display only: routes use the numeric terrain either way.':'Colours the prepared terrain by local slope. Display only: the slope limit for routes is set under Routes.'} source={data?.meta.detail?(layer.id==='imagery'?'HiRISE processed colour/grey imagery · 0.25 m/pixel core':layer.id==='slope'?data.meta.slopeDefinition:`Teal low → rust high · ${data.meta.minElevationM.toFixed(1)} to ${data.meta.maxElevationM.toFixed(1)} m source elevations`):layer.legend} coverage={data?.meta.resolutionNote}/></div>)}</div>
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
    {view==='plan'&&tabletTab==='closer'&&<main className="tablet-closer" aria-label="Look closer">
<header>
<span className="eyebrow">LOOK CLOSER · BEHIND THE HELMET SYMBOLS</span>
<h1>The full readings.</h1>
<p className="subtle">The helmet keeps only symbols, the compass, the minimap and short notices. Every value it leaves out, and what it means, is here.</p>
</header>
<section className="closer-grid" aria-label="Helmet readings">
<article className="wall-label"><span className="wall-label__kicker"><Icon name="place"/>Next waypoint</span><strong className="wall-label__value">{nextDistance??'No route'}</strong><p>{nextLine??'Free exploration · no route guidance'}</p></article>
<article className="wall-label"><span className="wall-label__kicker"><Icon name="compass"/>Heading</span><strong className="wall-label__value">{headingDeg}°</strong><p>{local?`${local.elevation.toFixed(1)} m areoid elevation`:'Outside valid data'}</p></article>
<article className="wall-label"><span className="wall-label__kicker"><Icon name="clock"/>Mission elapsed</span><strong className="wall-label__value">{pose.elapsed.toFixed(1)} s</strong><p>{doseProxy}</p></article>
<article className="wall-label"><span className="wall-label__kicker"><Icon name="back"/>Return to habitat</span><strong className="wall-label__value">{returnValue}</strong><p>{returnLine}</p>{returnError&&<p className="closer-error">{returnError}</p>}</article>
<article className="wall-label"><span className="wall-label__kicker"><Icon name="thermo"/>{settings.conditionsMode==='historical'?'Historical conditions':'Fixed scenario'}</span><strong className="wall-label__value">{currentTemperature!=null?`${currentTemperature.toFixed(1)} K`:'No data'}</strong><p>{settings.windMps.toFixed(1)} m/s assumed wind</p></article>
<article className="wall-label"><span className="wall-label__kicker"><Icon name="place"/>Position</span><strong className="wall-label__value">E {pose.x.toFixed(1)} / N {pose.y.toFixed(1)} m</strong><p>Simulated position · minimap: H habitat{route?', D destination':''}</p></article>
</section>
<section className="closer-split">
<div className="wall-label"><h2>Clocks</h2><MissionClocks sol={data?.environment.sol??10} hour={scenarioHour} historical={settings.conditionsMode==='historical'}/></div>
<div className="wall-label"><h2>Notices</h2>{notices.length?<ul className="closer-notices">{notices.map(n=><li key={n.text} className={n.kind}><Icon name={n.kind==='success'?'check':'warning'}/>{n.text}</li>)}</ul>:<p>No active notices.</p>}{returnError&&<button className="secondary" onClick={retryReturn}>Retry the return estimate</button>}<p className="caption">In the helmet a notice shows as a symbol and one short line under the compass for about 10 seconds; the full list opens with the notice symbol at the side (key N).</p></div>
<div className="wall-label"><h2>Helmet keys</h2><dl className="closer-keys"><div><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>Walk; the mouse looks around</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Pause walking and release the mouse</dd></div><div><dt><kbd>T</kbd></dt><dd>Open this Tablet</dd></div><div><dt><kbd>L</kbd></dt><dd>Log an observation here</dd></div><div><dt><kbd>M</kbd></dt><dd>Pause menu</dd></div><div><dt><kbd>N</kbd></dt><dd>Open or close the notice list</dd></div><div><dt><kbd>X</kbd></dt><dd>Dismiss the newest notice</dd></div><div><dt><kbd>R</kbd></dt><dd>Retry the return estimate when it failed</dd></div></dl></div>
</section>
</main>}

      </>}
      <footer className="tablet-footer">
<div>
<span data-testid="tablet-explore-position">E {pose.x.toFixed(1)} · N {pose.y.toFixed(1)} m · {pose.elapsed.toFixed(1)} s elapsed</span>
<span className="restriction-summary">{missionSettings.exclusions.length} active restrictions · {route?'Route selected':'Free exploration'}</span>
</div>{tabletTab==='routes'?<>{route&&<button className="text-button" onClick={()=>{invalidate();lastReturn.current={x:Infinity,y:Infinity};}}>Clear guidance</button>}<button className="secondary" disabled={!data||busy} onClick={()=>void plan()}>{busy?'Comparing…':'Compare routes'}</button>
<button className="primary" disabled={!data} onClick={()=>setView('walk')}>{route?'Walk selected route →':'Enter surface'}</button>
</>:<button className="primary" disabled={!data} onClick={()=>setView('walk')}>Return to surface</button>}</footer>
    </TabletShell>
  </>;
}
