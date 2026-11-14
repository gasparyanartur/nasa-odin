"""Tests for cut_scene: pure helpers, and checks on the written scene files.

AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

The file checks need app/public/data/scene.json. The source comparison also
needs network access to the USGS host (raw bytes come from the local cache).
"""

import json
import math
import os
import sys
import unittest

import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
import cut_scene as cs  # noqa: E402
import geotiff_range as g  # noqa: E402

DATA = os.path.join(os.path.dirname(TOOLS), "app", "public", "data")
RAW = "/Users/ardasarikaya/marswalk-data-raw"
HAVE_SCENE = os.path.exists(os.path.join(DATA, "scene.json")) and os.path.exists(os.path.join(DATA, "dem_core.bin"))


def image_size(rel):
    with Image.open(os.path.join(DATA, rel)) as im:
        return im.size


class HelperTests(unittest.TestCase):
    def test_horn_plane_true_spacing(self):
        y, x = np.mgrid[0:7, 0:7]
        z = np.tan(np.radians(10.0)) * x.astype(float)
        self.assertTrue(np.allclose(cs.horn_slope_deg(z, 1.0, 1.0), 10.0))
        s = cs.horn_slope_deg(z, 0.5, 1.0)
        self.assertTrue(np.allclose(s, math.degrees(math.atan(2 * math.tan(math.radians(10.0))))))

    def test_horn_north_up(self):
        y, x = np.mgrid[0:5, 0:5]
        z = -1.0 * y.astype(float)
        self.assertTrue(np.allclose(cs.horn_slope_deg(z, 1.0, 1.0), 45.0))

    def test_slope_baseline_plane(self):
        t = math.tan(math.radians(12.0))

        def plane(x, y):
            return t * np.asarray(x) * 0.9 + 0.0 * np.asarray(y)

        s = cs.slope_baseline(plane, 16, 5, 0.9)
        self.assertEqual(s.shape, (32, 32))
        self.assertTrue(np.allclose(s, 12.0, atol=1e-6))

        def ridge(x, y):
            return np.where(np.asarray(x) < 0, 0.0, 1.0) + 0.0 * np.asarray(y)

        s1 = cs.slope_1m(ridge, 16, 1.0)
        s5 = cs.slope_baseline(ridge, 16, 5, 1.0)
        self.assertGreater(float(s1.max()), float(s5.max()))

    def test_block_mean_rgb_skips_black(self):
        img = np.zeros((2, 2, 3), np.uint8)
        img[0, 0] = (100, 50, 20)
        img[0, 1] = (200, 150, 40)
        self.assertEqual(cs.block_mean_rgb(img, 2)[0, 0].tolist(), [150, 100, 30])

    def test_encode_slope(self):
        v = cs.encode_slope(np.array([0.0, 0.25, 63.5, 70.0, np.nan]))
        self.assertEqual(v.tolist(), [0, 1, 254, 254, 255])

    def test_block_mean_skips_nodata(self):
        img = np.array([[0, 10, 20, 30], [0, 0, 20, 30], [0, 0, 1, 1], [0, 0, 1, 1]], np.uint8)
        self.assertEqual(cs.block_mean(img, 2).tolist(), [[10, 25], [0, 1]])

    def test_height_encoding_round_trip(self):
        h = np.array([-3650.123, -3500.0, np.nan])
        off, sc, _, _ = cs.pick_height_encoding(h)
        v = cs.encode_height(h, off, sc)
        self.assertEqual(int(v[2]), cs.NODATA16)
        self.assertLessEqual(abs(off + v[0] * sc - h[0]), sc / 2 + 1e-9)


@unittest.skipUnless(HAVE_SCENE, "scene files not written yet")
class SceneFileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(DATA, "scene.json")) as fh:
            cls.scene = json.load(fh)
        h = cls.scene["height"]
        raw = np.fromfile(os.path.join(DATA, "dem_core.bin"), "<u2")
        cls.core_raw = raw
        n = cls.scene["core"]["dem_samples"]
        cls.core = np.where(raw == h["nodata"], np.nan, h["offset_m"] + raw * h["scale_m"]).reshape(n, n)

    def test_contract_sizes(self):
        s = self.scene
        self.assertEqual(s["core"]["dem_samples"], 1025)
        self.assertEqual(s["surround"]["dem_samples"], 513)
        self.assertEqual(s["core"]["slope_cells"], 1024)
        self.assertEqual(os.path.getsize(os.path.join(DATA, "dem_core.bin")), 1025 * 1025 * 2)
        self.assertEqual(os.path.getsize(os.path.join(DATA, "dem_surround.bin")), 513 * 513 * 2)
        self.assertEqual(os.path.getsize(os.path.join(DATA, "slope_core.bin")), 1024 * 1024)
        for row in s["core"]["tiles"]:
            for rel in row:
                self.assertEqual(image_size(rel), (2048, 2048))
        self.assertEqual(image_size(s["core"]["half_res"]), (2048, 2048))
        self.assertEqual(image_size(s["surround"]["image"]), (2048, 2048))
        self.assertEqual(image_size(s["overview"]), (512, 512))

    def test_files_listed_with_lengths(self):
        files = self.scene["files"]
        on_disk = set()
        for d, _, names in os.walk(DATA):
            for n in names:
                rel = os.path.relpath(os.path.join(d, n), DATA).replace(os.sep, "/")
                if rel != "scene.json" and not n.startswith("."):
                    on_disk.add(rel)
        self.assertEqual(set(files), on_disk)
        for rel, n in files.items():
            self.assertEqual(os.path.getsize(os.path.join(DATA, rel)), n, rel)
            self.assertLessEqual(n, 5 * 1024 * 1024, rel)

    def test_frame_fields(self):
        s = self.scene
        self.assertEqual(s["lat_type"], "planetocentric")
        self.assertEqual(s["lon_direction"], "east_positive")
        self.assertAlmostEqual(s["ground_scale"]["x"], math.cos(math.radians(s["origin"]["lat"])), places=12)
        self.assertEqual(s["ground_scale"]["y"], 1.0)
        self.assertAlmostEqual(s["metres_per_degree"]["lat"], 3396190.0 * math.pi / 180, places=6)
        self.assertEqual(s["projection"]["radius_m"], 3396190.0)
        self.assertEqual(s["sources"], ["usgs_gale_colour_2025", "image_25cm", "dem_1m", "hrsc"])
        with open(os.path.join(os.path.dirname(DATA), "..", "sources.json")) as fh:
            ids = {row["id"] for row in json.load(fh)}
        self.assertTrue(set(s["sources"]) <= ids, set(s["sources"]) - ids)

    def test_core_tiles_not_black(self):
        for row in self.scene["core"]["tiles"]:
            for rel in row:
                with Image.open(os.path.join(DATA, rel)) as im:
                    a = np.asarray(im.convert("L"))
                self.assertLessEqual(float((a == 0).mean()), 0.01, rel)

    def test_core_height_range(self):
        self.assertFalse(np.isnan(self.core).any())
        lo, hi = float(self.core.min()), float(self.core.max())
        self.assertGreaterEqual(lo, -3800.0)
        self.assertLessEqual(hi, -3400.0)
        self.assertLessEqual(lo, -3658.0)
        self.assertGreaterEqual(hi, -3605.0)

    def test_slope_fields(self):
        s = self.scene["slope"]
        self.assertEqual(s["baseline_m"], 5)
        self.assertIn("Horn", s["method"])
        v = np.fromfile(os.path.join(DATA, "slope_core.bin"), np.uint8)
        self.assertEqual(int((v == s["nodata"]).sum()), 0)

    def test_colour_tiles(self):
        im = self.scene["imagery"]
        self.assertEqual(im["default"], "colour")
        self.assertEqual(self.scene["core"]["tiles"], im["colour"]["tiles"])
        self.assertEqual(self.scene["core"]["half_res"], im["colour"]["half_res"])
        self.assertEqual(self.scene["surround"]["image"], im["colour"]["surround"])
        self.assertEqual(self.scene["overview"], im["colour"]["overview"])
        for row in im["colour"]["tiles"]:
            for rel in row:
                with Image.open(os.path.join(DATA, rel)) as f:
                    self.assertEqual(f.mode, "RGB")
                    self.assertEqual(f.size, (2048, 2048))
                    a = np.asarray(f)
                self.assertLessEqual(float((a.max(axis=2) == 0).mean()), 0.01, rel)
                self.assertLessEqual(os.path.getsize(os.path.join(DATA, rel)), 1_800_000, rel)
        for key in ("half_res", "surround"):
            with Image.open(os.path.join(DATA, im["colour"][key])) as f:
                self.assertEqual((f.mode, f.size), ("RGB", (2048, 2048)), key)
        with Image.open(os.path.join(DATA, im["colour"]["overview"])) as f:
            self.assertEqual((f.mode, f.size), ("RGB", (512, 512)))
        self.assertLessEqual(os.path.getsize(os.path.join(DATA, im["colour"]["overview"])), 120_000)

    def test_grey_set(self):
        grey = self.scene["imagery"]["grey"]
        self.assertEqual(grey["source_id"], "image_25cm")
        for row in grey["tiles"]:
            for rel in row:
                self.assertEqual(image_size(rel), (2048, 2048))
        self.assertEqual(image_size(grey["half_res"]), (2048, 2048))
        self.assertEqual(image_size(grey["surround"]), (2048, 2048))
        self.assertEqual(image_size(grey["overview"]), (512, 512))

    def test_colour_and_grey_same_place(self):
        im = self.scene["imagery"]
        for r, c in [(0, 0), (1, 1)]:
            with Image.open(os.path.join(DATA, im["colour"]["tiles"][r][c])) as f:
                col = np.asarray(f.convert("L"), dtype=np.float64)
            with Image.open(os.path.join(DATA, im["grey"]["tiles"][r][c])) as f:
                grey = np.asarray(f.convert("L"), dtype=np.float64)
            corr = float(np.corrcoef(col.ravel(), grey.ravel())[0, 1])
            self.assertGreater(corr, 0.8, (r, c))
            flipped = float(np.corrcoef(col[::-1].ravel(), grey.ravel())[0, 1])
            self.assertLess(flipped, 0.5, (r, c))

    def test_corners_match_source_and_centres_agree(self):
        try:
            ortho = g.open_remote(cs.ORTHO_URL, RAW)
            dem = g.open_remote(cs.DEM_URL, RAW)
        except OSError as err:
            self.skipTest("source host not reachable: %s" % err)
        s = self.scene
        c, r = ortho.lonlat_to_pixel(s["origin"]["lon"], s["origin"]["lat"])
        oc, orr = round(c), round(r)
        self.assertLess(abs(c - oc) + abs(r - orr), 1e-6)
        ox, oy = ortho.pixel_to_model(oc, orr)
        h = s["height"]
        for i, j in [(0, 0), (1024, 0), (0, 1024), (1024, 1024), (512, 512)]:
            x, y = -512 + i, 512 - j
            col, row = dem.model_to_pixel(ox + x, oy + y)
            u, v = col - 0.5, row - 0.5
            c0, r0 = int(math.floor(u)), int(math.floor(v))
            win = dem.read_window(c0, r0, 2, 2).astype(np.float64)
            fu, fv = u - c0, v - r0
            direct = (win[0, 0] * (1 - fu) * (1 - fv) + win[0, 1] * fu * (1 - fv)
                      + win[1, 0] * (1 - fu) * fv + win[1, 1] * fu * fv)
            ours = h["offset_m"] + int(self.core_raw[j * 1025 + i]) * h["scale_m"]
            self.assertLessEqual(abs(ours - direct), 0.01, (i, j))
        img_lon, img_lat = ortho.pixel_to_lonlat(oc, orr)
        dcol, drow = dem.model_to_pixel(ox, oy)
        dem_lon, dem_lat = dem.pixel_to_lonlat(dcol, drow)
        R = 3396190.0
        dist = math.hypot(math.radians(img_lon - dem_lon) * R * math.cos(math.radians(img_lat)),
                          math.radians(img_lat - dem_lat) * R)
        self.assertLessEqual(dist, 0.25)


if __name__ == "__main__":
    unittest.main()
