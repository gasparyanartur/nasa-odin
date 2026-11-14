import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server.app import app, Settings
from server.conditions import evaluate, HOUR_SECONDS


class ConditionsTests(unittest.TestCase):
    def test_crosses_hour_boundary_with_physical_seconds_and_counts_cold_overlap(self):
        s = Settings(conditionsMode='historical', departureHour=12.75, minTemperatureK=251)
        r = evaluate(s, HOUR_SECONDS / 2)
        self.assertAlmostEqual(r['coldSeconds'], HOUR_SECONDS / 4)
        self.assertAlmostEqual(r['arrivalHour'], 13.25)
        self.assertAlmostEqual(r['minTemperatureK'], 249.38)
        self.assertEqual(r['status'], 'exceeds')

    def test_missing_bins_and_sol_end_are_unknown_without_wrapping(self):
        s = Settings(conditionsMode='historical', departureHour=23.75)
        r = evaluate(s, HOUR_SECONDS / 2)
        self.assertAlmostEqual(r['unknownSeconds'], HOUR_SECONDS / 4)
        self.assertEqual(r['status'], 'unknown')
        with patch('server.conditions.weather', return_value={12: {'temperatureK': None}}):
            r = evaluate(Settings(conditionsMode='historical'), 60)
            self.assertEqual(r['unknownSeconds'], 60)
            self.assertIsNone(r['minTemperatureK'])
            self.assertEqual(r['status'], 'unknown')

    def test_manual_mode_and_uniform_dose_are_independent_of_departure(self):
        s = Settings(conditionsMode='manual', temperatureK=220, minTemperatureK=230, doseRateMicroGyH=8)
        r = evaluate(s, 1800)
        self.assertEqual(r['coldSeconds'], 1800)
        self.assertEqual(r['doseMicroGy'], 4)
        self.assertEqual(r, evaluate(s, 1800, 12))

    def test_return_crosses_temperature_boundary_while_stationary_at_habitat(self):
        client = TestClient(app)
        p = {'datasetId': 'gale-bradbury-v1', 'start': {'x': 0, 'y': 0}, 'goal': {'x': 0, 'y': 0},
             'settings': {'conditionsMode': 'historical', 'departureHour': 14.9, 'minTemperatureK': 253}}
        self.assertEqual(client.post('/api/return', json=p).json()['warnings'], [])
        p['elapsedS'] = HOUR_SECONDS * .2
        r = client.post('/api/return', json=p)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any('temperature' in w for w in r.json()['warnings']))

    def test_excursion_departures_include_stop_and_return_and_change_feasibility(self):
        client = TestClient(app)
        p = {'datasetId': 'gale-bradbury-v1', 'start': {'x': 0, 'y': 0}, 'goal': {'x': 100, 'y': 100},
             'settings': {'conditionsMode': 'historical', 'departureHour': 12, 'minTemperatureK': 240, 'dwellMin': 10}}
        r = client.post('/api/routes', json=p)
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        for route in body['routes']:
            self.assertAlmostEqual(route['roundTripS'], route['metrics']['durationS'] + 600 + route['returnRoute']['metrics']['durationS'])
            departures = route['departures']
            self.assertEqual(len(departures), 24)
            self.assertEqual(departures[3]['status'], 'exceeds')
            self.assertEqual(departures[12]['status'], 'within')
            self.assertEqual(route['conditions'], departures[12])
            self.assertAlmostEqual(departures[3]['doseMicroGy'], departures[12]['doseMicroGy'])
        for value in [-1, 24]:
            p['settings']['departureHour'] = value
            self.assertEqual(client.post('/api/routes', json=p).status_code, 422)

    def test_recommendation_changes_when_a_candidate_crosses_cold_conditions(self):
        from server.app import load_data
        meta, _ = load_data()

        class CandidateTerrain:
            def search(self, start, goal, settings, mode):
                seconds = 1200 if mode == 'shortest' else 100
                return {'mode': mode, 'points': [[*start, 0], [*goal, 0]],
                        'metrics': {'durationS': seconds, 'doseMicroGy': seconds / 3600 * settings['doseRateMicroGyH']}}

        payload = {'datasetId': meta['id'], 'start': {'x': 0, 'y': 0}, 'goal': {'x': 100, 'y': 100},
                   'settings': {'conditionsMode': 'historical', 'departureHour': 14.8, 'minTemperatureK': 253}}
        with patch('server.app.load_data', return_value=(meta, CandidateTerrain())):
            body = TestClient(app).post('/api/routes', json=payload).json()
        self.assertEqual(body['routes'][0]['conditions']['status'], 'exceeds')
        self.assertEqual(body['routes'][1]['conditions']['status'], 'within')
        self.assertEqual(body['recommendedIndex'], 1)

    def test_missing_departure_at_zero_elapsed_does_not_invent_duration(self):
        with patch('server.conditions.weather', return_value={}):
            result = evaluate(Settings(conditionsMode='historical'), 0)
        self.assertEqual(result['status'], 'unknown')
        self.assertFalse(result['coverageComplete'])
        self.assertEqual(result['unknownSeconds'], 0)
