// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The guided story: the pure step model (story.js), the address mapping, the sources switch, and the controller
// running the five steps on a 40 m synthetic terrain with a fake view host and a hand-driven clock.
import test from "node:test";
import assert from "node:assert/strict";
import {
  STEPS, stepConfig, planFacts, storyStart, stepSearch, nextStep, prevStep, clampStep, stepLabel, countWord, dateWords,
  overlayFlags, applyLayers, PLACE_VIEW, TURN_S, stationCounts,
} from "../src/story.js";
import { factsFor } from "../src/ui/story.js";
import { parseUrlOptions, stateFromOptions, createStore, initialState } from "../src/state.js";
import { createController, directPlanner } from "../src/controller.js";
import { createTerrain } from "../src/terrain.js";
import { buildConstraints } from "../src/constraints.js";

// ---------------------------------------------------------------- pure step model

const okPlan = () => {
  const route = { ok: true, total_m: 1677, legs: [{ from: { id: "base" }, to: { id: 1 }, max_slope_deg: 15, climb_m: 2, path: [[0, 0], [10, 10]] }] };
  const inputs = {
    base: { x: 0, y: 0, assumption: true }, stations: [{ id: 1, x: 10, y: 10, kind: "ridge" }],
    walking_speed_m_s: { value: 0.7 }, work_time_min_per_station: { value: 25 }, partner_trail_m: { value: 20 },
  };
  const constraints = buildConstraints({ route, inputs, dose: { fallback: { value: 0.21 }, dose_equivalent_rate: { value: 0.64 } } });
  return { status: "ok", route, constraints, schedule: { duration_s: 14400, hazard_start_s: 9000, blocks: [] } };
};

test("five named steps; next and back stop at the ends", () => {
  assert.deepEqual(STEPS.map((s) => s.name), ["Place", "Plan", "Walk", "Hazard", "Check"]);
  assert.equal(nextStep(1), 2);
  assert.equal(nextStep(5), 5);
  assert.equal(prevStep(1), 1);
  assert.equal(prevStep(4), 3);
  assert.equal(clampStep(9), 5);
  assert.equal(clampStep("x"), 1);
  assert.equal(stepLabel(2), "Step 2 of 5 - Plan");
});

test("stepConfig: each step sets its view, camera, layers, overlays, time, hazard and play state", () => {
  const facts = { renderer: "3d", plan: planFacts(okPlan()), rover: { n: 65, under_pct: 92, median_deg: 2.8 }, sep_date: "2025-05-13T18:14Z", core_m: 1024 };
  const c = [1, 2, 3, 4, 5].map((n) => stepConfig(n, facts));
  assert.deepEqual(c.map((x) => x.view), ["plan", "plan", "walk", "walk", "plan"]);
  assert.equal(c[0].camera.mode, "orbit");
  assert.equal(c[0].camera.x, PLACE_VIEW.x);
  assert.ok(c[0].camera.tilt_deg >= 55 && c[0].camera.tilt_deg <= 60);
  assert.equal(c[0].camera.turn, true);
  assert.equal(stepConfig(1, { ...facts, renderer: "2d" }).camera.turn, false, "no slow turn in 2D");
  assert.deepEqual(c[0].overlays, { route: false, marks: false, legs: false });
  assert.ok(c[0].layers.off.includes("stations") && c[0].layers.off.includes("no_go"));
  assert.equal(c[1].camera.mode, "fit");
  assert.deepEqual(c[1].overlays, { route: true, marks: true, legs: false }, "leg labels off on the plan step");
  assert.equal(c[1].chips, true);
  assert.deepEqual(c[2].walk, { t: 0, hazard: false, playing: true, speed: 60 });
  assert.equal(c[2].minimap, true);
  assert.equal(c[3].walk.t, "hazard");
  assert.equal(c[3].walk.hazard, true);
  assert.ok(c[4].layers.on.includes("rover_path"));
  assert.deepEqual(c.map((x) => x.caption.next_label), ["See the plan", "Start the walk", "Go to the hazard", "See the rover check", null]);
  assert.deepEqual(c.map((x) => x.caption.bar), [false, false, true, true, false]);
  assert.equal(c[4].caption.end, true);
  for (const x of c) assert.ok(x.caption.numbers.length <= 4, `step ${x.step} has at most four key numbers`);
  // narrow screens: steps 2 and 5 have one short sentence, no digits in it
  for (const x of [c[1], c[4]]) {
    assert.equal(x.caption.short.length, 1);
    assert.ok(typeof x.caption.short[0] === "string" && !/\d/.test(x.caption.short[0]) && x.caption.short[0].split(". ").length === 1);
  }
  assert.ok(c[0].caption.numbers.length <= 2);
  assert.ok(c[4].caption.numbers.length <= 3);
  assert.equal(c[0].caption.headline, "The boxwork ridges of Mount Sharp");
  assert.equal(c[1].caption.headline, "One walk, eight stations");
  assert.equal(c[4].caption.headline, "Checked against Curiosity");
});

test("stepConfig captions: plain text, numbers as specs with provenance, the event date in words", () => {
  const facts = { renderer: "3d", plan: planFacts(okPlan()), rover: { n: 65, under_pct: 92, median_deg: 2.8 }, sep_date: "2025-05-13T18:14Z", core_m: 1024 };
  for (const n of [1, 2, 3, 4, 5]) {
    const cfg = stepConfig(n, facts);
    for (const p of cfg.caption.text) {
      if (typeof p === "string") assert.ok(!/\d/.test(p), `no bare digit in step ${n}: ${p}`);
      else if ("value" in p) assert.ok(p.prov && p.unit !== undefined, "a number spec carries its unit and provenance");
    }
    for (const k of cfg.caption.numbers) assert.ok(["measured", "source", "derived", "assumption", "scenario"].includes(k.prov));
    assert.ok(!/placeholder/i.test(JSON.stringify(cfg.caption)));
    assert.ok(!JSON.stringify(cfg.caption).includes(String.fromCharCode(0x2014)), "no long dash");
  }
  const plan = stepConfig(2, facts).caption.numbers;
  assert.deepEqual(plan.map((n) => n.id), ["distance", "time", "steepest", "limits"]);
  assert.equal(plan[0].value, 1.677);
  assert.equal(plan[3].value, "5 of 5");
  assert.equal(plan[3].detail.count, true);
  assert.deepEqual(plan[3].sub, ["one at the limit"]);
  const hazard = stepConfig(4, facts).caption.text;
  assert.ok(hazard.some((p) => p && p.words === "13 May 2025"));
  assert.match(hazard.filter((p) => typeof p === "string").join(""), /Arrival at Mars is not claimed/);
  // While the route is being planned the plan step says so and shows no numbers.
  const waiting = stepConfig(2, { plan: planFacts({ status: "planning" }) });
  assert.equal(waiting.caption.numbers.length, 0);
  assert.match(waiting.caption.text.join(""), /Planning the route/);
  assert.match(stepConfig(2, { plan: planFacts({ status: "no_route" }) }).caption.text.join(""), /No route/);
});

test("planFacts counts the limits the route keeps and those at the limit", () => {
  const f = planFacts(okPlan());
  assert.equal(f.limits_total, 5);
  assert.equal(f.limits_kept, 5);
  assert.equal(f.at_limit, 1);
  assert.equal(f.steepest_deg, 15);
  assert.equal(planFacts(null).limits_kept, null);
  assert.equal(countWord(1), "one");
  assert.equal(countWord(42), null);
  assert.equal(dateWords("2025-05-13T18:14Z"), "13 May 2025");
  assert.equal(dateWords("bogus"), null);
});

test("address mapping: ?step wins; the older options map onto steps; no option is step 1", () => {
  const start = (q) => storyStart(parseUrlOptions(q));
  assert.equal(start("").step, 1);
  assert.equal(start("?step=4").step, 4);
  assert.equal(start("?step=9").step, 1, "an unknown step falls back");
  assert.equal(start("?view=walk").step, 3);
  assert.deepEqual([start("?view=walk&t=900").step, start("?view=walk&t=900").t], [3, 900]);
  assert.equal(start("?t=900").step, 3);
  assert.equal(start("?hazard=1").step, 4);
  assert.equal(start("?panel=limits").step, 2);
  assert.equal(start("?panel=limits").drawer, true);
  assert.equal(start("?panel=rover").step, 5);
  assert.equal(start("?sheet=route-card").step, 2);
  assert.equal(start("?step=2&view=walk").step, 2, "?step wins");
  assert.equal(start("?step=2&t=900").t, null, "a time only belongs to the walk steps");
  assert.equal(start("?view=2d").step, 1);
  assert.equal(stateFromOptions(parseUrlOptions("?view=2d")).renderer, "2d");
  assert.equal(stepSearch("?view=walk&t=900&layer=slope", 2, false), "?layer=slope&step=2");
  assert.equal(stepSearch("?view=2d", 3, true), "?view=2d&step=3&sources=1");
});

test("the sources switch: off by default, ?sources=1 turns it on", () => {
  assert.equal(parseUrlOptions("").showSources, false);
  assert.equal(parseUrlOptions("?sources=1").showSources, true);
  assert.equal(stateFromOptions(parseUrlOptions("?sources=1")).showSources, true);
  assert.equal(initialState().showSources, false);
  assert.equal(storyStart(parseUrlOptions("?sources=1")).showSources, true);
});

test("overlay flags: the step decides; exploring shows everything with leg labels; the editor tab shows the marks", () => {
  assert.deepEqual(overlayFlags({ step: 1 }), { route: false, marks: false, legs: false });
  assert.deepEqual(overlayFlags({ step: 2 }), { route: true, marks: true, legs: false });
  assert.deepEqual(overlayFlags({ step: 1, explore: true }), { route: true, marks: true, legs: true });
  assert.deepEqual(overlayFlags({ step: 1, drawer: true, panel: "editor" }), { route: true, marks: true, legs: false });
  assert.deepEqual(applyLayers(["image", "slope", "stations"], { on: ["image", "no_go"], off: ["stations"] }), ["image", "slope", "no_go"]);
});

// ---------------------------------------------------------------- the controller runs the story

const N = 40;
const scene = {
  core: { size_m: N, dem_samples: N + 1, slope_cells: N },
  surround: { size_m: 2 * N, dem_samples: N + 1 },
  height: { offset_m: -100, scale_m: 0.01, nodata: 65535 },
  slope: { scale_deg: 0.25, nodata: 255 },
  ground_scale: { x: 1, y: 1 },
};
function terrain() {
  const s = N + 1;
  const core = new Uint16Array(s * s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) core[j * s + i] = Math.round((0.05 * i + 100) / 0.01);
  return createTerrain(scene, { core, surround: new Uint16Array(s * s).fill(10000), slope: new Uint8Array(N * N) });
}
const P = (value) => ({ value, placeholder: false });
function inputs() {
  const st = (id, x, y, kind) => ({ id, x, y, kind, on_path: false, task: `Task ${id}`, photo: null, placeholder: { position: false, kind: false, task: false } });
  return {
    placeholder: false, signed_off_by: null, base: { x: -15.5, y: 0.5, label: "Crew rover", assumption: true },
    walking_speed_m_s: P(1), work_time_min_per_station: P(1), partner_trail_m: P(20), hazard_start_min: P(1), start_lmst_hour: P(9),
    stations: [st(1, 10.5, 10.5, "ridge"), st(2, 10.5, -10.5, "hollow")], no_go: [], drill_sites: [],
  };
}
function fakeClock() {
  let now = 0;
  let id = 0;
  const queue = new Map();
  return {
    now: () => now,
    frame(fn) {
      queue.set(++id, fn);
      return id;
    },
    cancel(i) {
      queue.delete(i);
    },
    advance(ms) {
      now += ms;
      const fns = [...queue.values()];
      queue.clear();
      for (const fn of fns) fn(now);
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};
function setup({ kind = "3d", reduced = false, plannerFactory = directPlanner } = {}) {
  const calls = { fly: [], rotate: [], fit: 0, view: [] };
  const host = {
    kind,
    setView: (v) => calls.view.push(v),
    setEye() {},
    flyTo: (x, y, o) => calls.fly.push({ x, y, ...o }),
    rotateBy: (d) => calls.rotate.push(d),
    fitBounds: () => calls.fit++,
  };
  const store = createStore({ ...initialState(), inputs: inputs() });
  const clock = fakeClock();
  const fit = () => {
    calls.fit++;
    return true;
  };
  const said = [];
  const ctl = createController({
    store, host, terrain: terrain(), clock, plannerFactory, fit, announce: (t) => said.push(t),
    motion: { reduced: () => reduced, hidden: () => false },
    data: { scene, inputs: inputs(), dose: { fallback: { value: 0.21 }, dose_equivalent_rate: { value: 0.64 } }, sep: { sepID: "x" }, conditions: { hours: [] } },
  });
  return { store, host, calls, clock, ctl, a: ctl.actions, s: () => store.getState(), said };
}

test("controller: step 1 centres the ridges in the free area; a layout change fits again unless the map was moved", async () => {
  const offsets = [];
  const pans = [];
  let cam = { x: 0, y: 0, zoom_px_per_m: 1, heading_deg: 0, tilt_deg: 0 };
  const area = { insets: { top: 55, right: 68, bottom: 26, left: 428 }, w: 1366, h: 768 };
  const make = (kind) => {
    const store = createStore({ ...initialState(), inputs: inputs() });
    let fits = 0;
    const host = {
      kind, setView() {}, setEye() {}, flyTo() {}, rotateBy() {},
      setCentreOffset: (dx, dy) => offsets.push([dx, dy]), panBy: (dx, dy) => pans.push([dx, dy]), getCamera: () => cam,
    };
    const ctl = createController({
      store, host, terrain: terrain(), clock: fakeClock(), plannerFactory: directPlanner, fit: () => { fits++; return true; }, freeArea: () => area,
      motion: { reduced: () => false, hidden: () => false },
      data: { scene, inputs: inputs(), dose: { fallback: { value: 0.21 }, dose_equivalent_rate: { value: 0.64 } }, sep: { sepID: "x" }, conditions: { hours: [] } },
    });
    return { ctl, store, fits: () => fits };
  };
  const e = make("3d");
  await e.ctl.applyStartOptions({});
  assert.deepEqual(offsets.at(-1), [180, 14.5], "the orbit centre sits in the middle of the free area");
  area.insets = { ...area.insets, left: 0 };
  e.ctl.actions.relayout();
  assert.deepEqual(offsets.at(-1), [-34, 14.5], "a layout change moves it with the chrome");
  await e.ctl.actions.replan();
  e.ctl.actions.gotoStep(2);
  const n = e.fits();
  assert.ok(n >= 1);
  e.ctl.actions.relayout();
  assert.equal(e.fits(), n + 1, "unchanged camera: the route is fitted again");
  cam = { ...cam, x: 50 };
  e.ctl.actions.relayout();
  assert.equal(e.fits(), n + 1, "moved by hand: the view stays");
  e.ctl.actions.fitRoute();
  e.ctl.actions.relayout();
  assert.equal(e.fits(), n + 3, "the fit route control counts as a fit");
  // 2D: no view offset, the map is moved instead
  const d = make("2d");
  await d.ctl.applyStartOptions({});
  assert.deepEqual(pans.at(-1), [34, -14.5]);
});

test("controller: step 1 opens tilted on the ridges and turns slowly until any input stops it", async () => {
  const env = setup();
  await env.ctl.applyStartOptions({});
  assert.equal(env.s().step, 1);
  assert.equal(env.calls.fly.length, 1);
  assert.equal(env.calls.fly[0].tilt_deg, PLACE_VIEW.tilt_deg);
  env.clock.advance(16);
  env.clock.advance(1000 / 60);
  assert.ok(env.calls.rotate.length >= 1);
  const per = env.calls.rotate.at(-1);
  assert.ok(Math.abs(per - (360 / TURN_S) / 60) < 1e-6, "one turn in TURN_S seconds");
  env.a.stopTurn();
  const n = env.calls.rotate.length;
  env.clock.advance(16);
  assert.equal(env.calls.rotate.length, n, "stopped for good");
  // reduced motion and the 2D view never turn
  for (const opt of [{ reduced: true }, { kind: "2d" }]) {
    const e = setup(opt);
    await e.ctl.applyStartOptions({});
    e.clock.advance(16);
    e.clock.advance(16);
    assert.equal(e.calls.rotate.length, 0, JSON.stringify(opt));
  }
});

test("controller: Next walks the story; the walk plays at 60x, the hazard step fires the scenario, the check is a plan view", async () => {
  const env = setup();
  await env.ctl.applyStartOptions({});
  await env.a.replan();
  await flush();
  assert.equal(env.s().plan.status, "ok");
  env.a.nextStep();
  assert.equal(env.s().step, 2);
  assert.equal(env.s().view, "plan");
  assert.ok(env.calls.fit >= 1, "the plan step fits the route");
  assert.ok(env.s().layers.includes("stations") && env.s().layers.includes("no_go"));
  env.a.setSpeed(10);
  env.a.nextStep();
  assert.equal(env.s().step, 3);
  assert.equal(env.s().view, "walk");
  assert.equal(env.s().walk.playing, true);
  assert.equal(env.s().walk.speed, 60);
  assert.equal(env.s().walk.t_s, 0);
  env.a.nextStep();
  await flush();
  assert.equal(env.s().step, 4);
  assert.equal(env.s().view, "walk");
  assert.equal(env.s().walk.hazard.active, true);
  assert.ok(env.s().walk.held.some((h) => h.level === "return"), "RETURN NOW is held until acknowledged");
  assert.equal(env.s().walk.playing, false);
  env.a.nextStep();
  assert.equal(env.s().step, 5);
  assert.equal(env.s().view, "plan");
  assert.ok(env.s().layers.includes("rover_path"));
  env.a.nextStep();
  assert.equal(env.s().step, 5, "Next stops at the last step");
  env.a.prevStep();
  assert.equal(env.s().step, 4);
  env.a.gotoStep(3);
  assert.equal(env.s().walk.t_s, 0, "back to the walk starts it again");
  assert.ok(env.said.some((t) => /Step 3 of 5/.test(t)), "each step is announced");
});

test("controller: a walk step asked before the route waits for it; ?t pauses the walk at that time", async () => {
  const env = setup();
  await env.ctl.applyStartOptions({ step: 3, t: 20 });
  assert.equal(env.s().view, "plan", "no walk before the route");
  await env.a.replan();
  await flush();
  assert.equal(env.s().view, "walk");
  assert.equal(env.s().walk.t_s, 20);
  assert.equal(env.s().walk.playing, false);
});

test("controller: explore freely opens the drawer and leaves the walk; the sources switch and the picked station", async () => {
  const env = setup();
  await env.ctl.applyStartOptions({ step: 3 });
  await env.a.replan();
  await flush();
  env.a.setExplore(true);
  assert.equal(env.s().explore, true);
  assert.equal(env.s().drawer, true);
  assert.equal(env.s().view, "plan");
  env.a.setExplore(false);
  assert.equal(env.s().explore, false);
  assert.equal(env.s().view, "walk", "back to the story at the same step");
  env.a.setSources(true);
  assert.equal(env.s().showSources, true);
  env.a.setSources(false);
  assert.equal(env.s().showSources, false);
  env.a.gotoStep(2);
  env.a.pickStation(2);
  assert.equal(env.s().picked, 2);
  env.a.gotoStep(5);
  assert.equal(env.s().picked, null, "a step change closes the station card");
  env.a.setPanel("credits");
  assert.equal(env.s().drawer, true);
  env.a.setDrawer(false);
  assert.equal(env.s().drawer, false);
});

// ---------------------------------------------------------------- review 3 fixes

// A planner whose return plans wait until release() runs them.
function heldPlanner() {
  const held = [];
  const factory = () => {
    const d = directPlanner();
    return {
      run: (type, p) => (type === "plan" ? d.run(type, p) : new Promise((res, rej) => held.push(() => d.run(type, p).then(res, rej)))),
      dispose() {},
    };
  };
  const release = () => {
    while (held.length) held.shift()();
  };
  return { factory, held, release };
}

test("controller: a plan step keeps nothing of the walk (no way back, no walked trail, no held alert)", async () => {
  const env = setup();
  await env.a.replan();
  await flush();
  env.a.gotoStep(4);
  await flush();
  assert.ok(env.s().walk.return_leg, "the hazard step plans the way back");
  assert.ok(env.s().walk.held.some((h) => h.id === "return"));
  env.a.gotoStep(5);
  assert.equal(env.s().view, "plan");
  assert.equal(env.s().walk.return_leg, null);
  assert.deepEqual(env.s().walk.held, []);
  assert.equal(env.s().walk.t_s, 0);
  assert.equal(env.s().walk.hazard.active, false);
  // Back from the walk to the plan: the walked trail goes too
  env.a.gotoStep(3);
  env.clock.advance(16);
  env.clock.advance(500);
  assert.ok(env.s().walk.t_s > 0);
  env.a.gotoStep(2);
  assert.equal(env.s().walk.t_s, 0);
  env.a.gotoStep(3);
  assert.equal(env.s().walk.t_s, 0, "the walk starts again at the start");
  assert.equal(env.s().walk.playing, true);
});

test("controller: Back from the hazard while the way back is still planned never fires the hazard in the walk step", async () => {
  const p = heldPlanner();
  const env = setup({ plannerFactory: p.factory });
  await env.a.replan();
  await flush();
  env.a.gotoStep(4);
  await flush();
  assert.equal(env.s().walk.pending, true);
  assert.ok(p.held.length >= 1);
  env.a.prevStep();
  assert.equal(env.s().step, 3);
  assert.equal(env.s().walk.pending, false);
  p.release();
  await flush();
  p.release();
  await flush();
  const w = env.s().walk;
  assert.equal(env.s().step, 3);
  assert.equal(w.hazard.active, false, "the stale return plan is dropped");
  assert.equal(w.return_leg, null);
  assert.ok(w.t_s < 60, `the walk did not jump to the hazard start (t ${w.t_s})`);
  assert.ok(!w.held.some((h) => h.id === "return"));
  assert.equal(w.playing, true);
});

test("controller: step 3 walks past the hazard start to the end with no hazard; step 4 still fires it", async () => {
  const p = heldPlanner();
  const env = setup({ plannerFactory: p.factory });
  await env.a.replan();
  await flush();
  env.a.gotoStep(3);
  env.a.setSpeed(240);
  for (let i = 0; i < 400 && env.s().walk.playing; i++) env.clock.advance(1000);
  await flush();
  const w = env.s().walk;
  assert.equal(p.held.length, 0, "no return plan was asked for");
  assert.equal(w.hazard.active, false);
  assert.ok(!w.held.some((h) => h.id === "return"));
  assert.equal(w.playing, false);
  assert.ok(Math.abs(w.t_s - env.ctl.timeline.duration_s) < 1e-6, "the walk ran to its end");
  assert.equal(env.s().walk.snapshot.mode, "done");
  env.a.gotoStep(4);
  await flush();
  p.release();
  await flush();
  assert.equal(env.s().walk.hazard.active, true);
  assert.ok(env.s().walk.held.some((h) => h.id === "return"));
});

test("controller: an old walk link with a time at or past the hazard start opens the hazard step; past the end it clamps", async () => {
  const late = setup();
  await late.a.replan();
  await flush();
  await late.ctl.applyStartOptions({ view: "walk", t: 999999 });
  await flush();
  assert.equal(late.s().step, 4);
  assert.equal(late.s().walk.hazard.active, true);
  assert.ok(late.s().walk.t_s <= late.ctl.timeline.duration_s + 1e-6);
  const early = setup();
  await early.a.replan();
  await flush();
  await early.ctl.applyStartOptions({ view: "walk", t: 30 });
  await flush();
  assert.equal(early.s().step, 3);
  assert.equal(early.s().walk.t_s, 30);
  assert.equal(early.s().walk.hazard.active, false);
  // pure mapping; ?step still wins
  const at = (q) => storyStart(parseUrlOptions(q), { hazard_s: 9000 }).step;
  assert.equal(at("?view=walk&t=9000"), 4);
  assert.equal(at("?view=walk&t=8999"), 3);
  assert.equal(at("?t=9500"), 4);
  assert.equal(at("?step=3&t=9500"), 3);
  assert.equal(storyStart(parseUrlOptions("?view=walk&t=9500")).step, 3, "no hazard time known: the walk step");
});

test("controller: the step 1 turn stops for good after an input; Back to step 1 never starts it again", async () => {
  const env = setup();
  await env.ctl.applyStartOptions({});
  await env.a.replan();
  await flush();
  env.clock.advance(16);
  env.clock.advance(16);
  assert.ok(env.calls.rotate.length > 0);
  env.a.stopTurn();
  env.a.gotoStep(2);
  env.a.gotoStep(1);
  const n = env.calls.rotate.length;
  env.clock.advance(16);
  env.clock.advance(16);
  assert.equal(env.calls.rotate.length, n);
  // a step change alone (no input) does not end it for good
  const other = setup();
  await other.ctl.applyStartOptions({});
  await other.a.replan();
  await flush();
  other.a.gotoStep(2);
  other.a.gotoStep(1);
  other.clock.advance(16);
  other.clock.advance(16);
  assert.ok(other.calls.rotate.length > 0);
});

test("controller: 2D step 1 is placed again after a layout change unless the map was moved", async () => {
  let cam = { x: 0, y: 0, zoom_px_per_m: 1, heading_deg: 0, tilt_deg: 0 };
  let flies = 0;
  const area = { insets: { top: 55, right: 68, bottom: 26, left: 428 }, w: 1366, h: 768 };
  const store = createStore({ ...initialState(), inputs: inputs() });
  const host = { kind: "2d", setView() {}, setEye() {}, flyTo: () => flies++, panBy() {}, getCamera: () => cam };
  const ctl = createController({
    store, host, terrain: terrain(), clock: fakeClock(), plannerFactory: directPlanner, fit: () => true, freeArea: () => area,
    motion: { reduced: () => false, hidden: () => false },
    data: { scene, inputs: inputs(), dose: { fallback: { value: 0.21 }, dose_equivalent_rate: { value: 0.64 } }, sep: { sepID: "x" }, conditions: { hours: [] } },
  });
  await ctl.applyStartOptions({});
  assert.equal(flies, 1);
  ctl.actions.relayout();
  assert.equal(flies, 2, "the chrome came in: step 1 is centred again");
  cam = { ...cam, x: 40 };
  ctl.actions.relayout();
  assert.equal(flies, 2, "moved by hand: the view stays");
});

test("plan caption: the headline and the pairs line follow the stations; the committed walk keeps its words", () => {
  const plan = planFacts(okPlan());
  const eight = stepConfig(2, { plan, stations: { total: 8, pairs: 4 } }).caption;
  assert.equal(eight.headline, "One walk, eight stations");
  assert.deepEqual(eight.text, ["Four ridge and hollow pairs. The route stays at or under the slope limit and out of the no-go zones."]);
  assert.deepEqual(eight.short, ["Four ridge and hollow pairs."]);
  const three = stepConfig(2, { plan, stations: { total: 3, pairs: 1 } }).caption;
  assert.equal(three.headline, "One walk, three stations");
  assert.match(three.text[0], /^One ridge and hollow pair\. /);
  const one = stepConfig(2, { plan, stations: { total: 1, pairs: 0 } }).caption;
  assert.equal(one.headline, "One walk, one station");
  assert.equal(one.text[0], "The route stays at or under the slope limit and out of the no-go zones.");
  const many = stepConfig(2, { plan, stations: { total: 14, pairs: 12 } }).caption;
  assert.ok(!/\d/.test(many.headline + many.text.join("")), "counts in words, never digits");
  assert.deepEqual(stationCounts({ stations: [{ kind: "ridge" }, { kind: "hollow" }, { kind: "ridge" }] }), { total: 3, pairs: 1 });
  assert.equal(stationCounts(null), null);
});

test("address: the panel stays in the address only while the drawer is open", () => {
  assert.equal(stepSearch("?panel=editor", 2, false), "?step=2");
  assert.equal(stepSearch("?panel=editor", 2, false, "editor"), "?step=2&panel=editor");
  assert.equal(stepSearch("?panel=editor&layer=slope", 2, false, "limits"), "?layer=slope&step=2&panel=limits");
  assert.equal(storyStart(parseUrlOptions(stepSearch("?view=walk", 2, false, "rover"))).step, 2, "the step still wins on reload");
});

test("check step: the rover facts need no route; with no rover numbers there is no agreement claim", () => {
  const ctx = { data: { waypoints: { waypoints: [{ sol: 1, x: 4, y: 0, tilt_deg: 5, in_campaign: true }] } }, terrain: { slope: true, slopeAt: (x) => x } };
  const f = factsFor({ plan: { status: "planning" }, inputs: null }, ctx, { rover: undefined });
  assert.equal(f.rover.n, 1, "computed while the route is still planned");
  const notYet = factsFor({ plan: { status: "ok" }, inputs: null }, { ...ctx, terrain: { slope: null, slopeAt: () => null } }, { rover: undefined });
  assert.equal(notYet.rover, null, "waits for the slope grid");
  const none = stepConfig(5, { plan: planFacts(null), rover: null }).caption;
  const words = none.text.filter((p) => typeof p === "string").join("");
  assert.ok(!/agrees/.test(words));
  assert.ok(none.text.some((p) => p && p.nodata), "a NO DATA mark in its place");
  assert.ok(!/agrees/.test(none.short.filter((p) => typeof p === "string").join("")));
  assert.equal(none.numbers.length, 0);
  const some = stepConfig(5, { plan: planFacts(null), rover: { n: 65, under_pct: 92, median_deg: 2.8 } }).caption;
  assert.match(some.text.filter((p) => typeof p === "string").join(""), /agrees with our slope map/);
});
