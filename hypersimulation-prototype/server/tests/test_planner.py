import math
import unittest
import numpy as np
from fastapi.testclient import TestClient
from server.planner import Terrain, NoRoute
from server.app import app, load_data

SETTINGS={'maxSlopeDeg':20,'speedMps':.8,'doseRateMicroGyH':10,'exclusions':[]}


class PlannerTests(unittest.TestCase):
    def terrain(self, z=None, valid=None):
        z=np.zeros((9,9)) if z is None else z
        return Terrain(z,np.zeros_like(z),np.ones_like(z) if valid is None else valid,1)

    def test_astar_matches_dijkstra_for_both_objectives(self):
        rng=np.random.default_rng(4)
        z=rng.uniform(0,.2,(9,9));valid=np.ones((9,9));valid[2:7,4]=0;valid[5,4]=1
        t=self.terrain(z,valid)
        for mode in ['shortest','gentler']:
            a=t.search((-3,-3),(3,3),SETTINGS,mode)
            d=t.search((-3,-3),(3,3),SETTINGS,mode,True)
            self.assertAlmostEqual(a['metrics']['terrainCost'],d['metrics']['terrainCost'])
            self.assertTrue(all(t.valid[t.cell(x,y)] for x,y,_ in a['points']))

    def test_no_corner_cutting_or_nodata_crossing(self):
        valid=np.ones((9,9));valid[0,1]=valid[1,0]=0
        with self.assertRaises(NoRoute):self.terrain(valid=valid).search((-4,4),(4,-4),SETTINGS)

    def test_blocked_disconnected_outside_same_cell(self):
        valid=np.ones((9,9));valid[:,4]=0;t=self.terrain(valid=valid)
        for a,b in [((-3,0),(3,0)),((0,0),(3,0)),((-5,0),(3,0)),((-3,0),(-3,0))]:
            with self.assertRaises(NoRoute):t.search(a,b,SETTINGS)
        with self.assertRaises(NoRoute):t.cell(float('nan'),0)

    def test_directed_duration_return_and_exclusion(self):
        z=np.tile(np.arange(9)*.2,(9,1));t=self.terrain(z)
        up=t.search((-3,0),(3,0),SETTINGS)
        down=t.search((3,0),(-3,0),SETTINGS)
        self.assertGreater(up['metrics']['durationS'],down['metrics']['durationS'])
        self.assertAlmostEqual(up['metrics']['ascentM'],down['metrics']['descentM'])
        settings={**SETTINGS,'exclusions':[{'x':0,'y':0,'radius':1}]}
        route=t.search((-3,0),(3,0),settings)
        self.assertTrue(all(math.hypot(x,y)>1 for x,y,_ in route['points']))

    def test_profile_and_edge_cost_contributions_agree_with_search_totals(self):
        z=np.tile(np.arange(9)*.2,(9,1));t=self.terrain(z)
        for mode in ['shortest','gentler']:
            r=t.search((-3,0),(3,0),SETTINGS,mode)
            self.assertEqual(len(r['profile']),len(r['points']))
            self.assertEqual(len(r['segments']),len(r['points'])-1)
            self.assertAlmostEqual(r['profile'][-1]['distanceM'],r['metrics']['distanceM'])
            self.assertAlmostEqual(r['profile'][-1]['elapsedS'],r['metrics']['durationS'])
            self.assertAlmostEqual(sum(s['cost'] for s in r['segments']),r['metrics']['terrainCost'])
            for i,s in enumerate(r['segments']):
                self.assertAlmostEqual(s['distanceM']+s['slopePenalty']+s['uphillPenalty'],s['cost'])
                self.assertAlmostEqual(s['fromDistanceM'],r['profile'][i]['distanceM'])
                self.assertAlmostEqual(r['profile'][i]['elevationM'],r['points'][i][2])
                self.assertGreater(s['gradePercent'],0)

    def test_slope_limit_hard_exclusion(self):
        t=self.terrain();t.slopes[:,4]=30
        with self.assertRaises(NoRoute):t.search((-3,0),(3,0),SETTINGS)


class IntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.client=TestClient(app)

    def test_real_gale_geometry_and_api_round_trip(self):
        meta,t=load_data();self.assertGreater(meta['validFraction'],.95)
        self.assertLess(float(t.heights[200,200]),-4400)
        payload={'datasetId':meta['id'],'start':{'x':0,'y':0},'goal':{'x':600,'y':450},'settings':{}}
        response=self.client.post('/api/routes',json=payload)
        self.assertEqual(response.status_code,200,response.text)
        for route in response.json()['routes']:
            self.assertEqual(route['points'][0][:2],[0,0]);self.assertEqual(route['points'][-1][:2],[600,450])
            self.assertAlmostEqual(route['geographic'][0][0],meta['origin']['longitude'])
            self.assertAlmostEqual(route['geographic'][0][1],meta['origin']['latitude'])
            self.assertGreater(route['roundTripS'],route['metrics']['durationS'])
            for x,y,_ in route['points']:self.assertTrue(t.permitted(20,[])[t.cell(x,y)])

    def test_both_science_waypoints_have_routes_and_matching_profiles(self):
        import json
        from pathlib import Path
        package=json.loads((Path(__file__).resolve().parents[2]/'public/science/geology.json').read_text())
        for target in package['targets']:
            response=self.client.post('/api/routes',json={'datasetId':'gale-bradbury-v1','start':{'x':0,'y':0},'goal':target['point'],'settings':{}})
            self.assertEqual(response.status_code,200,response.text)
            for route in response.json()['routes']:
                self.assertEqual(route['points'][-1][:2],list(target['point'].values()))
                self.assertAlmostEqual(route['profile'][-1]['distanceM'],route['metrics']['distanceM'])
                self.assertAlmostEqual(route['profile'][-1]['elapsedS'],route['metrics']['durationS'])
                self.assertAlmostEqual(sum(s['cost'] for s in route['segments']),route['metrics']['terrainCost'])

    def test_validation_and_explicit_resource_warnings(self):
        p={'datasetId':'gale-bradbury-v1','start':{'x':0,'y':0},'goal':{'x':100,'y':100},'settings':{'maxDurationMin':1,'maxDoseMicroGy':.01,'minTemperatureK':250}}
        response=self.client.post('/api/routes',json=p)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(len(response.json()['routes'][0]['warnings']),3)
        p['settings']['speedMps']=0
        self.assertEqual(self.client.post('/api/routes',json=p).status_code,422)
        p['settings']={};p['goal']['x']=1001
        self.assertEqual(self.client.post('/api/routes',json=p).status_code,422)

    def test_return_at_habitat(self):
        r=self.client.post('/api/return',json={'datasetId':'gale-bradbury-v1','start':{'x':0,'y':0},'goal':{'x':0,'y':0}})
        self.assertEqual(r.status_code,200);self.assertTrue(r.json()['atHabitat'])

    def test_return_does_not_hide_blocked_habitat_or_exhausted_budget(self):
        p={'datasetId':'gale-bradbury-v1','start':{'x':0,'y':0},'goal':{'x':0,'y':0},'elapsedS':600,
           'settings':{'maxDurationMin':1}}
        r=self.client.post('/api/return',json=p)
        self.assertEqual(r.status_code,200);self.assertTrue(r.json()['warnings'])
        p['settings']={'exclusions':[{'x':0,'y':0,'radius':40}]}
        self.assertEqual(self.client.post('/api/return',json=p).status_code,422)


if __name__=='__main__':unittest.main()
