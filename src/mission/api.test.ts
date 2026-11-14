import {afterEach,expect,it,vi} from 'vitest';
import {api,RoutePlanningError} from './data';

afterEach(()=>vi.unstubAllGlobals());
it('retains route diagnostics and a useful message from rejected routes',async()=>{
  const diagnostics={code:'blocked_endpoints',endpoints:[],notes:[],slopeLimitDeg:15,stepM:5,activeExclusionCount:0};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:'Habitat slope 18.4° exceeds 15°.',diagnostics}),{status:422})));
  const error=await api('/api/routes',{}).catch(e=>e);
  expect(error).toBeInstanceOf(RoutePlanningError);
  if(!(error instanceof RoutePlanningError))throw error;
  expect(error.message).toContain('18.4°');
  expect(error.diagnostics).toEqual(diagnostics);
});
it('keeps request validation failures separate from terrain diagnostics',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:[{msg:'Invalid settings'}]}),{status:422})));
  await expect(api('/api/routes',{})).rejects.toMatchObject({message:'Invalid mission settings or endpoints.',diagnostics:undefined});
});
