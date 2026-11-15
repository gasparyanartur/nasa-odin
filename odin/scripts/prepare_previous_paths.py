"""Save historical rover geometry and labeled planned examples in each site's path library."""
import json
import sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.planner import Terrain

ROOT=Path(__file__).resolve().parents[1]
for site in ('boxwork','gale'):
    base=ROOT/'public'/site
    meta=json.loads((base/'manifest.json').read_text())
    n=meta['size']
    terrain=Terrain(np.fromfile(base/'height.f32',dtype='<f4').reshape(n,n),np.fromfile(base/'slope.f32',dtype='<f4').reshape(n,n),np.fromfile(base/'valid.u8',dtype='u1').reshape(n,n),meta['stepM'])
    start=meta.get('defaultStart',{'x':0,'y':0})
    goal=meta.get('defaultGoal',{'x':600,'y':450})
    route=terrain.search((start['x'],start['y']),(goal['x'],goal['y']),{'maxSlopeDeg':20,'speedMps':.8,'doseRateMicroGyH':0,'exclusions':[]})
    common={'datasetId':meta['id'],'version':meta['version'],'regionId':meta.get('regionId','gale-bradbury')}
    paths=[]
    if site=='boxwork':
        evidence=json.loads((base/'evidence.json').read_text())
        paths.append({**common,'id':'curiosity-boxwork','name':'Curiosity · Boxwork traverse','kind':'rover','description':'Published Curiosity rover positions joined in mission order. Historical geometry, with different endpoints and vehicle capabilities. No rover travel duration is inferred.','sourceUrl':evidence['sourceUrl'],'solRange':[evidence['path'][0]['sol'],evidence['path'][-1]['sol']],'points':evidence['path'],'defaultVisible':True})
    paths.append({**common,'id':f'{site}-prepared-example','name':f'{"Boxwork ridge" if site=="boxwork" else "Bradbury"} · example route','kind':'example','description':'Prepared shortest-permitted route between the example endpoints, calculated on this terrain at 0.8 m/s with a 20° slope limit and no exclusions. Planned example, not an executed expedition. Replan to apply your current restrictions and assumptions.','points':[{'x':x,'y':y} for x,y,_ in route['points']],'estimatedDurationS':route['metrics']['durationS'],'defaultVisible':False})
    (base/'previous-paths.json').write_text(json.dumps({'schema':1,'paths':paths},indent=2)+'\n')
    meta['pathsFile']='previous-paths.json'
    if 'regionId' not in meta:meta['regionId']='gale-bradbury'
    (base/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
    print(site, len(paths), 'saved paths')
