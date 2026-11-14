// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { routeProfile, profilePath } from "../src/profile.js";

const plane = { heightAt: (x) => x / 10 }; // 1 m of rise per 10 projected metres east
const base = { id: "base", x: 0, y: 0 };
const s1 = { id: "S1", x: 10, y: 0 };
const route = {
  legs: [
    { from: base, to: s1, path: [[0, 0], [10, 0]] },
    { from: s1, to: base, path: [[10, 0], [0, 0]] },
  ],
};

test("two-leg route over a plane: distances, heights, stations", () => {
  const p = routeProfile(route, plane, { sample_m: 2, scene: { ground_scale: { x: 1, y: 1 } } });
  assert.equal(p.total_m, 20);
  assert.equal(p.min_m, 0);
  assert.equal(p.max_m, 1);
  assert.deepEqual(p.stations.map((s) => [s.id, s.d_m, s.h_m]), [["base", 0, 0], ["S1", 10, 1], ["base", 20, 0]]);
  const leg0 = p.points.filter((q) => q.leg_index === 0);
  assert.deepEqual(leg0.map((q) => q.d_m), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(leg0.map((q) => q.h_m), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.equal(p.points.filter((q) => q.leg_index === 1).at(-1).d_m, 20);
});

test("ground_scale shortens east-west distance", () => {
  const p = routeProfile(route, plane, { sample_m: 5, scene: { ground_scale: { x: 0.5, y: 1 } } });
  assert.equal(p.total_m, 10);
});

test("null heights stay null and break the path into segments", () => {
  const holey = { heightAt: (x) => (x > 5 && x < 7 ? null : x / 10) };
  const one = { legs: [route.legs[0]] };
  const p = routeProfile(one, holey, { sample_m: 2, scene: null });
  assert.deepEqual(p.points.map((q) => q.h_m), [0, 0.2, 0.4, null, 0.8, 1]);
  assert.equal(p.min_m, 0);
  const path = profilePath(p, { width: 100, height: 50, pad: 0 });
  assert.equal((path.d.match(/M/g) || []).length, 2);
  assert.ok(!/NaN|null/.test(path.d));
});

test("profilePath: exact pixel positions", () => {
  const p = routeProfile({ legs: [route.legs[0]] }, plane, { sample_m: 5, scene: null });
  const path = profilePath(p, { width: 110, height: 60, pad: 10 });
  assert.equal(path.d, "M10 50L55 30L100 10");
  assert.deepEqual(path.stations, [{ id: "base", x: 10 }, { id: "S1", x: 100 }]);
});

test("flat or empty profile does not divide by zero", () => {
  const flat = routeProfile({ legs: [route.legs[0]] }, { heightAt: () => 5 }, { sample_m: 5 });
  assert.ok(!/NaN/.test(profilePath(flat, {}).d));
  const none = routeProfile({ legs: [route.legs[0]] }, { heightAt: () => null }, { sample_m: 5 });
  assert.equal(none.min_m, null);
  assert.equal(profilePath(none, {}).d, "");
});
