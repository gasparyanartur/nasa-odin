// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { roverCheck, scatterGeometry } from "../src/rovercheck.js";

const terrain = {
  slopeAt(x) {
    if (x > 100) return null;
    return x; // slope equals x in degrees
  },
};
const wp = (sol, x, tilt, in_campaign = true) => ({ sol, x, y: 0, tilt_deg: tilt, in_campaign });

test("pairs, share under cap and median difference are hand-computed", () => {
  const r = roverCheck([wp(1, 4, 6), wp(2, 10, 8), wp(3, 16, 12), wp(4, 2, 2)], terrain, 15);
  assert.equal(r.n, 4);
  assert.equal(r.skipped, 0);
  assert.equal(r.share_under_cap, 0.75); // slopes 4, 10, 16, 2 against cap 15
  assert.equal(r.share_tilt_under_cap, 1);
  assert.deepEqual(r.pairs.map((p) => p.sol), [1, 2, 3, 4]);
  assert.equal(r.median_abs_diff_deg, 2); // diffs 2, 2, 4, 0 -> sorted 0 2 2 4
  assert.match(r.note, /5 m/);
  assert.match(r.note, /A terrain slope over 5 m and a rover body tilt are not the same quantity\./);
});

test("only campaign waypoints count", () => {
  const r = roverCheck([wp(1, 4, 6, false), wp(2, 10, 8)], terrain, 15);
  assert.equal(r.n, 1);
  assert.equal(r.considered, 1);
});

test("null slope or non-finite tilt is skipped, never a zero", () => {
  const r = roverCheck([wp(1, 500, 6), wp(2, 10, null), wp(3, 10, NaN), wp(4, 10, undefined), wp(5, 10, 8)], terrain, 15);
  assert.equal(r.n, 1);
  assert.equal(r.skipped, 4);
  assert.equal(r.pairs[0].sol, 5);
});

test("no usable pair gives null shares, not zero", () => {
  const r = roverCheck([wp(1, 500, 6)], terrain, 15);
  assert.equal(r.n, 0);
  assert.equal(r.share_under_cap, null);
  assert.equal(r.median_abs_diff_deg, null);
});

test("scatterGeometry maps equal axes with y up", () => {
  const g = scatterGeometry([{ sol: 1, dem_slope_deg: 10, rover_tilt_deg: 5 }], { width: 120, height: 120, pad: 10, max_deg: 20 });
  assert.deepEqual(g.points, [{ cx: 10 + 5 * 5, cy: 110 - 10 * 5, sol: 1 }]);
  assert.deepEqual(g.diag, [10, 110, 110, 10]);
  assert.equal(g.ticks[0].deg, 0);
  assert.equal(g.ticks.at(-1).deg, 20);
  assert.equal(g.ticks.at(-1).px, 110);
});

test("scatterGeometry picks a round max from the data when none is given", () => {
  const g = scatterGeometry([{ sol: 1, dem_slope_deg: 12.3, rover_tilt_deg: 3 }], { width: 100, height: 100, pad: 0 });
  assert.equal(g.max_deg, 15);
});
