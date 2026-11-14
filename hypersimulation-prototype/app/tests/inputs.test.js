// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInputs, saveLocal, loadLocal, chooseInputs, exportJson, safeStorage } from "../src/inputs.js";
import { fieldWords } from "../src/ui/error.js";

const committed = JSON.parse(readFileSync(new URL("../public/data/team-inputs.json", import.meta.url), "utf8"));
const clone = () => JSON.parse(JSON.stringify(committed));
const problem = (mutate) => {
  const o = clone();
  mutate(o);
  return validateInputs(o);
};

test("the committed walk inputs file validates and every item carries its flag", () => {
  const r = validateInputs(committed);
  assert.equal(r.ok, true);
  assert.equal(r.inputs.stations.length, committed.stations.length);
  assert.ok(r.inputs.stations.length >= 1);
  assert.equal(r.inputs.drill_sites.length, committed.drill_sites.length);
  assert.ok(r.inputs.stations.every((s) => typeof s.task === "string" && s.task.length > 0));
  assert.ok(r.inputs.stations.every((s) => ["position", "kind", "task"].every((k) => typeof s.placeholder[k] === "boolean")));
  for (const k of ["walking_speed_m_s", "work_time_min_per_station", "partner_trail_m", "hazard_start_min", "start_lmst_hour"]) {
    assert.equal(typeof r.inputs[k].placeholder, "boolean", k);
  }
  assert.ok(r.inputs.stations.every((s) => Math.abs(s.x) <= 512 && Math.abs(s.y) <= 512));
});

test("validateInputs names the first bad field", () => {
  assert.deepEqual(problem((o) => delete o.stations), { ok: false, field: "stations", problem: "missing or not a list" });
  assert.equal(problem((o) => (o.stations[2].kind = "peak")).field, "stations[2].kind");
  assert.equal(problem((o) => (o.no_go[0].polygon = [[0, 0], [1, 1]])).field, "no_go[0].polygon");
  assert.equal(problem((o) => (o.walking_speed_m_s.value = -1)).field, "walking_speed_m_s.value");
  assert.equal(problem((o) => (o.walking_speed_m_s.value = "fast")).field, "walking_speed_m_s.value");
  assert.equal(problem((o) => delete o.hazard_start_min).field, "hazard_start_min");
  assert.equal(problem((o) => (o.start_lmst_hour.value = 24)).field, "start_lmst_hour.value");
  assert.equal(problem((o) => delete o.stations[0].placeholder.task).field, "stations[0].placeholder.task");
  assert.equal(problem((o) => (o.base.x = "0")).field, "base.x");
  assert.equal(problem((o) => (o.stations[1].id = 1)).field, "stations[1].id");
  assert.equal(problem((o) => (o.no_go[0].polygon[1] = [1, "a"])).field, "no_go[0].polygon[1]");
});

test("validateInputs rejects non-objects", () => {
  assert.equal(validateInputs(null).ok, false);
  assert.equal(validateInputs([]).ok, false);
  assert.equal(validateInputs("x").field, "(file)");
});

test("saveLocal and loadLocal round trip through a storage object", () => {
  const mem = new Map();
  const storage = { setItem: (k, v) => mem.set(k, v), getItem: (k) => (mem.has(k) ? mem.get(k) : null) };
  assert.equal(loadLocal(storage), null);
  saveLocal(clone(), storage);
  const r = loadLocal(storage);
  assert.equal(r.ok, true);
  assert.deepEqual(r.inputs, committed);
  mem.set([...mem.keys()][0], "{oops");
  assert.equal(loadLocal(storage).ok, false);
  mem.set([...mem.keys()][0], JSON.stringify({ ...committed, stations: "x" }));
  assert.equal(loadLocal(storage).field, "stations");
});

test("chooseInputs: a bad stored copy shows the error once, is removed after Continue, and the next load is clean", async () => {
  const mem = new Map();
  const storage = { setItem: (k, v) => mem.set(k, v), getItem: (k) => (mem.has(k) ? mem.get(k) : null), removeItem: (k) => mem.delete(k) };
  const asked = [];
  const ask = async (info) => { asked.push(info); };
  assert.equal(await chooseInputs(committed, ask, storage), committed);
  assert.equal(asked.length, 0);
  saveLocal(clone(), storage);
  const good = await chooseInputs(committed, ask, storage);
  assert.deepEqual(good, committed);
  assert.equal(asked.length, 0);
  mem.set([...mem.keys()][0], "{oops");
  assert.equal(await chooseInputs(committed, ask, storage), committed);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].field, "(stored file)");
  assert.equal(mem.size, 0, "the bad copy is gone");
  assert.equal(await chooseInputs(committed, ask, storage), committed);
  assert.equal(asked.length, 1, "no error screen on the next load");
  // the copy stays until the user has answered
  mem.set("marswalk.team-inputs.v1", JSON.stringify({ ...committed, stations: "x" }));
  let release;
  const pending = chooseInputs(committed, () => new Promise((r) => { release = r; }), storage);
  await Promise.resolve();
  assert.equal(mem.size, 1);
  release();
  await pending;
  assert.equal(mem.size, 0);
  // blocked storage must not break the start
  const blocked = { getItem: () => JSON.stringify({ nope: 1 }), removeItem: () => { throw new Error("blocked"); } };
  assert.equal(await chooseInputs(committed, ask, blocked), committed);
});

test("chooseInputs: with site storage blocked (reading localStorage throws) the app starts on the committed inputs", async () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError: access denied"); } });
  try {
    assert.equal(safeStorage(), null);
    assert.equal(await chooseInputs(committed, async () => { throw new Error("no error screen expected"); }), committed);
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete globalThis.localStorage;
  }
});

test("the inputs error screen names a field in plain words, never the raw keys", () => {
  for (const f of ["placeholder", "stations[2].placeholder", "stations[0].placeholder.position", "no_go[1].placeholder", "base.placeholder", "hazard_start_min.placeholder"]) {
    assert.ok(!/placeholder/i.test(fieldWords(f)), `${f} -> ${fieldWords(f)}`);
  }
  assert.equal(fieldWords("stations[2].placeholder"), "station 3, draft flag");
  assert.equal(fieldWords("no_go[0].polygon[3]"), "no-go zone 1, corner 4");
  assert.equal(fieldWords("walking_speed_m_s.value"), "walking speed, value");
  assert.equal(fieldWords("(stored file)"), "the copy kept in this browser");
});

test("exportJson returns a JSON Blob that parses back", async () => {
  const blob = exportJson(clone());
  assert.equal(blob.type, "application/json");
  assert.deepEqual(JSON.parse(await blob.text()), committed);
});
