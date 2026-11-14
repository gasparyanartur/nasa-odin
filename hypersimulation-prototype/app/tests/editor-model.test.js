// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInputs } from "../src/inputs.js";
import {
  BOUNDS, addStation, moveStation, nudgeStation, setStationKind, setStationTask, removeStation, reorderStation,
  addNoGo, setNoGoLabel, removeNoGo, setValue, stepValue, clampValue,
} from "../src/ui/editor-model.js";

const committed = validateInputs(JSON.parse(readFileSync(new URL("../public/data/team-inputs.json", import.meta.url), "utf8"))).inputs;
const valid = (o) => assert.equal(validateInputs(o).ok, true);

test("the input object is never changed in place", () => {
  const before = JSON.stringify(committed);
  addStation(committed, { x: 1, y: 2 });
  moveStation(committed, 1, { x: 5, y: 5 });
  removeStation(committed, 1);
  setValue(committed, "partner_trail_m", 30);
  assert.equal(JSON.stringify(committed), before);
});

test("addStation appends the next id, empty task, no flags", () => {
  const n = committed.stations.length;
  const r = addStation(committed, { x: 12.34567, y: -3, kind: "hollow" });
  valid(r);
  const s = r.stations[n];
  assert.equal(s.id, n + 1);
  assert.equal(s.x, 12.346);
  assert.equal(s.kind, "hollow");
  assert.equal(s.task, "");
  assert.deepEqual(s.placeholder, { position: false, kind: false, task: false });
});

test("move and nudge clear only the position flag and the stale relief", () => {
  const base = JSON.parse(JSON.stringify(committed));
  base.stations[0].placeholder = { position: true, kind: true, task: true };
  const r = nudgeStation(base, 1, 10, -1);
  valid(r);
  assert.equal(r.stations[0].x, base.stations[0].x + 10);
  assert.equal(r.stations[0].y, base.stations[0].y - 1);
  assert.deepEqual(r.stations[0].placeholder, { position: false, kind: true, task: true });
  assert.equal("relief_m" in r.stations[0], false);
  const m = moveStation(base, 2, { x: 0, y: 0 });
  assert.equal(m.stations[1].x, 0);
  assert.throws(() => moveStation(base, 99, { x: 0, y: 0 }), /no station/);
});

test("kind and task edits clear their own flag only", () => {
  const base = JSON.parse(JSON.stringify(committed));
  base.stations[1].placeholder = { position: true, kind: true, task: true };
  const k = setStationKind(base, 2, base.stations[1].kind === "ridge" ? "hollow" : "ridge");
  assert.deepEqual(k.stations[1].placeholder, { position: true, kind: false, task: true });
  const t = setStationTask(base, 2, "Look at it.");
  assert.deepEqual(t.stations[1].placeholder, { position: true, kind: true, task: false });
  assert.equal(t.stations[1].task, "Look at it.");
  assert.throws(() => setStationKind(base, 2, "peak"));
});

test("removeStation renumbers 1..n and keeps the order", () => {
  const r = removeStation(committed, 2);
  valid(r);
  assert.deepEqual(r.stations.map((s) => s.id), r.stations.map((_, i) => i + 1));
  assert.equal(r.stations.length, committed.stations.length - 1);
  assert.equal(r.stations[1].x, committed.stations[2].x);
  assert.equal(r.stations[0].x, committed.stations[0].x);
});

test("reorderStation swaps neighbours, renumbers, and stops at the ends", () => {
  const r = reorderStation(committed, 1, +1);
  valid(r);
  assert.equal(r.stations[0].x, committed.stations[1].x);
  assert.equal(r.stations[1].x, committed.stations[0].x);
  assert.deepEqual(r.stations.map((s) => s.id), r.stations.map((_, i) => i + 1));
  assert.deepEqual(reorderStation(committed, 1, -1), committed);
  const last = committed.stations.length;
  assert.deepEqual(reorderStation(committed, last, +1), committed);
});

test("no-go zones: add, relabel, remove", () => {
  const poly = [[0, 0], [10, 0], [10, 10]];
  const a = addNoGo(committed, poly, "Soft ground");
  valid(a);
  const z = a.no_go[a.no_go.length - 1];
  assert.equal(z.label, "Soft ground");
  assert.equal(z.placeholder, false);
  assert.equal(new Set(a.no_go.map((q) => q.id)).size, a.no_go.length);
  const l = setNoGoLabel(a, z.id, "Other");
  assert.equal(l.no_go[l.no_go.length - 1].label, "Other");
  const r = removeNoGo(a, z.id);
  assert.equal(r.no_go.length, committed.no_go.length);
  assert.throws(() => addNoGo(committed, [[0, 0], [1, 1]], "x"), /3 corners/);
  assert.match(addNoGo(committed, poly, "  ").no_go.pop().label, /^No-go zone/);
});

test("setValue clamps to the bounds, snaps to the step, clears the flag", () => {
  for (const key of Object.keys(BOUNDS)) {
    const b = BOUNDS[key];
    const lo = setValue(committed, key, -1e6);
    const hi = setValue(committed, key, 1e6);
    valid(lo);
    valid(hi);
    assert.equal(lo[key].value, b.min, key);
    assert.equal(hi[key].value, b.max, key);
    assert.equal(lo[key].placeholder, false);
  }
  assert.equal(clampValue("walking_speed_m_s", 0.74), 0.7);
  assert.equal(setValue(committed, "start_lmst_hour", 23.9).start_lmst_hour.value, 23.5);
  assert.throws(() => setValue(committed, "walking_speed_m_s", "fast"), /number/);
  assert.throws(() => setValue(committed, "nope", 1), /unknown/);
});

test("stepValue moves one step without float drift", () => {
  let o = committed;
  o = setValue(o, "walking_speed_m_s", 0.7);
  for (let i = 0; i < 3; i++) o = stepValue(o, "walking_speed_m_s", +1);
  assert.equal(o.walking_speed_m_s.value, 1);
  o = stepValue(o, "walking_speed_m_s", -1);
  assert.equal(o.walking_speed_m_s.value, 0.9);
});
