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
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:[{loc:['body','settings','speedMps'],msg:'Input should be greater than or equal to 0.1'}]}),{status:422})));
  await expect(api('/api/routes',{})).rejects.toMatchObject({message:'Cannot plan route. Walking speed: Input should be greater than or equal to 0.1.',diagnostics:undefined});
});
it('explains an older planner rejecting Boxwork and historical settings',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:[
    {type:'literal_error',loc:['body','datasetId'],msg:"Input should be 'gale-bradbury-v1'"},
    {type:'extra_forbidden',loc:['body','settings','conditionsMode'],msg:'Extra inputs are not permitted'},
  ]}),{status:422})));
  const error=await api('/api/routes',{}).catch(e=>e);
  if(!(error instanceof RoutePlanningError))throw error;
  expect(error.message).toContain("Terrain dataset: Input should be 'gale-bradbury-v1'");
  expect(error.message).toContain('Conditions mode: Extra inputs are not permitted');
  expect(error.message).toContain('Restart the planner');
});
