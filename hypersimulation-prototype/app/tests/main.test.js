// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { dataBase, isLowDetail, planKeyAction, planKeysAllowed, storyKeyAction, storyKeyGo, formatFps, createTileSink, runSpeedCheck } from "../src/main.js";
import { percent, formatBytes } from "../src/ui/progress.js";
import { describeError, statusText } from "../src/ui/error.js";

test("dataBase and isLowDetail", () => {
  assert.equal(dataBase({ data: "mock" }), "./public/data-mock/");
  assert.equal(dataBase({ data: "real" }), "./public/data/");
  assert.equal(isLowDetail({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(isLowDetail({ matchMedia: () => ({ matches: false }), deviceMemory: 4 }), true);
  assert.equal(isLowDetail({ matchMedia: () => ({ matches: false }), deviceMemory: 8 }), false);
  assert.equal(isLowDetail({}), false);
});

test("plan keys: arrows pan the viewpoint, + - zoom, T tilt, 0 north up, others ignored", () => {
  assert.deepEqual(planKeyAction("ArrowLeft"), { name: "pan", dx: -80, dy: 0 });
  assert.deepEqual(planKeyAction("ArrowUp"), { name: "pan", dx: 0, dy: -80 });
  assert.equal(planKeyAction("ArrowDown", true).dy, 240);
  assert.ok(planKeyAction("+").factor > 1 && planKeyAction("-").factor < 1);
  assert.equal(planKeyAction("T").name, "tilt");
  assert.equal(planKeyAction("0").name, "north");
  assert.equal(planKeyAction("w"), null, "the walk is a story step now, not a key");
  assert.equal(planKeyAction("n"), null);
  assert.equal(planKeyAction("a"), null);
});

test("plan keys are off in walk view, with a modal open, and in text fields or data-keys=off areas", () => {
  const el = (tagName, extra = {}) => ({ tagName, isContentEditable: false, closest: () => null, ...extra });
  assert.equal(planKeysAllowed({ view: "plan", target: el("BODY") }), true);
  assert.equal(planKeysAllowed({ view: "plan", target: null }), true);
  assert.equal(planKeysAllowed({ view: "walk", target: el("BODY") }), false);
  assert.equal(planKeysAllowed({ view: "plan", modalOpen: true, target: el("BODY") }), false);
  for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) assert.equal(planKeysAllowed({ view: "plan", target: el(tag) }), false, tag);
  assert.equal(planKeysAllowed({ view: "plan", target: el("DIV", { isContentEditable: true }) }), false);
  assert.equal(planKeysAllowed({ view: "plan", target: el("BUTTON", { closest: (sel) => (sel === '[data-keys="off"]' ? {} : null) }) }), false);
});

test("fps readout: a rounded number while frames arrive, idle when nothing renders", () => {
  assert.equal(formatFps(59.6, 16), "60 fps");
  assert.equal(formatFps(120.2, 100), "120 fps");
  assert.equal(formatFps(60, 2000), "idle");
  assert.equal(formatFps(null, 16), "idle");
  assert.equal(formatFps(60, null), "idle");
  assert.equal(formatFps(0, 5000), "idle");
});

test("progress helpers and error description", () => {
  assert.equal(percent(50, 200), 25);
  assert.equal(percent(5, 0), null);
  assert.equal(percent(500, 200), 100);
  assert.equal(formatBytes(2 * 1024 * 1024), "2.0 MB");
  assert.deepEqual(describeError({ file: "scene.json", status: 404, reason: "HTTP 404" }), { kind: "data", file: "scene.json", status: 404, reason: "HTTP 404" });
  assert.deepEqual(describeError({ field: "stations", problem: "missing" }), { kind: "inputs", field: "stations", problem: "missing" });
  assert.equal(describeError(new Error("boom")).reason, "boom");
  assert.equal(statusText(0), "No response");
  assert.equal(statusText(404), "HTTP 404");
});

test("tile sink: files that arrive early wait in order, later ones go straight through", () => {
  const sink = createTileSink();
  const seen = [];
  sink.push("dem_core", 1);
  sink.push("slope_core", 2);
  sink.attach((n, p) => seen.push([n, p]));
  sink.push("core_0_0", 3);
  assert.deepEqual(seen, [["dem_core", 1], ["slope_core", 2], ["core_0_0", 3]]);
});

function speedHost() {
  const calls = [];
  return { kind: "3d", calls, setContinuous: (on) => calls.push(on) };
}

test("speed check: waits for the core mesh and a visible page; hidden is retried, never slow", async () => {
  const host = speedHost();
  const perf = { fps: null, decision: "3d-waiting" };
  let release;
  const coreIn = new Promise((r) => (release = r));
  const doc = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  const results = [{ status: "hidden" }, { status: "measured", fps: 90 }];
  let runs = 0;
  const p = runSpeedCheck({ host, perf, coreIn, doc, onSlow: () => assert.fail("not slow"), test: async () => results[runs++] });
  await new Promise((r) => setImmediate(r));
  assert.equal(runs, 0, "no test before the core mesh is in");
  release();
  assert.equal(await p, "3d");
  assert.equal(runs, 2);
  assert.equal(perf.fps, 90);
  assert.deepEqual(host.calls, [true, false, true, false]);
});

test("speed check: skipped keeps 3D untested, a slow measure switches to 2D", async () => {
  const doc = { visibilityState: "visible" };
  const a = { fps: null, decision: "" };
  assert.equal(await runSpeedCheck({ host: speedHost(), perf: a, coreIn: Promise.resolve(), doc, onSlow: () => assert.fail("no"), test: async () => ({ status: "skipped", frames: 3 }) }), "3d-untested");
  const b = { fps: null, decision: "" };
  let slow = 0;
  await runSpeedCheck({ host: speedHost(), perf: b, coreIn: Promise.resolve(), doc, onSlow: () => slow++, test: async () => ({ status: "measured", fps: 12 }) });
  assert.equal(slow, 1);
  assert.equal(b.fps, 12);
});

test("story keys: Right and Enter go on, Left goes back; never in text fields, tab lists, the drawer or the focused map", () => {
  const el = (tagName, closest = () => null) => ({ tagName, closest });
  assert.equal(storyKeyAction("ArrowRight"), "next");
  assert.equal(storyKeyAction("ArrowLeft"), "back");
  assert.equal(storyKeyAction("Enter", { target: el("BODY") }), "next");
  assert.equal(storyKeyAction("Enter", { target: el("BUTTON") }), null, "a focused button keeps its own Enter");
  assert.equal(storyKeyAction("ArrowRight", { target: el("BUTTON") }), "next");
  assert.equal(storyKeyAction("ArrowRight", { target: el("INPUT") }), null);
  assert.equal(storyKeyAction("ArrowRight", { target: el("BUTTON", (sel) => (sel.includes("tablist") ? {} : null)) }), null);
  assert.equal(storyKeyAction("ArrowLeft", { target: el("CANVAS"), mapFocused: true }), null, "the focused map pans");
  assert.equal(storyKeyAction("Enter", { target: el("CANVAS"), mapFocused: true }), "next");
  assert.equal(storyKeyAction("x"), null);
});

test("story keys: a held key steps nothing; Next waits for the route like the Next button; no step past the ends", () => {
  assert.equal(storyKeyGo("next", { step: 1, planStatus: "planning" }), "next", "step 1 needs no route");
  assert.equal(storyKeyGo("next", { step: 2, planStatus: "planning" }), null, "Next is disabled while the route is planned");
  assert.equal(storyKeyGo("next", { step: 3, planStatus: "no_route" }), null);
  assert.equal(storyKeyGo("next", { step: 2, planStatus: "ok" }), "next");
  assert.equal(storyKeyGo("next", { step: 1, planStatus: "ok", repeat: true }), null, "a held Enter or Right steps once");
  assert.equal(storyKeyGo("back", { step: 3, planStatus: "ok", repeat: true }), null, "a held Left steps once");
  assert.equal(storyKeyGo("back", { step: 3, planStatus: "planning" }), "back", "Back never waits");
  assert.equal(storyKeyGo("next", { step: 5, planStatus: "ok" }), null);
  assert.equal(storyKeyGo("back", { step: 1, planStatus: "ok" }), null);
  assert.equal(storyKeyGo(null, { step: 2, planStatus: "ok" }), null);
});
