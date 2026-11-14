// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { buildConstraints, LIMITS, LIMIT_SOURCES } from "../src/constraints.js";

const route = {
  ok: true,
  total_m: 1000,
  legs: [
    { from: { id: "base", x: 0, y: 0 }, to: { id: 1, x: 300, y: 400 }, path: [[0, 0], [300, 400]], distance_m: 500, max_slope_deg: 9, climb_m: 0, descent_m: 0, bearing_deg: 36.9 },
    { from: { id: 1, x: 300, y: 400 }, to: { id: "base", x: 0, y: 0 }, path: [[300, 400], [0, 0]], distance_m: 500, max_slope_deg: 12, climb_m: 0, descent_m: 0, bearing_deg: 216.9 },
  ],
};
const inputs = {
  base: { x: 0, y: 0, assumption: true },
  walking_speed_m_s: { value: 1, placeholder: true },
  work_time_min_per_station: { value: 10, placeholder: true },
  partner_trail_m: { value: 50, placeholder: true },
  stations: [{ id: 1, x: 300, y: 400, placeholder: { position: true } }],
};
const dose = {
  sol: 4600,
  dose_rate: { value: 10, unit: "microGy/hour", detector: "B", n_obs: 5, derived_daily: { value: 0.3, unit: "mGy/day", method: "mean x 24" } },
  fallback: { value: 0.21, plus_minus: 0.04, unit: "mGy/day", source: "Hassler et al. 2014", period: "Gale, 2012 to 2013" },
  dose_equivalent_rate: { value: 0.64, plus_minus: 0.12, unit: "mSv/day", source: "Hassler et al. 2014" },
};
const byId = (rows, id) => rows.find((r) => r.id === id);

test("limits come from one constant, each with a source id string", () => {
  assert.deepEqual(LIMITS, { slope_cap_deg: 15, rover_range_m: 2000, partner_max_m: 100, suit_time_max_h: 14, career_dose_msv: 600 });
  assert.deepEqual(Object.keys(LIMIT_SOURCES), Object.keys(LIMITS));
  for (const v of Object.values(LIMIT_SOURCES)) assert.equal(typeof v, "string");
});

test("slope row: steepest slope on the route against 15 degrees", () => {
  const r = byId(buildConstraints({ route, inputs, dose }), "slope_cap");
  assert.equal(r.value, 12);
  assert.equal(r.limit, 15);
  assert.equal(r.margin, 3);
  assert.equal(r.pass, true);
  assert.equal(r.body, "Moon");
  assert.equal(r.source, "pena_asensio_2024");
  assert.equal(r.assumption, true);
});

test("slope row fails above the cap", () => {
  const steep = { ...route, legs: [{ ...route.legs[0], max_slope_deg: 16 }, route.legs[1]] };
  const r = byId(buildConstraints({ route: steep, inputs, dose }), "slope_cap");
  assert.equal(r.pass, false);
  assert.equal(r.margin, -1);
});

test("rover range row: farthest point from the base against 2 km", () => {
  const r = byId(buildConstraints({ route, inputs, dose }), "rover_range");
  assert.equal(r.value, 500);
  assert.equal(r.limit, 2000);
  assert.equal(r.pass, true);
  assert.equal(r.body, "Earth analog for a lunar rover");
  assert.equal(r.source, "drats_2022");
});

test("partner row is an assumption against 100 m", () => {
  const r = byId(buildConstraints({ route, inputs, dose }), "partner_spacing");
  assert.equal(r.value, 50);
  assert.equal(r.limit, 100);
  assert.equal(r.provenance, "assumption");
  assert.equal(r.assumption, true);
  assert.equal(r.source, "drats_2022");
  const wide = byId(buildConstraints({ route, inputs: { ...inputs, partner_trail_m: { value: 120 } }, dose }), "partner_spacing");
  assert.equal(wide.pass, false);
});

test("suit time row: distance over speed plus work time, flagged as assumption", () => {
  const r = byId(buildConstraints({ route, inputs, dose }), "suit_time");
  // 1000 m / 1 m/s = 1000 s, plus one station x 10 min = 600 s.
  assert.ok(Math.abs(r.value - 1600 / 3600) < 1e-9);
  assert.equal(r.limit, 14);
  assert.equal(r.unit, "h");
  assert.equal(r.pass, true);
  assert.equal(r.assumption, true);
  assert.equal(r.source, "nasa_std_3001_v2");
  assert.equal(r.body, "Not surface-specific");
});

test("suit time fails over 14 h", () => {
  const slow = { ...inputs, walking_speed_m_s: { value: 0.01 } };
  const r = byId(buildConstraints({ route, inputs: slow, dose }), "suit_time");
  assert.equal(r.pass, false);
  assert.ok(r.margin < 0);
});

test("dose rows use the sol's derived daily value when present, and say so", () => {
  const rows = buildConstraints({ route, inputs, dose });
  const w = byId(rows, "walk_dose");
  const days = 1600 / 3600 / 24;
  assert.ok(Math.abs(w.value - 0.3 * days) < 1e-12);
  assert.equal(w.unit, "mGy");
  assert.match(w.rate_basis, /dose\.json/);
  assert.equal(w.source, "rad");
  assert.equal(w.assumption, true);
  const c = byId(rows, "career_dose");
  assert.ok(Math.abs(c.value - 0.64 * days) < 1e-12);
  assert.equal(c.limit, 600);
  assert.equal(c.pass, true);
  assert.equal(c.source, "hassler_2014");
  assert.equal(c.limit_source, "nasa_std_3001_v1");
  assert.equal(c.limit_body, "All");
  assert.ok(Math.abs(c.share_of_limit - c.value / 600) < 1e-15);
});

test("dose falls back to Hassler when derived_daily is null, and says so", () => {
  const d = { ...dose, dose_rate: { ...dose.dose_rate, value: null, derived_daily: { value: null, unit: "mGy/day", method: "" } } };
  const w = byId(buildConstraints({ route, inputs, dose: d }), "walk_dose");
  assert.ok(Math.abs(w.value - 0.21 * (1600 / 3600 / 24)) < 1e-12);
  assert.match(w.rate_basis, /Hassler/);
  assert.equal(w.source, "hassler_2014");
  assert.equal(w.body, "Mars, Gale, 2012 to 2013");
  const noDerived = { ...dose, dose_rate: { value: null, unit: "microGy/hour" } };
  assert.match(byId(buildConstraints({ route, inputs, dose: noDerived }), "walk_dose").rate_basis, /Hassler/);
});

test("missing dose file gives null values, never zero", () => {
  const rows = buildConstraints({ route, inputs, dose: null });
  assert.equal(byId(rows, "walk_dose").value, null);
  const c = byId(rows, "career_dose");
  assert.equal(c.value, null);
  assert.equal(c.margin, null);
  assert.equal(c.pass, false);
});

test("a route that did not plan gives null values", () => {
  const rows = buildConstraints({ route: { ok: false, blocking: { limit: "slope_cap" } }, inputs, dose });
  assert.equal(byId(rows, "slope_cap").value, null);
  assert.equal(byId(rows, "suit_time").value, null);
  assert.equal(byId(rows, "partner_spacing").value, 50);
});

test("every row carries id, label, unit, body, source string and provenance", () => {
  for (const r of buildConstraints({ route, inputs, dose })) {
    for (const k of ["id", "label", "unit", "body", "source", "provenance"]) assert.equal(typeof r[k], "string", `${r.id}.${k}`);
    assert.equal(typeof r.assumption, "boolean");
  }
});
