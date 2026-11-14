// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { heightTint, slopeClasses, CAUTION_SLOPE_DEG } from "../src/rasters.js";

const H = { offset_m: 0, scale_m: 1, nodata: 65535 };

test("slope classes: 4x4 grid with known shares and hatch bytes", () => {
  // scale 1 deg per count. 6 under 10, 4 caution (10 and 15 inclusive), 4 blocked, 2 no-data.
  const s = Uint8Array.from([0, 5, 9, 9, 10, 12, 15, 15, 16, 20, 30, 40, 255, 255, 3, 1]);
  const r = slopeClasses(s, { scale_deg: 1, nodata: 255 });
  assert.equal(r.width, 4);
  assert.equal(r.height, 4);
  assert.deepEqual([...r.hatch], [0, 0, 0, 0, 64, 64, 64, 64, 200, 200, 200, 200, 0, 0, 0, 0]);
  assert.ok(Math.abs(r.shares.ok - 6 / 14) < 1e-12);
  assert.ok(Math.abs(r.shares.caution - 4 / 14) < 1e-12);
  assert.ok(Math.abs(r.shares.blocked - 4 / 14) < 1e-12);
  assert.ok(Math.abs(r.shares.ok + r.shares.caution + r.shares.blocked - 1) < 1e-12);
  // no-data and ok cells are fully transparent; fills stay light
  assert.equal(r.rgba[12 * 4 + 3], 0);
  assert.equal(r.rgba[0 * 4 + 3], 0);
  for (let k = 0; k < 16; k++) assert.ok(r.rgba[k * 4 + 3] <= 60);
  assert.ok(r.rgba[8 * 4 + 3] > 0 && r.rgba[4 * 4 + 3] > 0);
});

test("slope classes: scale_deg is applied and legend carries ranges and pattern ids", () => {
  const r = slopeClasses(Uint8Array.from([39, 40, 60, 61]), { scale_deg: 0.25, nodata: 255 });
  // 9.75 ok, 10 caution, 15 caution, 15.25 blocked
  assert.deepEqual([...r.hatch], [0, 64, 64, 200]);
  assert.equal(CAUTION_SLOPE_DEG, 10);
  assert.deepEqual(r.legend.map((l) => [l.from_deg, l.to_deg, l.pattern]), [[0, 10, null], [10, 15, "hatch-caution"], [15, null, "hatch-blocked"]]);
});

test("slope classes: all no-data gives zero shares and no hatch, not NaN", () => {
  const r = slopeClasses(Uint8Array.from([255, 255, 255, 255]), { scale_deg: 1, nodata: 255 });
  assert.deepEqual(r.shares, { ok: 0, caution: 0, blocked: 0 });
  assert.ok(r.hatch.every((b) => b === 0));
});

// 3x3 sample grid -> 2x2 cells. Heights rise by 3 m per column: columns 0, 3, 6.
test("height tint: contours sit exactly where the 5 m band changes", () => {
  const core = Uint16Array.from([0, 3, 6, 0, 3, 6, 0, 3, 6]);
  const r = heightTint(core, H, { step_m: 5 });
  assert.equal(r.width, 2);
  assert.equal(r.height, 2);
  // cell heights: left 1.5 (band 0), right 4.5 (band 0): no contour at all
  assert.equal(r.min_m, 1.5);
  assert.equal(r.max_m, 4.5);
  const a = (k) => r.rgba[k * 4 + 3];
  assert.ok([0, 1, 2, 3].every((k) => a(k) === 150));
  const r2 = heightTint(core, H, { step_m: 2 });
  // bands: floor(1.5/2) = 0, floor(4.5/2) = 2 -> left cells are contour cells, right cells are not
  assert.deepEqual([0, 1, 2, 3].map((k) => r2.rgba[k * 4 + 3]), [235, 150, 235, 150]);
  assert.ok(r2.rgba[0] < 0xe6); // darker than the lowest ramp colour
});

test("height tint: legend has 7 steps over the real data range", () => {
  const core = Uint16Array.from([0, 0, 0, 70, 70, 70, 70, 70, 70].map((v, i) => v + (i === 0 ? 0 : 0)));
  const r = heightTint(core, H);
  assert.equal(r.legend.length, 7);
  assert.equal(r.legend[0].from_m, r.min_m);
  assert.ok(Math.abs(r.legend[6].to_m - r.max_m) < 1e-9);
  for (let k = 1; k < 7; k++) assert.ok(Math.abs(r.legend[k].from_m - r.legend[k - 1].to_m) < 1e-9);
  assert.equal(r.step_m, 5);
});

test("height tint: no-data corners are skipped in the mean and cells with none are transparent", () => {
  const nd = 65535;
  // cell (0,0) corners: 10, nd, 10, nd -> mean 10. cell (1,0) corners: nd nd nd nd -> transparent.
  const core = Uint16Array.from([10, nd, nd, 10, nd, nd, 10, 20, nd].map((v) => v));
  const r = heightTint(core, H);
  assert.equal(r.rgba[0 * 4 + 3] > 0, true);
  assert.equal(r.rgba[1 * 4 + 3], 0); // cell (1,0)
  assert.equal(r.min_m, 10);
  assert.ok(r.max_m >= 10 && r.max_m < 65535);
});

test("height tint: all no-data gives an empty legend and null range", () => {
  const r = heightTint(new Uint16Array(9).fill(65535), H);
  assert.deepEqual(r.legend, []);
  assert.equal(r.min_m, null);
  assert.ok(r.rgba.every((b) => b === 0));
});
