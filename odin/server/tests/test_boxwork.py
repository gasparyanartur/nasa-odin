import json
import math
import unittest
from pathlib import Path
import numpy as np
from fastapi.testclient import TestClient
from server.app import app,load_data,Settings
from server.conditions import evaluate,HOUR_SECONDS

class BoxworkTests(unittest.TestCase):
    def test_canonical_grid_and_render_grid_registration(self):
        meta,t=load_data('gale-boxwork-v1')
        root=Path('public/boxwork')
        scene=json.loads((root/'detail/scene.json').read_text())
        raw=np.fromfile(root/'detail/dem_core.bin','<u2').reshape(1025,1025)
        for row,col in [(0,0),(100,100),(200,200),(30,140)]:
            x,y,h=t.point(row,col)
            fx=x/scene['ground_scale']['x']+512;fy=512-y
            c,r=int(fx),int(fy);dx,dy=fx-c,fy-r
            values=scene['height']['offset_m']+raw[r:r+2,c:c+2].astype(float)*scene['height']['scale_m']
            decoded=(values[0,0]*(1-dx)+values[0,1]*dx)*(1-dy)+(values[1,0]*(1-dx)+values[1,1]*dx)*dy
            self.assertAlmostEqual(h,decoded,places=3)
        self.assertEqual(meta['extentM'],1000)
        self.assertEqual(meta['stepM'],5)
        self.assertEqual(meta['regionId'],'gale-boxwork')
        self.assertGreater(float(t.slopes.max()),20)

    def test_boxwork_routes_return_constraints_and_site_bounds(self):
        meta,t=load_data('gale-boxwork-v1')
        client=TestClient(app)
        payload={'datasetId':meta['id'],'start':meta['defaultStart'],'goal':meta['defaultGoal'],'settings':{'conditionsMode':'historical','departureHour':12}}
        response=client.post('/api/routes',json=payload)
        self.assertEqual(response.status_code,200,response.text)
        result=response.json()
        self.assertEqual(result['datasetId'],meta['id'])
        self.assertEqual(result['version'],meta['version'])
        for route in result['routes']:
            self.assertGreater(route['metrics']['distanceM'],100)
            self.assertEqual(len(route['profile']),len(route['points']))
            self.assertLessEqual(route['metrics']['maxSlopeDeg'],20)
            self.assertEqual(route['returnRoute']['points'][-1],route['points'][0])
            for x,y,z in route['points']:self.assertLessEqual(abs(x),500);self.assertLessEqual(abs(y),500)
        returned=client.post('/api/return',json={**payload,'mode':'gentler','elapsedS':100}).json()
        self.assertEqual(returned['datasetId'],meta['id'])
        self.assertGreater(returned['route']['metrics']['distanceM'],0)
        blocked={**payload,'settings':{'exclusions':[{**meta['defaultStart'],'radius':40}]}}
        self.assertEqual(client.post('/api/routes',json=blocked).status_code,422)
        self.assertEqual(client.post('/api/routes',json={**payload,'goal':{'x':600,'y':0}}).status_code,422)
        self.assertEqual(client.post('/api/routes',json={**payload,'datasetId':'invented'}).status_code,422)
        health=client.get('/api/health').json()
        self.assertEqual({d['id'] for d in health['datasets']},{'gale-bradbury-v1','gale-boxwork-v1'})

    def test_epoch_is_site_specific_and_never_wraps_missing_weather(self):
        settings=Settings(conditionsMode='historical',departureHour=12)
        old=evaluate(settings,100)
        new=evaluate(settings,100,dataset_id='gale-boxwork-v1')
        self.assertNotEqual(old['minTemperatureK'],new['minTemperatureK'])
        expected=json.loads(Path('public/boxwork/environment.json').read_text())['weather'][12]['temperatureK']
        self.assertAlmostEqual(new['minTemperatureK'],expected)
        result=evaluate(Settings(conditionsMode='historical',departureHour=23.75),HOUR_SECONDS/2,dataset_id='gale-boxwork-v1')
        self.assertAlmostEqual(result['unknownSeconds'],HOUR_SECONDS/4)
