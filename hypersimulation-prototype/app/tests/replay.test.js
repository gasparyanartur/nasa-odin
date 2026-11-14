// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, MARS_HOUR_S } from "../src/replay.js";

const B = { id: "base", x: 0, y: 0 };
const S1 = { id: 1, x: 100, y: 0 };
const S2 = { id: 2, x: 100, y: 100 };
const leg = (from, to, path) => ({
  from, to, path, distance_m: path.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - path[k][0], p[1] - path[k][1]), 0),
  climb_m: 0, descent_m: 0, max_slope_deg: 0, bearing_deg: 0,
});
const route = {
  ok: true,
  legs: [leg(B, S1, [[0, 0], [100, 0]]), leg(S1, S2, [[100, 0], [100, 100]]), leg(S2, B, [[100, 100], [0, 0]])],
};
const inputs = {
  base: { x: 0, y: 0 },
  walking_speed_m_s: { value: 1, placeholder: true },
  work_time_min_per_station: { value: 10, placeholder: true },
  partner_trail_m: { value: 30, placeholder: true },
  start_lmst_hour: { value: 9, placeholder: true },
};
const hours = Array.from({ length: 24 }, (_, h) => ({ lmst_hour: h, ground_brightness_temp_c: h === 10 ? null : -20 + h, air_temp_c: -30, pressure_pa: 700, uv_abc_w_m2: null, rel_humidity_pct: null }));
const conditions = { sol: 4600, hours };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("stateAt(0) is at base, walking toward station 1", () => {
  const s = buildTimeline({ route, inputs, conditions }).stateAt(0);
  assert.deepEqual(s.pos, { x: 0, y: 0 });
  assert.equal(s.mode, "walk");
  assert.equal(s.leg_index, 0);
  assert.equal(s.at_station, null);
  assert.equal(s.next_station, 1);
  near(s.dist_to_next_m, 100);
  near(s.bearing_to_next_deg, 90);
  near(s.heading_deg, 90);
  assert.equal(s.dist_to_base_m, 0);
  assert.equal(s.dist_to_partner_m, 30);
});

test("at the end of leg 1 the astronaut is at station 1 and works for the work time", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  const at = tl.stateAt(100);
  assert.equal(at.at_station, 1);
  assert.equal(at.mode, "work");
  assert.equal(at.next_station, 2);
  near(at.dist_to_base_m, 100);
  assert.equal(tl.stateAt(100 + 599).mode, "work");
  const after = tl.stateAt(100 + 600);
  assert.equal(after.mode, "walk");
  assert.equal(after.at_station, null);
  assert.equal(after.leg_index, 1);
});

test("mid-leg position, distance to base is the straight line", () => {
  const s = buildTimeline({ route, inputs, conditions }).stateAt(50);
  near(s.pos.x, 50);
  near(s.dist_to_base_m, 50);
  const s2 = buildTimeline({ route, inputs, conditions }).stateAt(100 + 600 + 50);
  near(s2.pos.y, 50);
  near(s2.dist_to_base_m, Math.hypot(100, 50));
});

test("suit time left is 14 h minus t", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  assert.equal(tl.stateAt(0).suit_time_left_s, 14 * 3600);
  assert.equal(tl.stateAt(1234).suit_time_left_s, 14 * 3600 - 1234);
});

test("the walk ends at base in mode done", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  // 100 + 100 + sqrt(2) * 100 walking, plus two works of 600 s.
  const expected = 200 + Math.hypot(100, 100) + 1200;
  near(tl.duration_s, expected);
  const end = tl.stateAt(tl.duration_s + 5);
  assert.equal(end.mode, "done");
  assert.deepEqual(end.pos, { x: 0, y: 0 });
  assert.equal(end.dist_to_base_m, 0);
  assert.equal(tl.stateAt(tl.duration_s - 1).mode, "walk");
});

test("events list departures and arrivals with times", () => {
  const ev = buildTimeline({ route, inputs, conditions }).events;
  assert.deepEqual(ev.slice(0, 4).map((e) => [e.type, e.station_id, e.t_s]), [["depart", "base", 0], ["arrive", 1, 100], ["depart", 1, 700], ["arrive", 2, 800]]);
  assert.equal(ev[ev.length - 1].type, "arrive");
  assert.equal(ev[ev.length - 1].station_id, "base");
});

test("LMST hour: start plus t over 3698.97 s, wraps at 24", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  assert.equal(MARS_HOUR_S, 3698.97);
  near(tl.stateAt(0).lmst_hour, 9);
  near(tl.stateAt(3698.97).lmst_hour, 10);
  const late = buildTimeline({ route, inputs: { ...inputs, start_lmst_hour: { value: 23.5 } }, conditions });
  near(late.stateAt(3698.97).lmst_hour, 0.5);
});

test("a null conditions hour stays null, never the previous hour", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  assert.equal(tl.stateAt(0).conditions.ground_brightness_temp_c, -11);
  const hour10 = tl.stateAt(3698.97 + 1);
  assert.equal(hour10.conditions.ground_brightness_temp_c, null);
  assert.equal(hour10.conditions.uv_abc_w_m2, null);
  const missing = buildTimeline({ route, inputs, conditions: { hours: hours.filter((h) => h.lmst_hour !== 9) } });
  assert.equal(missing.stateAt(0).conditions.air_temp_c, null);
  const none = buildTimeline({ route, inputs, conditions: null });
  assert.equal(none.stateAt(0).conditions.pressure_pa, null);
  const noStart = buildTimeline({ route, inputs: { ...inputs, start_lmst_hour: { value: null } }, conditions });
  assert.equal(noStart.stateAt(10).lmst_hour, null);
  assert.equal(noStart.stateAt(10).conditions.air_temp_c, null);
});

test("hazard: mode becomes return, the return leg is followed, and the walk reaches base", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  const th = 100 + 600 + 40;
  const here = tl.stateAt(th).pos;
  near(here.y, 40);
  const returnLeg = { from: { id: "from", ...here }, to: B, path: [[here.x, here.y], [0, 0]], distance_m: Math.hypot(here.x, here.y), bearing_deg: 0 };
  tl.triggerHazard(th, returnLeg);
  assert.equal(tl.stateAt(th - 1).mode, "walk");
  const s = tl.stateAt(th + 1);
  assert.equal(s.mode, "return");
  assert.equal(s.next_station, null);
  near(s.dist_to_base_m, Math.hypot(here.x, here.y) - 1);
  near(tl.duration_s, th + returnLeg.distance_m);
  assert.equal(tl.stateAt(tl.duration_s - 0.5).mode, "return");
  const end = tl.stateAt(tl.duration_s);
  assert.equal(end.mode, "done");
  assert.deepEqual(end.pos, { x: 0, y: 0 });
  const types = tl.events.map((e) => e.type);
  assert.ok(types.includes("hazard"));
  assert.equal(tl.events[tl.events.length - 1].station_id, "base");
  tl.clearHazard();
  assert.equal(tl.stateAt(th + 1).mode, "walk");
});

test("hazard during work: return starts at the station", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  const returnLeg = { to: B, path: [[100, 0], [0, 0]], distance_m: 100 };
  tl.triggerHazard(250, returnLeg);
  const s = tl.stateAt(260);
  assert.equal(s.mode, "return");
  near(s.pos.x, 90);
});

test("hazard after the walk is over changes nothing", () => {
  const tl = buildTimeline({ route, inputs, conditions });
  const d = tl.duration_s;
  tl.triggerHazard(d + 10, { to: B, path: [[0, 0], [0, 0]], distance_m: 0 });
  near(tl.duration_s, d);
});

test("missing walking speed or work time throws, never defaults", () => {
  assert.throws(() => buildTimeline({ route, inputs: { ...inputs, walking_speed_m_s: { value: null } }, conditions }));
  assert.throws(() => buildTimeline({ route, inputs: { ...inputs, walking_speed_m_s: { value: 0 } }, conditions }));
  assert.throws(() => buildTimeline({ route, inputs: { ...inputs, work_time_min_per_station: {} }, conditions }));
  assert.throws(() => buildTimeline({ route: { ok: false }, inputs, conditions }));
});
