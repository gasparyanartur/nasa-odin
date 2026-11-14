// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { toLocal, toLonLat, distance, bearingDeg, groundDistance, groundBearingDeg, groundScale } from "../src/geo.js";

const scene = { origin: { lon: 137.383, lat: -4.803 }, metres_per_degree: { lon: 59274.7, lat: 59274.7 }, ground_scale: { x: 0.996488, y: 1 } };

test("bearing: north is 0, east is 90, south 180, west 270", () => {
  const o = { x: 0, y: 0 };
  assert.equal(bearingDeg(o, { x: 0, y: 10 }), 0);
  assert.equal(bearingDeg(o, { x: 10, y: 0 }), 90);
  assert.equal(bearingDeg(o, { x: 0, y: -10 }), 180);
  assert.equal(bearingDeg(o, { x: -10, y: 0 }), 270);
});

test("distance is Euclidean", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("toLocal and toLonLat round trip within 0.01 m", () => {
  for (const [x, y] of [[0, 0], [123.4, -56.7], [-500, 500]]) {
    const ll = toLonLat(x, y, scene);
    const back = toLocal(ll.lon, ll.lat, scene);
    assert.ok(Math.abs(back.x - x) < 0.01 && Math.abs(back.y - y) < 0.01);
  }
});

test("toLocal uses projected metres only, ground_scale does not enter", () => {
  const p = toLocal(137.384, -4.802, scene);
  assert.ok(Math.abs(p.x - 59274.7 * 0.001) < 1e-6);
  assert.ok(Math.abs(p.y - 59274.7 * 0.001) < 1e-6);
  assert.deepEqual(toLocal(137.383, -4.803, scene), { x: 0, y: 0 });
});

test("groundScale accepts {x, y}, a bare number (x only, like scene3d) and nothing", () => {
  assert.deepEqual(groundScale(scene), { x: 0.996488, y: 1 });
  assert.deepEqual(groundScale({ ground_scale: 1.002 }), { x: 1.002, y: 1 });
  assert.deepEqual(groundScale({}), { x: 1, y: 1 });
  assert.deepEqual(groundScale({ ground_scale: -2 }), { x: 1, y: 1 });
});

test("groundDistance applies ground_scale to dx and dy, distance stays projected", () => {
  const a = { x: 0, y: 0 };
  assert.ok(Math.abs(groundDistance(a, { x: 100, y: 0 }, scene) - 99.6488) < 1e-9);
  assert.equal(groundDistance(a, { x: 0, y: 100 }, scene), 100);
  assert.equal(distance(a, { x: 100, y: 0 }), 100);
  assert.equal(groundDistance(a, { x: 3, y: 4 }, { ground_scale: { x: 1, y: 1 } }), 5);
});

test("groundBearingDeg bends the bearing by the scale; axes stay 0 and 90", () => {
  const o = { x: 0, y: 0 };
  assert.equal(groundBearingDeg(o, { x: 0, y: 10 }, scene), 0);
  assert.equal(groundBearingDeg(o, { x: 10, y: 0 }, scene), 90);
  const proj = bearingDeg(o, { x: 10, y: 10 });
  const ground = groundBearingDeg(o, { x: 10, y: 10 }, scene);
  assert.equal(proj, 45);
  assert.ok(ground < 45 && ground > 44.7);
});
