import { useEffect, useState } from 'react';
import { parseCatalog, type EnvironmentCatalog } from './model';
import { withBase } from '../assetUrl';

export function useEnvironmentCatalog(){
  const [catalog,setCatalog]=useState<EnvironmentCatalog>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setError('');
    fetch(withBase('/environment/catalog.json'),{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Environmental data package could not load.');return parseCatalog(await r.json());})
      .then(c=>{if(!controller.signal.aborted)setCatalog(c);}).catch(e=>{if(!controller.signal.aborted){setCatalog(undefined);setError(`Environmental layers unavailable: ${e.message}`);}});
    return()=>controller.abort();
  },[attempt]);
  return {catalog,error,retry:()=>setAttempt(n=>n+1)};
}
