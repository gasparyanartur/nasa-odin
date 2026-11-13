"""Production serves assets and API from one origin, with real 404s."""
from pathlib import Path
import unittest
from fastapi.testclient import TestClient
from server.app import app, STATIC

@unittest.skipUnless(STATIC.is_dir(), 'Build the frontend before production asset checks')
class ProductionTests(unittest.TestCase):
    def test_same_origin_assets_api_and_missing_paths(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/').status_code, 200)
            self.assertIn('text/html', client.get('/').headers['content-type'])
            self.assertEqual(client.get('/api/health').json()['datasetId'], 'gale-bradbury-v1')
            self.assertEqual(client.get('/gale/manifest.json').json()['id'], 'gale-bradbury-v1')
            self.assertEqual(len(client.get('/gale/height.f32').content), 401*401*4)
            worker = next((STATIC/'cesium/Workers').glob('*.js'))
            self.assertEqual(client.get('/'+str(worker.relative_to(STATIC))).status_code, 200)
            for path in ['/api/unknown', '/gale/missing.png', '/missing.json']:
                self.assertEqual(client.get(path).status_code, 404)
