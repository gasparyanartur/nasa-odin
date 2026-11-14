// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The look-ahead target and the wall-clock heading ease, on a synthetic 1 m zigzag with one 90 degree corner.
import test from "node:test";
import assert from "node:assert/strict";
import { lookHeading, stepHeading, angleDiff, TURN_RATE_DEG_S, LOOK_AHEAD_M } from "../src/camera-heading.js";

// 40 m north with a one-metre east/west zigzag every metre, then 40 m east.
function zigzag() {
  const p = [[0, 0]];
  for (let i = 1; i <= 40; i++) p.push([i % 2 ? 1 : 0, i]);
  p.push([0, 40]);
  for (let i = 1; i <= 40; i++) p.push([i, 40 + (i % 2 ? 1 : 0)]);
  return p;
}
const lengthOf = (p) => p.reduce((s, q, k) => (k ? s + Math.hypot(q[0] - p[k - 1][0], q[1] - p[k - 1][1]) : 0), 0);

test("lookHeading: straight path points along it, null for no length", () => {
  assert.equal(lookHeading([[0, 0], [0, 20]], 3), 0);
  assert.equal(Math.round(lookHeading([[0, 0], [20, 0]], 3)), 90);
  assert.equal(lookHeading([[0, 0]], 0), null);
  assert.equal(lookHeading([[2, 2], [2, 2]], 0), null);
});

test("lookHeading: clamps at the leg end and holds there", () => {
  const p = [[0, 0], [10, 0]];
  assert.equal(lookHeading(p, 9.5), lookHeading(p, 10));
  assert.equal(lookHeading(p, 100), lookHeading(p, 10));
  assert.equal(Math.round(lookHeading(p, 10)), 90);
});

test("lookHeading: the look target is much steadier than the raw per-vertex heading on a zigzag", () => {
  const p = zigzag();
  const total = lengthOf(p);
  let maxStep = 0;
  let prev = null;
  for (let s = 0; s <= total - 1; s += 0.25) {
    const h = lookHeading(p, s);
    if (prev !== null) maxStep = Math.max(maxStep, Math.abs(angleDiff(prev, h)));
    prev = h;
  }
  assert.ok(maxStep < 15, `max step ${maxStep}`);
  assert.ok(LOOK_AHEAD_M >= 4);
});

test("stepHeading: shortest way across 0/360", () => {
  const up = stepHeading(359, 1, 0.05);
  assert.ok(up > 359 || up < 1, `went ${up}`);
  const down = stepHeading(1, 359, 0.05);
  assert.ok(down < 1 || down > 359, `went ${down}`);
  assert.ok(Math.abs(angleDiff(359, up)) <= TURN_RATE_DEG_S * 0.05 + 1e-9);
});

test("stepHeading: large dt lands on the target without overshoot, tiny or zero dt does nothing", () => {
  assert.equal(stepHeading(10, 100, 100) <= 100, true);
  assert.ok(Math.abs(angleDiff(stepHeading(10, 40, 100), 40)) < 1e-9);
  assert.equal(stepHeading(10, 100, 0), 10);
  assert.equal(stepHeading(10, 100, -1), 10);
  assert.equal(stepHeading(10, NaN, 1), 10);
});

test("stepHeading: a 90 degree turn takes about half a second to a second", () => {
  let h = 0;
  let t = 0;
  while (Math.abs(angleDiff(h, 90)) > 2 && t < 5) {
    h = stepHeading(h, 90, 0.016);
    t += 0.016;
  }
  assert.ok(t > 0.4 && t < 1.2, `took ${t}`);
});

test("at 60x over the zigzag route no 16 ms frame turns more than the cap", () => {
  const p = zigzag();
  const total = lengthOf(p);
  const dt = 0.016;
  let s = 0;
  let h = lookHeading(p, 0);
  let worst = 0;
  let maxLeadErr = 0;
  while (s < total) {
    s += 60 * 1 * dt; // 60x at 1 m/s
    const next = stepHeading(h, lookHeading(p, s), dt);
    worst = Math.max(worst, Math.abs(angleDiff(h, next)));
    h = next;
    maxLeadErr = Math.max(maxLeadErr, Math.abs(angleDiff(h, lookHeading(p, s))));
  }
  assert.ok(worst <= TURN_RATE_DEG_S * dt + 1e-9, `worst ${worst}`);
  assert.ok(Number.isFinite(maxLeadErr));
});
