import {useEffect,useState} from 'react';
import type {TerrainData} from './data';
import {parsePreviousPaths,type PreviousPath} from './previous-paths';
const VISIBILITY_KEY='martian-map.path-visibility.v1';
export function usePreviousPaths(data?:TerrainData){
  const [paths,setPaths]=useState<PreviousPath[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [visibility,setVisibility]=useState<Record<string,boolean>>(()=>{try{const v=JSON.parse(localStorage.getItem(VISIBILITY_KEY)??'{}');return v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(x=>typeof x==='boolean')?v:{};}catch{return {};}});
  useEffect(()=>{
    setPaths([]);setError('');if(!data?.meta.pathsFile)return;
    const c=new AbortController();
    fetch(`${data.baseUrl}/${data.meta.pathsFile}`,{signal:c.signal}).then(r=>{if(!r.ok)throw new Error('Previous paths could not load. Your own walks and route planning remain available.');return r.json();}).then(v=>{const paths=parsePreviousPaths(v,data);if(!c.signal.aborted)setPaths(paths);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>c.abort();
  },[data,retry]);
  function show(path:PreviousPath){return visibility[path.id]??path.defaultVisible??false;}
  function toggle(id:string,visible:boolean){const next={...visibility,[id]:visible};setVisibility(next);try{localStorage.setItem(VISIBILITY_KEY,JSON.stringify(next));}catch{ /* Visibility remains usable for this session. */ }}
  return {paths,error,visibility,retry:()=>setRetry(v=>v+1),show,toggle};
}
