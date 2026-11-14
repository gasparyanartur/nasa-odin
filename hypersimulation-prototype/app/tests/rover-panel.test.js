// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { roverPanelModel, ALIGNMENT } from "../src/ui/rover-panel.js";

const terrain = { slopeAt: (x) => (x > 100 ? null : x) };
const wp = (sol, x, tilt, in_campaign = true) => ({ sol, x, y: 0, tilt_deg: tilt, in_campaign });

test("model rounds shares to whole percent and the median to one decimal", () => {
  const m = roverPanelModel([wp(1, 4, 6), wp(2, 10, 8), wp(3, 16, 12), wp(4, 2, 2)], terrain, 15);
  assert.equal(m.n, 4);
  assert.equal(m.slope_under_pct, 75);
  assert.equal(m.tilt_under_pct, 100);
  assert.equal(m.median_diff_deg, 2);
  assert.equal(m.geo.points.length, 4);
  assert.match(m.note, /5 m baseline/);
});

test("model with no usable waypoint gives nulls, never zero", () => {
  const m = roverPanelModel([wp(1, 500, 6), wp(2, 3, 1, false)], terrain, 15);
  assert.equal(m.n, 0);
  assert.equal(m.slope_under_pct, null);
  assert.equal(m.tilt_under_pct, null);
  assert.equal(m.median_diff_deg, null);
});

test("alignment figures match data-checks/alignment.md", () => {
  assert.deepEqual(ALIGNMENT, { horizontal_mm: 3, height_spread_m: 0.1, positions: 65 });
});
