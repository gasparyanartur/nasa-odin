// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { hudModel, announcement, fmtBearing, fmtInt, fmtDuration, fmtUtc, marginDuration, SCENARIO_TEXT } from "../src/ui/hud.js";
import { LIMITS } from "../src/constraints.js";

const inputs = {
  walking_speed_m_s: { value: 0.7 },
  work_time_min_per_station: { value: 25 },
  partner_trail_m: { value: 20 },
  stations: [
    { id: 1, kind: "ridge" },
    { id: 2, kind: "hollow" },
    { id: 3, kind: "ridge" },
  ],
};

const conditions = (temp) => ({ ground_brightness_temp_c: temp, air_temp_c: -50, pressure_pa: 740, uv_abc_w_m2: null, rel_humidity_pct: null });

function snap(over = {}) {
  return {
    pos: { x: 0, y: 0 }, heading_deg: 90, leg_index: 1, at_station: null, next_station: 3,
    dist_to_next_m: 153.4, bearing_to_next_deg: 219.4, dist_to_base_m: 526, dist_to_partner_m: 20,
    suit_time_left_s: 12 * 3600 + 56 * 60, lmst_hour: 10.4, conditions: conditions(-21.088), mode: "walk",
    ...over,
  };
}

function walk(over = {}, snapOver = {}) {
  return { active: true, playing: true, speed: 1, t_s: 3840, snapshot: snap(snapOver), hazard: { active: false }, held: [], card: null, ...over };
}

test("walk: six items with margins as value left of the limit", () => {
  const m = hudModel(walk(), inputs, LIMITS, { sol: 4600 });
  assert.equal(m.visible, true);
  assert.equal(m.mode, "walk");
  assert.equal(m.warning, null);
  assert.equal(m.held, "none");
  assert.equal(m.nav.target, "NEXT S3 RIDGE");
  assert.equal(fmtBearing(m.nav.bearing), "219");
  assert.equal(fmtInt(m.nav.distance_m), "153");
  assert.equal(m.margins.length, 3);
  const [suit, rover, partner] = m.margins;
  assert.equal(suit.value, 12 * 3600 + 56 * 60);
  assert.ok(Math.abs(suit.left - (12 * 60 + 56) / (14 * 60)) < 1e-9);
  assert.equal(rover.value, 2000 - 526);
  assert.equal(fmtInt(rover.value), "1,474");
  assert.equal(partner.value, 80);
  assert.ok(m.margins.every((x) => x.level === "ok"));
  assert.deepEqual(m.margins.map((x) => [x.limit_num.value, x.limit_num.unit]), [[14, "h"], [2, "km"], [100, "m"]]);
  assert.equal(m.science.lead, "S3 RIDGE - ground brightness temperature");
  assert.equal(m.science.temp_c, -21.088);
  assert.equal(m.science.lmst_hour, 10);
  assert.equal(m.science.sol, 4600);
  assert.equal(m.actions.next.disabled, false);
  assert.equal(m.actions.ack.disabled, true);
  assert.equal(m.actions.ret.pressed, false);
});

test("walk toward base on the last leg names the crew rover", () => {
  const m = hudModel(walk({}, { next_station: null }), inputs, LIMITS, { sol: 4600 });
  assert.equal(m.nav.target, "NEXT BASE - CREW ROVER");
  assert.equal(m.science.lead, "TOWARD BASE - ground brightness temperature");
});

test("work: target after work, station in the science line, work time left from the timeline", () => {
  const timeline = { duration_s: 20000, events: [{ type: "arrive", station_id: 2, t_s: 3000 }] };
  const w = walk({ t_s: 3300, card: 2, timeline }, { mode: "work", at_station: 2, next_station: 3 });
  const m = hudModel(w, inputs, LIMITS, { sol: 4600 });
  assert.equal(m.mode, "work");
  assert.equal(m.nav.target, "AFTER WORK: S3 RIDGE");
  assert.equal(m.science.lead, "AT S2 HOLLOW - ground brightness temperature");
  assert.equal(m.science.station_id, 2);
  assert.equal(m.science.work_left_s, 25 * 60 - 300);
  assert.equal(m.science.work_total_s, 25 * 60);
  assert.equal(m.card, 2);
  assert.equal(m.actions.ack.disabled, false, "Acknowledge closes the open card");
});

test("caution: a margin under 20 percent of its limit lights the amber warning", () => {
  const m = hudModel(walk({}, { dist_to_base_m: 1700 }), inputs, LIMITS, { sol: 4600 });
  const rover = m.margins.find((x) => x.id === "rover");
  assert.equal(rover.value, 300);
  assert.equal(rover.level, "caution");
  assert.equal(m.warning.level, "caution");
  assert.equal(m.warning.word, "CAUTION");
  assert.equal(m.warning.state, "lit");
  assert.equal(m.warning.note, null, "the lit Acknowledge button is the prompt");
  assert.equal(m.warning.detail, "Rover margin low");
  assert.equal(m.warning.margin, "rover");
  assert.equal(m.held, "lit");
  assert.equal(m.actions.ack.disabled, false);
  // 20 percent exactly is not under the line
  const edge = hudModel(walk({}, { dist_to_base_m: 1600 }), inputs, LIMITS, {});
  assert.equal(edge.margins.find((x) => x.id === "rover").level, "ok");
});

test("caution after acknowledge: the compact acknowledged state stays while the condition lasts", () => {
  const cond = { dist_to_base_m: 1700 };
  const m = hudModel(walk({ held: [] }, cond), inputs, LIMITS, { seen: ["caution"] });
  assert.equal(m.warning.state, "acknowledged");
  assert.equal(m.warning.note, "Acknowledged - still in force");
  assert.equal(m.held, "acknowledged");
  assert.equal(m.actions.ack.disabled, true);
  const cleared = hudModel(walk({ held: [] }), inputs, LIMITS, { seen: ["caution"] });
  assert.equal(cleared.warning, null, "gone once the margin recovers");
  // A held alert stays lit even when it was acknowledged before (a new alert of the same kind)
  const again = hudModel(walk({ held: [{ id: "c2", level: "caution", label: "CAUTION", detail: "x" }] }, cond), inputs, LIMITS, { seen: ["caution"] });
  assert.equal(again.warning.state, "lit");
});

test("return: red RETURN NOW with the scenario line, base target and walk-back time", () => {
  const hazard = { active: true, level: "return", label: "RETURN NOW", event_id: "2025-05-13T18:14:00-SEP-001", event_date: "2025-05-13T18:14Z" };
  const timeline = { duration_s: 10000, events: [] };
  const w = walk({ hazard, held: [{ id: "hazard", level: "return", label: "RETURN NOW" }], t_s: 8953, timeline }, { mode: "return", next_station: null, dist_to_next_m: 733, bearing_to_next_deg: 26 });
  const m = hudModel(w, inputs, LIMITS, { sol: 4600 });
  assert.equal(m.mode, "return");
  assert.equal(m.warning.level, "return");
  assert.equal(m.warning.word, "RETURN NOW");
  assert.equal(m.warning.state, "lit");
  assert.equal(m.warning.scenario.event_id, "2025-05-13T18:14:00-SEP-001");
  assert.equal(m.warning.scenario.event_utc, "2025-05-13 18:14");
  assert.equal(m.warning.scenario.text, SCENARIO_TEXT);
  assert.equal(SCENARIO_TEXT, "Scenario - not a measured Mars event");
  assert.equal(m.nav.kind, "base");
  assert.equal(m.nav.target, "BASE - CREW ROVER");
  assert.equal(fmtBearing(m.nav.bearing), "026");
  assert.equal(m.nav.walk_back_s, 1047);
  assert.equal(m.science.lead, "ON THE WAY BACK - ground brightness temperature");
  assert.equal(m.actions.next.disabled, true);
  assert.equal(m.actions.ret.pressed, true);
  // without a timeline the walk back is the straight line over the walking speed
  const m2 = hudModel({ ...w, timeline: null }, inputs, LIMITS, {});
  assert.ok(Math.abs(m2.nav.walk_back_s - 733 / 0.7) < 1e-9);
  // after acknowledge the red state stays, compact
  const ack = hudModel({ ...w, held: [] }, inputs, LIMITS, { seen: ["return"] });
  assert.equal(ack.warning.level, "return");
  assert.equal(ack.warning.state, "acknowledged");
  // red outranks amber
  const both = hudModel({ ...w, snapshot: { ...w.snapshot, dist_to_base_m: 1900 } }, inputs, LIMITS, {});
  assert.equal(both.warning.level, "return");
});

test("return by the R action without a hazard shows no warning", () => {
  const m = hudModel(walk({}, { mode: "return", next_station: null }), inputs, LIMITS, {});
  assert.equal(m.warning, null);
  assert.equal(m.nav.target, "BASE - CREW ROVER");
});

test("null conditions: the science value is null (NO DATA), never zero or an old value", () => {
  const m = hudModel(walk({}, { conditions: conditions(null) }), inputs, LIMITS, { sol: 4600 });
  assert.equal(m.science.temp_c, null);
  const noTime = hudModel(walk({}, { lmst_hour: null, conditions: conditions(null) }), inputs, LIMITS, { sol: 4600 });
  assert.equal(noTime.science.lmst_hour, null);
  assert.equal(noTime.science.temp_c, null);
  const noSnap = hudModel({ active: true, snapshot: null, held: [] }, inputs, LIMITS, {});
  assert.equal(noSnap.nav.distance_m, null);
  assert.ok(noSnap.margins.every((x) => x.value === null));
  // missing data is never silent: it counts as caution
  assert.ok(noSnap.margins.every((x) => x.level === "caution"));
});

test("done and inactive", () => {
  const m = hudModel(walk({}, { mode: "done", next_station: null }), inputs, LIMITS, {});
  assert.equal(m.nav.target, "AT BASE - WALK COMPLETE");
  assert.equal(m.nav.values, false);
  assert.equal(m.actions.next.disabled, true);
  assert.equal(m.actions.ret.disabled, true);
  assert.equal(hudModel({ active: false }, inputs, LIMITS, {}).visible, false);
});

test("announcements: arrival and a new caution; the controller announces return and done", () => {
  const walking = hudModel(walk(), inputs, LIMITS, {});
  const working = hudModel(walk({}, { mode: "work", at_station: 2, next_station: 3 }), inputs, LIMITS, {});
  assert.equal(announcement(walking, working), "Arrived at Station 2. Work at the station starts.");
  assert.equal(announcement(working, working), null);
  const ret = hudModel(walk({ hazard: { active: true } }, { mode: "return" }), inputs, LIMITS, {});
  assert.equal(announcement(working, ret), null);
  const caution = hudModel(walk({}, { dist_to_base_m: 1700 }), inputs, LIMITS, {});
  assert.equal(announcement(walking, caution), "Caution: Rover margin low.");
});

test("a held caution from the controller keeps its text and names its margin", () => {
  const w = walk({ held: [{ id: "rover_range", level: "caution", label: "CAUTION", detail: "Distance to the crew rover near the limit" }] }, { dist_to_base_m: 1700 });
  const m = hudModel(w, inputs, LIMITS, {});
  assert.equal(m.warning.detail, "Distance to the crew rover near the limit");
  assert.equal(m.warning.margin, "rover");
  assert.equal(m.warning.state, "lit");
});

test("work time left and walk-back time also come from the controller's schedule", () => {
  const schedule = { duration_s: 9000, blocks: [{ kind: "walk", t0: 0, t1: 3000, station_id: null }, { kind: "work", t0: 3000, t1: 4500, station_id: 2 }] };
  const m = hudModel(walk({ t_s: 3600, schedule }, { mode: "work", at_station: 2 }), inputs, LIMITS, {});
  assert.equal(m.science.work_left_s, 25 * 60 - 600);
  const r = hudModel(walk({ t_s: 8000, schedule }, { mode: "return", next_station: null }), inputs, LIMITS, {});
  assert.equal(r.nav.walk_back_s, 1000);
});

test("formatters", () => {
  assert.equal(fmtBearing(359.7), "000");
  assert.equal(fmtBearing(-90), "270");
  assert.equal(fmtBearing(null), null);
  assert.equal(fmtInt(-1234.4), "-1,234");
  assert.deepEqual(fmtDuration(12 * 3600 + 56 * 60), { value: "12 h 56", unit: "min" });
  assert.deepEqual(fmtDuration(17 * 60 + 27, { seconds: true }), { value: "17 min 27", unit: "s" });
  assert.deepEqual(fmtDuration(20 * 60), { value: "20", unit: "min" });
  assert.deepEqual(fmtDuration(-5), { value: "0", unit: "min" });
  assert.deepEqual(fmtDuration(null), { value: null, unit: "min" });
  assert.deepEqual(marginDuration(-3600), { value: "-1 h 00", unit: "min" });
  assert.deepEqual(marginDuration(-5 * 60), { value: "-5", unit: "min" });
  assert.deepEqual(marginDuration(20 * 60), { value: "20", unit: "min" });
  assert.equal(fmtUtc("2025-05-13T18:14Z"), "2025-05-13 18:14");
});
