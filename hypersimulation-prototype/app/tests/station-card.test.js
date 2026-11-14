// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stationCardModel, conditionsAt, arrivalTimes, signed, clock, CONTEXT_PHOTO } from "../src/ui/station-card.js";
import { thermalSeries, stepPath, gapHours, currentLmst, walkHours, tableHours } from "../src/ui/conditions-panel.js";
import { MARS_HOUR_S } from "../src/replay.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const conditions = read("../public/data/conditions.json");
const dose = read("../public/data/dose.json");
const inputs = read("../public/data/team-inputs.json");

test("conditionsAt picks the hour mean and keeps a missing value null", () => {
  const c = conditionsAt(conditions, dose, 10.6);
  assert.equal(c.hour, 10);
  assert.equal(c.ground_brightness_temp_c, -21.088);
  assert.equal(c.uv_abc_w_m2, null, "UV at 10:00 has no data in the file");
  assert.ok(Number.isFinite(c.dose_rate));
  assert.equal(c.dose_detector, "B");
  const none = conditionsAt(conditions, dose, null);
  assert.equal(none.hour, null);
  assert.equal(none.ground_brightness_temp_c, null);
  assert.equal(none.dose_rate, null);
});

test("station card model: fixed slots, derived relief, context photo label", () => {
  const s = inputs.stations[0];
  const m = stationCardModel(s, { conditions, dose, lmst_hour: 9.2 });
  assert.equal(m.label, `S${s.id}`);
  assert.equal(m.aria, `Station ${s.id}`);
  assert.equal(m.kind, s.kind === "ridge" ? "Ridge" : "Hollow");
  assert.equal(m.relief.value, s.relief_m);
  assert.equal(m.relief.note, s.relief_note);
  assert.equal(m.sol, 4600);
  assert.equal(m.hour, 9);
  assert.deepEqual(m.rows.map((r) => r.field), ["ground_brightness_temp_c", "air_temp_c", "pressure_pa", "uv_abc_w_m2", "dose_rate"]);
  assert.equal(m.photo.caption, "Context: Mastcam panorama of the boxwork area, May 2025 - not this station");
  assert.equal(m.photo.src, CONTEXT_PHOTO.src);
  assert.equal(m.photo.credit, "NASA/JPL-Caltech/MSSS");
  assert.ok(!/placeholder/i.test(JSON.stringify(m)));
  const blank = stationCardModel({ id: 9, kind: "hollow", task: "  " }, {});
  assert.equal(blank.task, null);
  assert.equal(blank.relief, null);
  assert.equal(blank.hour, null);
  assert.ok(blank.rows.every((r) => r.value === null));
});

test("arrival times, signed relief and LMST clock text", () => {
  assert.deepEqual(arrivalTimes({ events: [{ type: "depart", station_id: "base", t_s: 0 }, { type: "arrive", station_id: 1, t_s: 60 }, { type: "arrive", station_id: 1, t_s: 900 }] }), { 1: 60 });
  assert.deepEqual(arrivalTimes(null), {});
  assert.equal(signed(1.1), "+1.1");
  assert.equal(signed(-1.01), "-1.0");
  assert.equal(signed(0.01), "0.0");
  assert.equal(clock(10.1), "10:06");
  assert.equal(clock(9.9999), "10:00");
  assert.equal(clock(null), null);
});

test("thermal series: 24 hours, min and max with their hour, gaps break the step line", () => {
  const { series, min, max } = thermalSeries(conditions);
  assert.equal(series.length, 24);
  assert.equal(min.hour, 1);
  assert.equal(max.hour, 12);
  const d = stepPath([{ hour: 0, value: 0 }, { hour: 1, value: null }, { hour: 2, value: -10 }], -10, 0, { w: 240, h: 100, pad: 0 });
  assert.equal(d, "M0.00 0.00H10.00M20.00 100.00H30.00");
  assert.deepEqual(gapHours([{ hour: 3, value: null }, { hour: 4, value: 1 }]), [3]);
  assert.ok(!/\d+\.\d+ (?:°C|degC)/.test(d), "no unit text in the chart path");
});

test("current hour: replay position first, else the walk start", () => {
  assert.deepEqual(currentLmst({ walk: { snapshot: { lmst_hour: 11.5 } }, inputs }), { hour: 11.5, basis: "replay" });
  assert.deepEqual(currentLmst({ walk: { snapshot: null }, inputs }), { hour: 9, basis: "start" });
  assert.deepEqual(currentLmst({ inputs: {} }), { hour: null, basis: null });
});

test("walk hours and table hours", () => {
  assert.deepEqual(walkHours(inputs, 2.5 * MARS_HOUR_S), [9, 10, 11]);
  assert.deepEqual(walkHours({}, 1000), []);
  assert.deepEqual(tableHours([20, 21]).slice(-3), [18, 20, 21]);
  assert.equal(tableHours([]).length, 13);
});
