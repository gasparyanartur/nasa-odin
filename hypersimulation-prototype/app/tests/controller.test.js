// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The controller against a 40 m synthetic terrain, a fake view host, a hand-driven clock and the planner run directly.
import test from "node:test";
import assert from "node:assert/strict";
import { createController, directPlanner, gridPayload, scheduleOf } from "../src/controller.js";
import { createStore, initialState } from "../src/state.js";
import { createTerrain } from "../src/terrain.js";

const N = 40;
const scene = {
  core: { size_m: N, dem_samples: N + 1, slope_cells: N },
  surround: { size_m: 2 * N, dem_samples: N + 1 },
  height: { offset_m: -100, scale_m: 0.01, nodata: 65535 },
  slope: { scale_deg: 0.25, nodata: 255 },
  ground_scale: { x: 1, y: 1 },
};

function makeTerrain(slopeFn = () => 0) {
  const slope = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) slope[j * N + i] = Math.round(slopeFn(i, j) / 0.25);
  const s = N + 1;
  const core = new Uint16Array(s * s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) core[j * s + i] = Math.round((0.05 * i + 100) / 0.01);
  const surround = new Uint16Array(s * s).fill(10000);
  return createTerrain(scene, { core, surround, slope });
}

function station(id, x, y, kind = "ridge") {
  return { id, x, y, kind, on_path: false, task: `Task ${id}`, photo: null, placeholder: { position: false, kind: false, task: false } };
}

function makeInputs(over = {}) {
  const p = (value) => ({ value, placeholder: false });
  return {
    placeholder: false, signed_off_by: null,
    base: { x: -15.5, y: 0.5, label: "Crew rover", assumption: true },
    walking_speed_m_s: p(1), work_time_min_per_station: p(1), partner_trail_m: p(20),
    hazard_start_min: p(600), start_lmst_hour: p(9),
    stations: [station(1, 10.5, 10.5), station(2, 10.5, -10.5, "hollow")],
    no_go: [], drill_sites: [],
    ...over,
  };
}

function fakeHost() {
  const calls = { view: [], eye: [], imagery: [] };
  return {
    calls,
    setView: (v) => calls.view.push(v),
    setEye: (e) => calls.eye.push(e),
    setImagery: (m) => {
      calls.imagery.push(m);
      return Promise.resolve(true);
    },
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
    get pending() {
      return queue.size;
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

const dose = { sol: 4600, dose_rate: { value: null }, fallback: { value: 0.21, unit: "mGy/day" }, dose_equivalent_rate: { value: 0.64 } };
const sep = { sepID: "2025-05-13T18:14:00-SEP-001", eventTime: "2025-05-13T18:14Z", note: "Measured near Earth." };

function setup({ inputs = makeInputs(), slopeFn, terrain } = {}) {
  const store = createStore({ ...initialState(), inputs });
  const host = fakeHost();
  const clock = fakeClock();
  const t = terrain || makeTerrain(slopeFn);
  const ctl = createController({
    store, host, terrain: t, clock, plannerFactory: directPlanner, defaults: makeInputs(), maxFrameS: 5,
    data: { scene, inputs, dose, sep, conditions: { hours: [] } },
  });
  return { store, host, clock, ctl, a: ctl.actions, s: () => store.getState() };
}

async function walkToEnd(env, { ackCards = true, limit = 400 } = {}) {
  const seen = [];
  for (let i = 0; i < limit; i++) {
    const w = env.s().walk;
    if (w.snapshot && w.snapshot.mode === "done" && !w.playing) break;
    if (w.card !== null && ackCards) {
      seen.push(w.card);
      env.a.acknowledge();
    }
    env.clock.advance(1000);
    await flush();
  }
  return seen;
}

test("gridPayload carries the slope and height grids with their scales", () => {
  const t = makeTerrain();
  const g = gridPayload(t, scene);
  assert.equal(g.cells, N);
  assert.equal(g.samples, N + 1);
  assert.equal(g.slope, t.slope);
  assert.equal(g.height_nodata, 65535);
  assert.equal(gridPayload(createTerrain(scene, {}), scene), null);
});

test("a route is planned on a small synthetic terrain, with limits, profile and timeline score", async () => {
  const env = setup();
  await env.a.replan();
  const p = env.s().plan;
  assert.equal(p.status, "ok");
  assert.equal(p.route.legs.length, 3);
  assert.equal(p.route.legs[2].to.id, "base");
  assert.ok(p.constraints.some((r) => r.id === "slope_cap" && r.pass === true));
  assert.ok(p.profile.points.length > 10);
  const kinds = p.schedule.blocks.map((b) => b.kind);
  assert.deepEqual(kinds, ["walk", "work", "walk", "work", "walk"]);
  assert.deepEqual(p.schedule.blocks.filter((b) => b.kind === "work").map((b) => b.station_id), [1, 2]);
  assert.equal(p.schedule.hazard_start_s, 36000);
  assert.equal(env.s().walk.snapshot.mode, "walk");
});

test("before the slope grid arrives the plan waits in the planning state", async () => {
  const store = createStore({ ...initialState(), inputs: makeInputs() });
  const terrain = createTerrain(scene, {});
  const ctl = createController({ store, host: fakeHost(), terrain, clock: fakeClock(), plannerFactory: directPlanner, data: { scene, dose, sep, conditions: { hours: [] } } });
  assert.equal(store.getState().plan.status, "planning");
  assert.equal(store.getState().plan.waiting, true);
  const full = makeTerrain();
  terrain.setCore(full.core, full.slope);
  await ctl.actions.replan();
  assert.equal(store.getState().plan.status, "ok");
});

test("no route: a station inside a no-go zone names the limit and the station", async () => {
  const inputs = makeInputs({ no_go: [{ id: "z1", label: "Zone", polygon: [[8, 8], [13, 8], [13, 13], [8, 13]], placeholder: false }] });
  const env = setup({ inputs });
  await env.a.replan();
  const p = env.s().plan;
  assert.equal(p.status, "no_route");
  assert.equal(p.blocking.limit, "no_go");
  assert.equal(p.blocking.station_id, 1);
  assert.equal(p.route, null);
  assert.equal(env.a.enterWalk(), false);
});

test("no route: a closed wall steeper than the cap blocks the station behind it", async () => {
  const wall = (i, j) => (i === 30 ? 20 : 0);
  const env = setup({ slopeFn: wall });
  await env.a.replan();
  assert.equal(env.s().plan.status, "no_route");
  assert.equal(env.s().plan.blocking.limit, "slope_cap");
});

test("zero stations: the plan is empty, not a route", async () => {
  const env = setup({ inputs: makeInputs({ stations: [] }) });
  await env.a.replan();
  assert.equal(env.s().plan.status, "idle");
  assert.equal(env.s().plan.empty, true);
});

test("the walk reaches each station, opens its card, keeps walking through the work time, and ends at base", async () => {
  const env = setup();
  await env.a.replan();
  env.a.setSpeed(10);
  assert.equal(env.a.enterWalk({ play: true }), true);
  assert.equal(env.s().view, "walk");
  assert.deepEqual(env.host.calls.view, ["walk"]);
  // runs until the first arrival: the card opens and the clock keeps running (nothing is acknowledged for the crew)
  for (let i = 0; i < 20 && env.s().walk.card === null; i++) env.clock.advance(1000);
  const w = env.s().walk;
  assert.equal(w.card, 1);
  assert.equal(w.playing, true);
  assert.equal(w.snapshot.mode, "work");
  const t0 = w.t_s;
  env.clock.advance(1000);
  assert.ok(env.s().walk.t_s > t0, "the clock runs on with the card open");
  // the card closes by itself when the walker leaves the station
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const now = env.s().walk;
    if (now.card !== null) seen.add(now.card);
    if (now.snapshot && now.snapshot.mode === "done" && !now.playing) break;
    if (now.snapshot && now.snapshot.mode === "walk" && now.snapshot.next_station === 2) assert.equal(now.card, null);
    env.clock.advance(1000);
    await flush();
  }
  assert.deepEqual([...seen], [1, 2]);
  const end = env.s().walk;
  assert.equal(end.snapshot.mode, "done");
  assert.equal(end.playing, false);
  assert.ok(Math.hypot(end.snapshot.pos.x + 15.5, end.snapshot.pos.y - 0.5) < 1e-6);
  assert.ok(env.host.calls.eye.length > 5);
  env.a.exitWalk();
  assert.equal(env.s().view, "plan");
  assert.equal(env.s().walk.active, false);
});

test("a paused walk stays paused on arrival; Acknowledge closes the card early", async () => {
  const env = setup();
  await env.a.replan();
  env.a.enterWalk();
  await env.a.next();
  assert.equal(env.s().walk.card, 1);
  assert.equal(env.s().walk.playing, false);
  env.a.acknowledge();
  assert.equal(env.s().walk.card, null);
});

test("next() jumps from event to event and opens the card on arrival", async () => {
  const env = setup();
  await env.a.replan();
  env.a.enterWalk();
  await env.a.next();
  assert.equal(env.s().walk.card, 1);
  assert.equal(env.s().walk.snapshot.at_station, 1);
  await env.a.next();
  assert.equal(env.s().walk.card, null);
  assert.equal(env.s().walk.snapshot.mode, "walk");
  assert.equal(env.s().walk.snapshot.next_station, 2);
});

test("the hazard start produces a held return alert and a return path that ends at base", async () => {
  const env = setup({ inputs: makeInputs({ hazard_start_min: { value: 0.5, placeholder: false } }) });
  await env.a.replan();
  env.a.setSpeed(10);
  env.a.enterWalk({ play: true });
  await walkToEnd(env);
  const w = env.s().walk;
  assert.ok(w.held.some((h) => h.id === "return" && h.level === "return"), "return alert held");
  assert.equal(w.hazard.active, true);
  assert.equal(w.hazard.level, "return");
  assert.ok(w.return_leg && w.return_leg.to.id === "base");
  assert.equal(w.return_from.t_s, 30);
  assert.equal(w.schedule.blocks.at(-1).kind, "return");
  assert.equal(w.snapshot.mode, "done");
  assert.ok(Math.hypot(w.snapshot.pos.x + 15.5, w.snapshot.pos.y - 0.5) < 1e-6);
  // held until acknowledged
  env.clock.advance(1000);
  assert.ok(env.s().walk.held.some((h) => h.id === "return"));
  env.a.acknowledge();
  assert.ok(!env.s().walk.held.some((h) => h.id === "return"));
});

test("a hazard start of 0 min while playing ends the walk at base with the alert held, and does not restart it", async () => {
  const env = setup({ inputs: makeInputs({ hazard_start_min: { value: 0, placeholder: false } }) });
  await env.a.replan();
  env.a.enterWalk({ play: true });
  for (let i = 0; i < 5; i++) {
    env.clock.advance(16);
    await flush();
  }
  const w = env.s().walk;
  assert.equal(w.snapshot.mode, "done");
  assert.equal(w.playing, false);
  assert.equal(w.hazard.active, true);
  assert.ok(w.held.some((h) => h.id === "return"), "the return alert stays held");
});

test("at the end of the walk the partner spacing is still the input value, not missing", async () => {
  const env = setup();
  await env.a.replan();
  env.a.enterWalk();
  await env.a.seek(1e9);
  const s = env.s().walk.snapshot;
  assert.equal(s.mode, "done");
  assert.equal(s.dist_to_partner_m, 20);
});

test("startHazardScenario and returnToRover plan the return from the current position", async () => {
  const env = setup();
  await env.a.replan();
  env.a.enterWalk();
  await env.a.seek(10);
  await env.a.startHazardScenario();
  let w = env.s().walk;
  assert.equal(w.snapshot.mode, "return");
  assert.equal(w.hazard.active, true);
  assert.equal(w.held[0].id, "return");

  const env2 = setup();
  await env2.a.replan();
  env2.a.enterWalk();
  await env2.a.seek(10);
  await env2.a.returnToRover();
  w = env2.s().walk;
  assert.equal(w.snapshot.mode, "return");
  assert.equal(w.hazard.active, false, "a return on request is not the hazard");
  assert.equal(w.held.length, 0);
});

test("caution alerts are held once each and stay until acknowledged", async () => {
  const env = setup({ inputs: makeInputs({ partner_trail_m: { value: 90, placeholder: false } }) });
  await env.a.replan();
  let held = env.s().walk.held;
  assert.equal(held.length, 1);
  assert.equal(held[0].id, "partner");
  assert.equal(held[0].level, "caution");
  await env.a.seek(20);
  assert.equal(env.s().walk.held.length, 1);
  env.a.acknowledge();
  assert.equal(env.s().walk.held.length, 0);
  await env.a.seek(40);
  assert.equal(env.s().walk.held.length, 0, "fires once only");
});

test("acknowledge closes the open card first, then clears the oldest alert", async () => {
  const env = setup({ inputs: makeInputs({ partner_trail_m: { value: 90, placeholder: false } }) });
  await env.a.replan();
  env.a.enterWalk();
  await env.a.next();
  assert.equal(env.s().walk.card, 1);
  env.a.acknowledge();
  assert.equal(env.s().walk.card, null);
  assert.equal(env.s().walk.held.length, 1);
  env.a.acknowledge();
  assert.equal(env.s().walk.held.length, 0);
});

test("an inputs change replans; a bad edit is refused with the field named", async () => {
  const env = setup();
  await env.a.replan();
  const next = makeInputs();
  next.stations = [...next.stations, station(3, -5.5, -12.5)];
  const r = env.a.updateInputs(next);
  assert.equal(r.ok, true);
  assert.equal(env.s().plan.status, "planning");
  await r.done;
  assert.equal(env.s().plan.status, "ok");
  assert.equal(env.s().plan.route.legs.length, 4);
  const bad = makeInputs();
  bad.stations[0].kind = "peak";
  const rb = env.a.updateInputs(bad);
  assert.equal(rb.ok, false);
  assert.equal(rb.field, "stations[0].kind");
  assert.equal(env.s().inputs.stations.length, 3);
  await env.a.resetInputs().done;
  assert.equal(env.s().plan.route.legs.length, 3);
});

test("an edit is kept in browser storage; reset drops that copy so the file is read again next time", async () => {
  const kept = new Map();
  const storage = { setItem: (k, v) => kept.set(k, v), getItem: (k) => kept.get(k) ?? null, removeItem: (k) => kept.delete(k) };
  const inputs = makeInputs();
  const store = createStore({ ...initialState(), inputs });
  const ctl = createController({
    store, host: fakeHost(), terrain: makeTerrain(), clock: fakeClock(), plannerFactory: directPlanner, defaults: makeInputs(), storage,
    data: { scene, inputs, dose, sep, conditions: { hours: [] } },
  });
  const next = makeInputs();
  next.stations = next.stations.slice(0, 1);
  await ctl.actions.updateInputs(next).done;
  assert.equal(kept.size, 1);
  await ctl.actions.resetInputs().done;
  assert.equal(kept.size, 0);
  assert.equal(store.getState().inputs.stations.length, 2);
  assert.equal(store.getState().plan.status, "ok");
});

test("a stale plan result never overwrites a newer one", async () => {
  const env = setup();
  const first = env.a.replan();
  const next = makeInputs();
  next.stations = [station(1, 10.5, 10.5)];
  const second = env.a.updateInputs(next).done;
  await Promise.all([first, second]);
  assert.equal(env.s().plan.route.legs.length, 2);
});

test("URL start options: walk view, time, hazard and panel map onto the hazard step", async () => {
  const env = setup();
  const started = env.ctl.applyStartOptions({ view: "walk", t: 20, hazard: true, panel: "rover" });
  assert.equal(env.s().panel, "rover");
  assert.equal(env.s().drawer, true);
  assert.equal(env.s().step, 4);
  await env.a.replan();
  await started;
  await flush();
  const w = env.s().walk;
  assert.equal(env.s().view, "walk");
  assert.equal(w.active, true);
  assert.equal(w.t_s, 20);
  assert.equal(w.snapshot.mode, "return");
  assert.equal(w.hazard.active, true);
});

test("layers, panel, exaggeration and imagery actions", () => {
  const env = setup();
  env.a.setLayer("slope", true);
  assert.ok(env.s().layers.includes("slope"));
  env.a.setLayer("slope", false);
  assert.ok(!env.s().layers.includes("slope"));
  env.a.setLayer("bogus", true);
  assert.ok(!env.s().layers.includes("bogus"));
  env.a.setPanel("editor");
  assert.equal(env.s().panel, "editor");
  env.a.setPanel("nowhere");
  assert.equal(env.s().panel, "editor");
  env.a.setExaggeration(2);
  assert.equal(env.s().exaggeration, 2);
  env.a.setImagery("grey");
  assert.deepEqual(env.host.calls.imagery, ["grey"]);
  assert.equal(env.s().walk.speed, 60, "the replay starts at 60x");
  env.a.setSpeed(10);
  env.a.setSpeed(7);
  assert.equal(env.s().walk.speed, 10);
  env.a.setSpeed(240);
  assert.equal(env.s().walk.speed, 240);
  env.a.setSpeed(1);
  assert.equal(env.s().walk.speed, 240, "1x is no longer a choice");
});

test("scheduleOf turns timeline events into walk, work and return blocks", () => {
  const tl = {
    duration_s: 100, hazard_t_s: 50,
    events: [
      { type: "depart", station_id: "base", t_s: 0 }, { type: "arrive", station_id: 1, t_s: 20 },
      { type: "depart", station_id: 1, t_s: 40 }, { type: "hazard", station_id: null, t_s: 50 },
      { type: "arrive", station_id: "base", t_s: 100 },
    ],
  };
  const s = scheduleOf(tl, { hazard_start_min: { value: 2 } });
  assert.deepEqual(s.blocks.map((b) => [b.kind, b.t0, b.t1]), [["walk", 0, 20], ["work", 20, 40], ["walk", 40, 50], ["return", 50, 100]]);
  assert.equal(s.hazard_start_s, 120);
  assert.equal(s.hazard_t_s, 50);
});

test("the walk clock follows the wall clock: a slow frame source with stale timestamps only lowers the frame rate", async () => {
  const inputs = makeInputs();
  const store = createStore({ ...initialState(), inputs });
  let now = 0;
  let pending = null;
  const clock = { now: () => now, frame: (fn) => (pending = fn, 1), cancel: () => (pending = null) };
  const ctl = createController({
    store, host: fakeHost(), terrain: makeTerrain(), clock, plannerFactory: directPlanner, defaults: makeInputs(),
    data: { scene, inputs, dose, sep, conditions: { hours: [] } },
  });
  await ctl.actions.replan();
  assert.equal(store.getState().walk.speed, 60);
  ctl.actions.setSpeed(10);
  ctl.actions.play();
  // One frame every 3 s, and the frame source hands over a timestamp that never moves.
  now += 3000;
  const fn = pending;
  pending = null;
  fn(0);
  assert.equal(store.getState().walk.t_s, 30, "three seconds of wall clock at 10x");
  assert.ok(pending, "the next frame is asked for");
  ctl.dispose();
});

test("the eye heading eases in play, snaps on a seek, and finishes its ease when paused", async () => {
  const env = setup();
  await env.a.replan();
  env.a.enterWalk();
  const eyes = env.host.calls.eye;
  const first = eyes[eyes.length - 1].heading_deg;
  assert.ok(Number.isFinite(first));
  env.a.seek(100);
  const snapped = eyes[eyes.length - 1].heading_deg;
  env.a.setSpeed(60);
  env.a.play();
  let worst = 0;
  let prev = snapped;
  for (let i = 0; i < 200; i++) {
    env.clock.advance(16);
    const h = eyes[eyes.length - 1].heading_deg;
    worst = Math.max(worst, Math.abs(((h - prev + 540) % 360) - 180));
    prev = h;
    if (!env.s().walk.playing) break;
  }
  assert.ok(worst <= 150 * 0.016 + 1e-6, `worst ${worst}`);
  env.a.pause();
  for (let i = 0; i < 150; i++) env.clock.advance(16);
  assert.equal(env.clock.pending, 0, "the ease loop ends");
});
