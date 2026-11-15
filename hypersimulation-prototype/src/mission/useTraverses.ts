import {useEffect,useRef,useState} from 'react';
import type {Point,Pose,Settings,TerrainData} from './data';
import {appendSample,loadTraverses,MAX_SAMPLES,MAX_TRAVERSES,traceDistance,TRAVERSE_KEY,writeTraverses,type Traverse} from './traverses';

export function useTraverses(data:TerrainData|undefined,epoch:string,pose:Pose){
  const [state,setState]=useState(()=>loadTraverses({getItem:key=>localStorage.getItem(key)}));
  const current=useRef<{epoch:string;points:Pose[]}>({epoch,points:[]});
  if(current.current.epoch!==epoch)current.current={epoch,points:[]};
  useEffect(()=>{
    if(!data)return;
    if(current.current.points.length<MAX_SAMPLES)current.current.points=appendSample(current.current.points,pose);
  },[data,epoch,pose]);
  const [notice,setNotice]=useState('');
  function commit(records:Traverse[]){
    if(state.unread){setNotice('Replace unread history explicitly before saving.');return false;}
    try{writeTraverses(localStorage,records);setState({records,error:'',unread:false});return true;}
    catch{setState(s=>({...s,error:'Traverse storage is unavailable or full. This save did not persist; download a backup before leaving.'}));return false;}
  }
  const snapshot=()=>current.current.points.length>=MAX_SAMPLES?current.current.points:appendSample(current.current.points,pose,true);
  function save(name:string,settings:Settings,habitat:Point,destination:Point,reached:boolean,plannedMode?:string){
    if(!data)return;
    const samples=snapshot();
    if(samples.length<2||traceDistance(samples)<.5){setNotice('Walk at least 0.5 m before saving an executed traverse.');return;}
    if(samples.length>MAX_SAMPLES){setNotice('Trace limit reached. Restart the excursion to record another trace.');return;}
    if(state.records.length>=MAX_TRAVERSES){setNotice('History contains 20 traverses. Delete an entry before saving another.');return;}
    const record:Traverse={id:crypto.randomUUID(),name:name.trim().slice(0,100)||`Traverse ${state.records.length+1}`,savedAt:new Date().toISOString(),datasetId:data.meta.id,version:data.meta.version,regionId:data.meta.regionId??'gale-bradbury',settings:structuredClone(settings),habitat:{...habitat},destination:{...destination},reached:reached&&samples.at(-1)?.elapsed===pose.elapsed,plannedMode,samples};
    if(commit([record,...state.records])){setNotice(`Saved “${record.name}” in this browser.`);return record.id;}
  }
  function backup(){
    let raw:string|null;try{raw=state.unread?localStorage.getItem(TRAVERSE_KEY):JSON.stringify({schema:1,records:state.records},null,2);}catch{setNotice('Browser storage cannot be read for backup. Your active trace remains in memory.');return;}
    const url=URL.createObjectURL(new Blob([raw??''],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='martian-traverses.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return {...state,notice,samples:data?snapshot():[],limit:current.current.points.length>=MAX_SAMPLES,save,remove:(id:string)=>commit(state.records.filter(r=>r.id!==id)),backup,recover:()=>{try{writeTraverses(localStorage,state.records);setState(s=>({...s,unread:false,error:''}));}catch{setNotice('Browser storage is still unavailable. Download a backup first.');}}};
}
