// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { parseUrlOptions, stateFromOptions, initialState, createStore, initialPlan, initialWalk } from "../src/state.js";

test("URL options default to the plan view with the image, stations and no-go layers (slope off)", () => {
  const o = parseUrlOptions("");
  assert.equal(o.view, "plan");
  assert.equal(o.data, "real");
  assert.deepEqual(o.layers, ["image", "stations", "no_go"]);
  assert.ok(!o.layers.includes("slope"));
  assert.equal(o.imagery, null);
  assert.equal(o.exag, 1);
  assert.equal(o.fps, false);
});

test("?imagery= accepts colour and grey, anything else is ignored", () => {
  assert.equal(parseUrlOptions("?imagery=grey").imagery, "grey");
  assert.equal(parseUrlOptions("?imagery=colour").imagery, "colour");
  assert.equal(parseUrlOptions("?imagery=sepia").imagery, null);
  assert.equal(parseUrlOptions("?imagery=").imagery, null);
});

test("the imagery option reaches the state as {mode, loading: false}", () => {
  assert.deepEqual(stateFromOptions(parseUrlOptions("?imagery=grey")).imagery, { mode: "grey", loading: false });
  assert.deepEqual(stateFromOptions(parseUrlOptions("")).imagery, { mode: null, loading: false });
  assert.deepEqual(initialState().imagery, { mode: null, loading: false });
});

test("other options: view, layers, t, hazard, exag, fps, panel", () => {
  const o = parseUrlOptions("?view=2d&layer=slope,bogus,slope&t=90&hazard=1&exag=2&fps=1&panel=rover&data=mock");
  assert.equal(o.view, "2d");
  assert.deepEqual(o.layers, ["image", "stations", "no_go", "slope"]);
  assert.equal(o.t, 90);
  assert.equal(o.hazard, true);
  assert.equal(o.exag, 2);
  assert.equal(o.fps, true);
  assert.equal(o.panel, "rover");
  assert.equal(o.data, "mock");
  assert.equal(stateFromOptions(o).renderer, "2d");
});

test("the store notifies only on a real change", () => {
  const s = createStore({ a: 1 });
  let n = 0;
  s.subscribe(() => n++);
  s.setState({ a: 1 });
  s.setState({ a: 2 });
  assert.equal(n, 1);
});

test("the store carries the plan, the walk, the open panel and the sheet", () => {
  const s = initialState();
  assert.deepEqual(s.plan, initialPlan());
  assert.equal(s.plan.status, "idle");
  assert.deepEqual(s.walk.held, []);
  assert.equal(s.walk.speed, 60, "the walk replay starts at 60x so a long walk moves visibly");
  assert.equal(s.walk.card, null);
  assert.equal(s.panel, "limits");
  assert.equal(s.sheet, null);
  assert.equal(initialWalk().active, false);
});

test("?sheet= accepts route-card only", () => {
  assert.equal(parseUrlOptions("?sheet=route-card").sheet, "route-card");
  assert.equal(parseUrlOptions("?sheet=bogus").sheet, null);
  assert.equal(parseUrlOptions("").sheet, null);
});

test("?panel= accepts the six dock panels only", () => {
  assert.equal(parseUrlOptions("?panel=editor").panel, "editor");
  assert.equal(parseUrlOptions("?panel=bogus").panel, null);
  assert.equal(stateFromOptions(parseUrlOptions("?panel=credits")).panel, "credits");
  assert.equal("panel" in stateFromOptions(parseUrlOptions("")), false);
});

test("?layer= adds to the default layers; a leading minus removes one", () => {
  assert.deepEqual(parseUrlOptions("?layer=slope").layers, ["image", "stations", "no_go", "slope"]);
  assert.deepEqual(parseUrlOptions("?layer=slope,-no_go").layers, ["image", "stations", "slope"]);
  assert.deepEqual(parseUrlOptions("?layer=-image,-bogus,rover_path").layers, ["stations", "no_go", "rover_path"]);
  assert.deepEqual(parseUrlOptions("?layer=image").layers, ["image", "stations", "no_go"]);
  assert.deepEqual(parseUrlOptions("?layer=").layers, ["image", "stations", "no_go"]);
});

test("a subscriber that throws does not starve the ones after it; the error still surfaces", () => {
  const store = createStore({ a: 0 });
  const seen = [];
  store.subscribe(() => { throw new Error("boom"); });
  store.subscribe((s) => seen.push(s.a));
  assert.throws(() => store.setState({ a: 1 }), /boom/);
  assert.deepEqual(seen, [1]);
  assert.equal(store.getState().a, 1);
});

test("the story state: step 1, no free view, the drawer closed, origin labels hidden, no picked station", () => {
  const s = initialState();
  assert.equal(s.step, 1);
  assert.equal(s.explore, false);
  assert.equal(s.drawer, false);
  assert.equal(s.showSources, false);
  assert.equal(s.picked, null);
  assert.equal(parseUrlOptions("?step=3").step, 3);
  assert.equal(parseUrlOptions("?step=0").step, null);
  assert.equal(parseUrlOptions("?panel=timeline").panel, "timeline");
});
