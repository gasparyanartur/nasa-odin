"""AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

Tests for cut_conditions.py on small hand-written fixtures.
Run: python3 -I -m unittest tools/tests/test_conditions.py -v
"""
import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "cut_conditions", os.path.join(HERE, "..", "cut_conditions.py"))
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)


def row(lmst, gts=-999.0, gts_flag="0111", air=-999.0, air_flag="001XX1111",
        uv=-999.0, uv_flag="01110", press=-999.0, ps_flag="11",
        rh=-999.0, hs_flag="0X1"):
    r = ["0"] * 40
    r[0] = "1"
    r[1] = lmst
    r[7] = str(gts)
    r[10] = gts_flag.rjust(8)
    r[15] = str(air)
    r[16] = air_flag.rjust(12)
    r[20] = str(uv)
    r[29] = uv_flag.rjust(8)
    r[30] = str(rh)
    r[35] = hs_flag.rjust(8)
    r[37] = str(press)
    r[39] = ps_flag.rjust(8)
    return r


class RemsTests(unittest.TestCase):
    def test_lmst_hour_parse(self):
        self.assertEqual(cc.parse_lmst("04600M13:59:59.999"), (4600, 13))
        self.assertEqual(cc.parse_lmst("04600M00:01:25.293"), (4600, 0))
        self.assertIsNone(cc.parse_lmst("garbage"))
        self.assertIsNone(cc.parse_lmst("04600M24:00:00.000"))

    def test_missing_marker_is_null(self):
        hours = cc.rems_hours([row("04600M05:10:00.000", gts=-999.0)], 4600)
        self.assertIsNone(hours[5]["ground_brightness_temp_c"])
        self.assertEqual(hours[5]["n"]["ground_brightness_temp_c"], 0)

    def test_kelvin_to_celsius_and_mean(self):
        rows = [row("04600M05:10:00.000", gts=200.0),
                row("04600M05:20:00.000", gts=210.0)]
        hours = cc.rems_hours(rows, 4600)
        self.assertAlmostEqual(hours[5]["ground_brightness_temp_c"], 205.0 - 273.15, places=3)
        self.assertEqual(hours[5]["n"]["ground_brightness_temp_c"], 2)

    def test_flag_blocks_bad_rows(self):
        rows = [row("04600M06:00:00.000", gts=200.0, gts_flag="0101"),
                row("04600M06:01:00.000", gts=220.0, gts_flag="0111")]
        hours = cc.rems_hours(rows, 4600)
        self.assertAlmostEqual(hours[6]["ground_brightness_temp_c"], 220.0 - 273.15, places=3)
        self.assertEqual(hours[6]["n"]["ground_brightness_temp_c"], 1)

    def test_unknown_flag_counts_as_not_good(self):
        rows = [row("04600M07:00:00.000", gts=200.0, gts_flag="XXXX")]
        hours = cc.rems_hours(rows, 4600)
        self.assertIsNone(hours[7]["ground_brightness_temp_c"])

    def test_uv_bad_flag_is_null(self):
        rows = [row("04600M12:00:00.000", uv=5.0, uv_flag="01010"),
                row("04600M13:00:00.000", uv=6.0, uv_flag="01110")]
        hours = cc.rems_hours(rows, 4600)
        self.assertIsNone(hours[12]["uv_abc_w_m2"])
        self.assertEqual(hours[13]["uv_abc_w_m2"], 6.0)

    def test_hour_without_rows_is_null_and_zero(self):
        hours = cc.rems_hours([row("04600M05:10:00.000", gts=200.0)], 4600)
        self.assertEqual(len(hours), 24)
        self.assertIsNone(hours[9]["air_temp_c"])
        self.assertEqual(set(hours[9]["n"].values()), {0})

    def test_other_sol_rows_ignored(self):
        hours = cc.rems_hours([row("04601M05:10:00.000", gts=200.0)], 4600)
        self.assertIsNone(hours[5]["ground_brightness_temp_c"])

    def test_pressure_not_converted(self):
        hours = cc.rems_hours([row("04600M03:00:00.000", press=740.5)], 4600)
        self.assertEqual(hours[3]["pressure_pa"], 740.5)

    def test_label_check_reports_difference(self):
        names = ["X"] * 40
        diffs = cc.check_label(names)
        self.assertTrue(any(d["expected"] == "BRIGHTNESS_TEMP" for d in diffs))


RAD_FIXTURE = """[FILE]
START_SOL=4600

[OBSERVATION: 00]
START_OBS_MARS="4600 0:30:10"

[DOSIMETRY_TOTAL_DOSE_B: 00]

7.0

[DOSIMETRY_TOTAL_DOSE_E: 00]

6.0

[OBSERVATION: 02]
START_OBS_MARS="4600 0:50:00"

[DOSIMETRY_TOTAL_DOSE_B: 02]

9.0

[DOSIMETRY_TOTAL_DOSE_E: 02]

8.0

[OBSERVATION: 04]
START_OBS_MARS="4600 1:10:00"

[DOSIMETRY_TOTAL_DOSE_B: 04]

8.0

[DOSIMETRY_TOTAL_DOSE_E: 04]

7.0

[OBSERVATION: 06]
START_OBS_MARS="4600 0:05:50"

[DOSIMETRY_TOTAL_DOSE_B: 06]

100.0

[DOSIMETRY_TOTAL_DOSE_E: 06]

100.0
"""


class RadTests(unittest.TestCase):
    def setUp(self):
        self.obs = cc.rad_observations(RAD_FIXTURE.split("\n"), 4600)

    def test_wrapped_observation_dropped(self):
        self.assertEqual([o["obs"] for o in self.obs], ["00", "02", "04"])

    def test_dose_values_read_from_section(self):
        self.assertEqual(self.obs[0]["B"], 7.0)
        self.assertEqual(self.obs[0]["E"], 6.0)

    def test_hourly_mean_then_mean(self):
        mean, n, hourly = cc.rad_dose(self.obs, "B")
        self.assertEqual(n, 3)
        self.assertEqual([h["n_obs"] for h in hourly], [2, 1])
        self.assertAlmostEqual(mean, (8.0 + 8.0) / 2, places=4)

    def test_daily_conversion(self):
        self.assertAlmostEqual(cc.daily_msv(7.0), 0.168, places=4)
        self.assertIsNone(cc.daily_msv(None))

    def test_dose_json_carries_unit_and_time_base(self):
        d = cc.build_dose_json(4600, self.obs, rad_url="https://example.invalid/x")
        self.assertEqual(d["dose_rate"]["unit"], "microGy/hour")
        self.assertIn("per hour", d["dose_rate"]["time_base"])
        self.assertEqual(d["dose_rate"]["detector"], "B")
        self.assertEqual(d["dose_rate"]["derived_daily"]["unit"], "mGy/day")
        self.assertEqual(d["fallback"]["unit"], "mGy/day")
        self.assertIn("microGray", d["source"]["unit_source"])

    def test_no_observations_gives_null(self):
        d = cc.build_dose_json(4600, [])
        self.assertIsNone(d["dose_rate"]["value"])
        self.assertIsNone(d["dose_rate"]["derived_daily"]["value"])


class SepTests(unittest.TestCase):
    def test_event_fields_and_note(self):
        ev = [{"sepID": "2025-05-13T18:14:00-SEP-001", "eventTime": "2025-05-13T18:14Z",
               "instruments": [{"displayName": "SOHO: COSTEP 15.8-39.8 MeV"}],
               "link": "https://example.invalid/e",
               "linkedEvents": [{"activityID": "A-FLR-001"}],
               "submissionTime": "2025-05-13T18:28Z"}]
        out = cc.build_sep_json(ev, "https://example.invalid/api")
        self.assertEqual(out["instruments"], ["SOHO: COSTEP 15.8-39.8 MeV"])
        self.assertEqual(out["linkedEvents"], ["A-FLR-001"])
        self.assertIn("Arrival at Mars is not claimed", out["note"])
        self.assertEqual(out["source"]["retrieved"], "2026-11-14")

    def test_missing_event_raises(self):
        with self.assertRaises(ValueError):
            cc.build_sep_json([], "u")


if __name__ == "__main__":
    unittest.main()
