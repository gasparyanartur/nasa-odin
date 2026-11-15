"""Causal forecast checks and reproducible scientific-package invariants."""
from pathlib import Path
import json
import unittest
from scripts.environment_model import predict, validate


class EnvironmentalDataTests(unittest.TestCase):
    def test_future_observations_cannot_leak_into_prediction(self):
        records = [{'sol': sol, 'hour': 12, 'temperature': 200+sol} for sol in range(1, 12)]
        before = predict(records, 7, 'temperature')
        for row in records:
            if row['sol'] > 7:
                row['temperature'] = 999999
        self.assertEqual(before, predict(records, 7, 'temperature'))
        self.assertEqual(before[12]['value'], 204)
        self.assertIsNone(before[11]['value'])

    def test_sparse_hours_stay_unknown(self):
        records = [{'sol': 6, 'hour': 2, 'radiation': 4}, {'sol': 7, 'hour': 2, 'radiation': 8}]
        self.assertIsNone(predict(records, 7, 'radiation')[2]['value'])

    def test_validation_compares_identical_target_hours(self):
        records = [{'sol': sol, 'hour': 1, 'temperature': sol} for sol in range(1, 6)]
        records += [{'sol': sol, 'hour': 2, 'temperature': 20} for sol in [1, 2, 3, 5]]
        result = validate(records, 'temperature', [5])
        self.assertEqual(result['samples'], 2)
        self.assertEqual(result['pairedSamples'], 1)
        self.assertEqual(result['persistenceMae'], 1)

    def test_actual_package_forecasts_and_quality(self):
        catalog = json.loads((Path(__file__).resolve().parents[2]/'public/environment/catalog.json').read_text())
        records = [r for sol in catalog['history']['sols'] for r in sol['records']]
        for quantity in ['temperature', 'radiation']:
            self.assertEqual(predict(records, 28, quantity), catalog['forecast'][quantity])
            self.assertEqual(validate(records, quantity, list(range(24, 29))), catalog['forecast']['validation'][quantity])
        self.assertEqual(len(records), 456)
        self.assertTrue(any(r['temperature'] is None for r in records))
        self.assertTrue(any(r['radiation'] is None for r in records))


if __name__ == '__main__':
    unittest.main()
