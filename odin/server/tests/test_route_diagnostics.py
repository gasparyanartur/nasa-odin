import unittest
import numpy as np
from fastapi.testclient import TestClient
from server.app import app, load_data, Settings
from server.planner import Terrain, NoRoute


class RouteDiagnosticsTests(unittest.TestCase):
    def terrain(self):
        return Terrain(np.zeros((9,9)), np.zeros((9,9)), np.ones((9,9)), 1)

    def failure(self, terrain, start=(-3,0), goal=(3,0), **settings):
        with self.assertRaises(NoRoute) as caught:
            terrain.search(start,goal,{**Settings().model_dump(),**settings})
        return caught.exception

    def test_identifies_both_endpoints_and_neighboring_slope(self):
        terrain=self.terrain()
        terrain.slopes[5,2]=27  # Neighbor in the start's walking interpolation footprint.
        error=self.failure(terrain,exclusions=[{'x':3,'y':0,'radius':1}])
        start,goal=error.diagnostics['endpoints']
        self.assertEqual(start['slopeDeg'],27)
        self.assertIn('27.0° exceeds the 20° limit',start['reasons'][0])
        self.assertEqual(goal['exclusionIndices'],[0])
        self.assertIn('Exclusion #1',str(error))

    def test_distinguishes_invalid_footprint_and_outside_coverage(self):
        terrain=self.terrain();terrain.valid[5,2]=False
        error=self.failure(terrain,goal=(10,0))
        self.assertIn('Missing or invalid',error.diagnostics['endpoints'][0]['reasons'][0])
        self.assertIn('Outside the prepared footprint',error.diagnostics['endpoints'][1]['reasons'][0])

    def test_identifies_disconnected_slope_barrier(self):
        terrain=self.terrain();terrain.slopes[:,4]=30
        error=self.failure(terrain)
        self.assertEqual(error.diagnostics['code'],'disconnected')
        self.assertIn('Terrain above the 20° slope limit',str(error))
        self.assertFalse(any(e['reasons'] for e in error.diagnostics['endpoints']))

    def test_identifies_disconnected_missing_data(self):
        terrain=self.terrain();terrain.valid[:,4]=False
        error=self.failure(terrain)
        self.assertIn('Missing or invalid terrain separates',str(error))

    def test_identifies_exclusion_barrier_and_combined_barriers(self):
        terrain=self.terrain()
        exclusions=[{'x':0,'y':y,'radius':.4} for y in (-4,-2,0,2,4)]
        error=self.failure(terrain,exclusions=exclusions)
        self.assertIn('exclusions separate',str(error))
        # Each constraint independently partitions the terrain.
        terrain.slopes[:,4]=30
        error=self.failure(terrain,exclusions=exclusions)
        self.assertIn('Terrain above',str(error))
        self.assertIn('exclusions separate',str(error))

    def test_combined_constraints_close_different_corridors(self):
        terrain=self.terrain();terrain.slopes[3:,4]=30
        error=self.failure(terrain,exclusions=[{'x':0,'y':3,'radius':.4}])
        self.assertIn('Slope limits and exclusions together',str(error))

    def test_actual_boxwork_failure_payload_and_return_labels(self):
        meta,_=load_data('gale-boxwork-v1')
        payload={'datasetId':meta['id'],'start':meta['defaultStart'],'goal':meta['defaultGoal'],
                 'settings':{'maxSlopeDeg':15}}
        client=TestClient(app)
        result=client.post('/api/routes',json=payload)
        self.assertEqual(result.status_code,422)
        self.assertIsInstance(result.json()['detail'],str)  # Older clients keep a useful message.
        diagnostics=result.json()['diagnostics']
        self.assertAlmostEqual(diagnostics['endpoints'][0]['slopeDeg'],18.392,places=2)
        self.assertTrue(diagnostics['endpoints'][1]['reasons'])
        returned=client.post('/api/return',json=payload)
        self.assertEqual(returned.status_code,422)
        self.assertEqual(returned.json()['diagnostics']['endpoints'][0]['label'],'Current position')
        self.assertEqual(returned.json()['diagnostics']['endpoints'][1]['label'],'Habitat')
        payload['settings']={}
        self.assertEqual(client.post('/api/routes',json=payload).status_code,200)
