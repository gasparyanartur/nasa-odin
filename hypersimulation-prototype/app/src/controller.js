// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The one controller behind every screen: plans the route (in a Web Worker), builds the limits, the profile and
// the timeline, runs the walk clock, fires the hazard and the caution alerts, and keeps the view in step.
// UI modules read the store and call the actions; nothing else writes state.plan or state.walk.
import { planRoute, planReturn } from "./planner.js";
import { buildConstraints, LIMITS } from "./constraints.js";
import { routeProfile } from "./profile.js";
import { buildTimeline } from "./replay.js";
import { hazardState, marginLevel } from "./hazard.js";
import { validateInputs, saveLocal, clearLocal } from "./inputs.js";
import { initialPlan, initialWalk, SPEEDS, PANELS, LAYER_IDS } from "./state.js";
import { stepConfig, planFacts, stationCounts, storyStart, clampStep, nextStep as stepAfter, prevStep as stepBefore, applyLayers, stepAnnouncement, TURN_S, WALK_SPEED } from "./story.js";
import { stepHeading, angleDiff, SETTLED_DEG } from "./camera-heading.js";
import { routeBounds, freeCentreOffset } from "./fit.js";

export const PLANNER_LIMITS = { slope_cap_deg: LIMITS.slope_cap_deg, rover_range_m: LIMITS.rover_range_m };
const EPS = 1e-6;

// The planner's grid: plain typed arrays and numbers, so it crosses into the worker by structured clone.
// The arrays are copied, not transferred: the main thread keeps using them for heights and slopes.
export function gridPayload(terrain, scene) {
  if (!terrain || !terrain.slope || !terrain.core || !scene) return null;
  return {
    slope: terrain.slope,
    cells: scene.core.slope_cells,
    scale_deg: scene.slope.scale_deg,
    nodata: scene.slope.nodata,
    height: terrain.core,
    samples: scene.core.dem_samples,
    offset_m: scene.height.offset_m,
    scale_m: scene.height.scale_m,
    height_nodata: scene.height.nodata,
    ground_scale: scene.ground_scale ?? 1,
  };
}

// run(type, payload) -> Promise of the planner result. type "plan" = planRoute, "return" = planReturn.
export function directPlanner() {
  return {
    run: (type, payload) => Promise.resolve().then(() => (type === "plan" ? planRoute(payload) : planReturn(payload))),
    dispose() {},
  };
}

// The browser planner: a module worker; if it cannot start or dies, the same planner runs on the main thread.
export function workerPlanner() {
  const direct = directPlanner();
  let worker = null;
  try {
    worker = new Worker(new URL("./planner.worker.js", import.meta.url), { type: "module" });
  } catch {
    return direct;
  }
  let seq = 0;
  let broken = false;
  const waiting = new Map();
  worker.onmessage = (e) => {
    const { id, result, error } = e.data || {};
    const w = waiting.get(id);
    if (!w) return;
    waiting.delete(id);
    if (error) w.reject(new Error(error));
    else w.resolve(result);
  };
  worker.onerror = (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    broken = true;
    for (const w of waiting.values()) w.fallback();
    waiting.clear();
  };
  return {
    run(type, payload) {
      if (broken) return direct.run(type, payload);
      const id = ++seq;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject, fallback: () => direct.run(type, payload).then(resolve, reject) });
        worker.postMessage({ type, id, payload });
      });
    },
    dispose() {
      worker.terminate();
    },
  };
}

export function rafClock() {
  return {
    now: () => performance.now(),
    frame: (fn) => requestAnimationFrame(fn),
    cancel: (id) => cancelAnimationFrame(id),
  };
}

// Blocks of the timeline score, from the timeline events: depart -> walk, arrive -> work, hazard -> return.
export function scheduleOf(timeline, inputs) {
  const ev = timeline.events;
  const blocks = [];
  for (let i = 0; i < ev.length - 1; i++) {
    const e = ev[i];
    const next = ev[i + 1];
    const kind = e.type === "depart" ? "walk" : e.type === "arrive" ? "work" : "return";
    blocks.push({ kind, t0: e.t_s, t1: next.t_s, station_id: kind === "work" ? e.station_id : null });
  }
  const start = inputs && inputs.hazard_start_min ? inputs.hazard_start_min.value : null;
  return {
    duration_s: timeline.duration_s,
    blocks,
    hazard_start_s: Number.isFinite(start) ? start * 60 : null,
    hazard_t_s: timeline.hazard_t_s,
  };
}

function nearestVertex(path, pos) {
  let best = null;
  let bd = Infinity;
  for (const p of path || []) {
    const d = Math.hypot(p[0] - pos.x, p[1] - pos.y);
    if (d < bd) {
      bd = d;
      best = { x: p[0], y: p[1] };
    }
  }
  return best;
}

const CAUTIONS = [
  {
    id: "suit_time",
    detail: "Suit time margin low",
    margin: (s) => s.suit_time_left_s,
    limit: LIMITS.suit_time_max_h * 3600,
  },
  {
    id: "rover_range",
    detail: "Distance to the crew rover near the limit",
    margin: (s) => (Number.isFinite(s.dist_to_base_m) ? LIMITS.rover_range_m - s.dist_to_base_m : null),
    limit: LIMITS.rover_range_m,
  },
  {
    id: "partner",
    detail: "Partner spacing near the limit or not known",
    margin: (s) => (Number.isFinite(s.dist_to_partner_m) ? LIMITS.partner_max_m - s.dist_to_partner_m : null),
    limit: LIMITS.partner_max_m,
  },
];

export function createController({
  store,
  host,
  data,
  terrain,
  plannerFactory = workerPlanner,
  clock = null,
  defaults = null,
  storage = undefined,
  limits = PLANNER_LIMITS,
  maxFrameS = 4,
  announce = () => {},
  // fit(): fits the plan camera to the route inside the free part of the screen (main.js measures the chrome);
  // without it the route box fills the whole canvas.
  fit = null,
  // freeArea(): {insets, w, h} of the part of the scene the story chrome leaves free (step 1 centres its view there).
  freeArea = null,
  // motion: {reduced() -> bool, hidden() -> bool}: the slow turn of step 1 never runs with reduced motion or a hidden tab.
  motion = null,
}) {
  const scene = data.scene;
  const planner = plannerFactory();
  const clk = clock || rafClock();
  const get = () => store.getState();
  const setWalk = (patch) => store.setState({ walk: { ...get().walk, ...patch } });
  const setPlan = (patch) => store.setState({ plan: { ...get().plan, ...patch } });

  let timeline = null;
  let baseDuration = 0;
  let baseSchedule = null;
  let planSeq = 0;
  let planPromise = Promise.resolve(null);
  let frameId = null;
  let lastNow = null;
  let hazardFiredAt = null;
  let returnPromise = null;
  let lastCardStation = null;
  let lastHeading = 0;
  // The eye's look direction: eyeTarget comes from the timeline, eyeHeading eases toward it in wall-clock time.
  let eyeHeading = null;
  let eyeTarget = null;
  let eyePos = null;
  let eyeFrameId = null;
  let eyeLast = null;
  let inTick = false;
  // Bumped by resetRun: a return plan or a hazard chain started before the reset never lands after it.
  let runSeq = 0;
  // The scheduled hazard stops the clock only while armed: step 4 and free exploring; step 3 walks past it.
  let hazardArmed = true;
  const fired = new Set();

  const inputsNow = () => get().inputs || data.inputs || null;
  const scheduledHazardS = () => {
    const i = inputsNow();
    const v = i && i.hazard_start_min ? i.hazard_start_min.value : null;
    return Number.isFinite(v) ? v * 60 : null;
  };

  function hz(t) {
    const base = hazardState(t, inputsNow(), data.sep);
    if (hazardFiredAt !== null && t >= hazardFiredAt - EPS) return { ...base, active: true, level: "return", label: "RETURN NOW", start_s: hazardFiredAt };
    return { ...base, active: false, level: "none", label: "" };
  }

  function addHeld(alert) {
    const held = get().walk.held;
    if (held.some((a) => a.id === alert.id)) return;
    setWalk({ held: [...held, alert] });
  }

  // ---- the clock
  function stopClock() {
    if (frameId !== null) clk.cancel(frameId);
    frameId = null;
    lastNow = null;
  }

  // The clock reads clk.now() (performance.now in the browser), never the frame timestamp: a slow or throttled
  // frame source lowers the frame rate only, the walk time still follows the wall clock (up to maxFrameS a frame).
  function tick() {
    frameId = null;
    const w = get().walk;
    if (!w.playing || w.pending || !timeline) return;
    const now = clk.now();
    if (lastNow === null) lastNow = now;
    const dt = Math.min(maxFrameS, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    inTick = true;
    try {
      stepTo(w.t_s + dt * w.speed, { stopArrivals: true, continueAfterHazard: false });
    } finally {
      inTick = false;
    }
    const after = get().walk;
    if (after.playing && !after.pending && frameId === null) frameId = clk.frame(tick);
  }

  function stopEyeLoop() {
    if (eyeFrameId !== null) clk.cancel(eyeFrameId);
    eyeFrameId = null;
    eyeLast = null;
  }

  // Runs while the heading is still turning, also when the walk is paused, so a pause finishes the turn.
  function eyeTick() {
    eyeFrameId = null;
    if (!host || eyeHeading === null || eyeTarget === null || !eyePos || !get().walk.active) return;
    const now = clk.now();
    const dt = Math.min(0.1, Math.max(0, (now - (eyeLast === null ? now : eyeLast)) / 1000));
    eyeLast = now;
    eyeHeading = stepHeading(eyeHeading, eyeTarget, dt);
    host.setEye({ ...eyePos, heading_deg: eyeHeading });
    if (Math.abs(angleDiff(eyeHeading, eyeTarget)) >= SETTLED_DEG) eyeFrameId = clk.frame(eyeTick);
    else eyeLast = null;
  }

  // Applies the timeline state at t: snapshot, eye, station card, caution alerts. A station card opens on arrival and
  // the clock keeps running through the work time; the card closes when the walker leaves the station (or earlier
  // with Acknowledge).
  function render(t) {
    const snap = timeline.stateAt(t);
    const w = get().walk;
    let card = w.card;
    const playing = w.playing;
    if (w.active) {
      const arrival = timeline.events.find((e) => e.type === "arrive" && e.station_id !== "base" && Math.abs(e.t_s - t) < EPS);
      const at = arrival ? arrival.station_id : snap.mode === "work" ? snap.at_station : null;
      if (at !== null && at !== undefined) {
        if (at !== lastCardStation) {
          lastCardStation = at;
          card = at;
        }
      } else if (snap.mode !== "work") {
        if (lastCardStation !== null && card === lastCardStation) card = null;
        lastCardStation = null;
      }
    }
    const held = [...w.held];
    for (const c of CAUTIONS) {
      if (fired.has(c.id) || snap.mode === "done") continue;
      if (marginLevel(c.margin(snap), c.limit) === "caution") {
        fired.add(c.id);
        if (!held.some((a) => a.id === c.id)) held.push({ id: c.id, level: "caution", label: "CAUTION", detail: c.detail });
      }
    }
    if (Number.isFinite(snap.heading_deg)) lastHeading = snap.heading_deg;
    if (w.active && host && snap.pos) {
      eyePos = { x: snap.pos.x, y: snap.pos.y };
      const look = Number.isFinite(snap.look_deg) ? snap.look_deg : lastHeading;
      // Only a frame of normal play eases; a seek, a step change, Next, the hazard start and a first frame snap.
      const ease = inTick && eyeHeading !== null && !reducedMotion();
      if (!ease) {
        stopEyeLoop();
        eyeHeading = look;
        eyeTarget = look;
      } else if (snap.mode !== "work") {
        eyeTarget = look;
      }
      host.setEye({ ...eyePos, heading_deg: eyeHeading });
      if (ease && Math.abs(angleDiff(eyeHeading, eyeTarget)) >= SETTLED_DEG && eyeFrameId === null) {
        eyeLast = clk.now();
        eyeFrameId = clk.frame(eyeTick);
      }
    } else if (!w.active) {
      eyeHeading = null;
    }
    setWalk({ t_s: t, snapshot: snap, hazard: hz(t), held, card, playing });
  }

  // Moves the clock to target, stopping at the first event on the way: a station arrival (playback in the walk
  // view only) or the scheduled hazard start. Returns a promise while a return path is being planned.
  function stepTo(target, { stopArrivals = false, continueAfterHazard = false } = {}) {
    if (!timeline) return Promise.resolve();
    const from = get().walk.t_s;
    const goal = Math.min(Math.max(0, target), timeline.duration_s);
    const stops = [];
    const hs = scheduledHazardS();
    if (hazardArmed && hazardFiredAt === null && hs !== null && hs < baseDuration && hs >= from - EPS && hs <= goal + EPS && goal >= hs) {
      stops.push({ t: hs, kind: "hazard" });
    }
    if (stopArrivals && get().walk.active) {
      const e = timeline.events.find((x) => x.type === "arrive" && x.station_id !== "base" && x.t_s > from + EPS && x.t_s <= goal + EPS);
      if (e) stops.push({ t: e.t_s, kind: "arrive" });
    }
    stops.sort((a, b) => a.t - b.t);
    const stop = stops[0];
    if (!stop) {
      render(goal);
      if (goal >= timeline.duration_s - EPS && get().walk.playing) {
        stopClock();
        setWalk({ playing: false });
        announce("The walk is over: back at the crew rover.");
      }
      return Promise.resolve();
    }
    // An arrival is drawn on its own frame so its card always opens; the clock runs on from there.
    render(stop.t);
    if (stop.kind === "arrive") return Promise.resolve();
    const myRun = runSeq;
    return fireReturn(stop.t, { alert: true }).then(() => (myRun === runSeq && continueAfterHazard && goal > stop.t + EPS ? stepTo(goal, { continueAfterHazard }) : undefined));
  }

  // Plans the return from the position at th and switches the timeline to return mode.
  function fireReturn(th, { alert }) {
    if (!timeline) return Promise.resolve();
    if (alert && hazardFiredAt === null) {
      hazardFiredAt = th;
      addHeld({ id: "return", level: "return", label: "RETURN NOW", detail: "Scenario - solar particle event, measured near Earth; arrival at Mars not claimed" });
      announce("Return now: hazard scenario. The way back to the crew rover is shown.");
    }
    const returning = timeline.hazard_t_s !== null;
    if (returning || th >= baseDuration - EPS) {
      render(th);
      return returnPromise || Promise.resolve();
    }
    if (returnPromise) return returnPromise;
    const grid = gridPayload(terrain, scene);
    const inputs = inputsNow();
    const snap = timeline.stateAt(th);
    const wasPlaying = get().walk.playing;
    const mySeq = planSeq;
    const myRun = runSeq;
    stopClock();
    setWalk({ pending: true, playing: false, card: null });
    const ask = (pos) => planner.run("return", { grid, from: pos, base: inputs.base, noGo: inputs.no_go, limits });
    const route = get().plan.route;
    const legPath = route && Number.isInteger(snap.leg_index) && route.legs[snap.leg_index] ? route.legs[snap.leg_index].path : null;
    const mine = ask(snap.pos)
      .then((res) => {
        if (res && res.ok) return res;
        const alt = nearestVertex(legPath, snap.pos);
        return alt ? ask(alt) : res;
      })
      .catch(() => null)
      .then((res) => {
        if (returnPromise === mine) returnPromise = null;
        if (mySeq !== planSeq || myRun !== runSeq || !timeline) return;
        if (!res || !res.ok || !res.legs.length) {
          setWalk({ pending: false });
          addHeld({ id: "no_return", level: "caution", label: "CAUTION", detail: "No return path found from here" });
          render(th);
          return;
        }
        const leg = res.legs[0];
        timeline.triggerHazard(th, leg);
        setWalk({
          pending: false,
          return_leg: leg,
          return_from: { pos: { ...snap.pos }, leg_index: snap.leg_index, mode: snap.mode, t_s: th },
          schedule: scheduleOf(timeline, inputs),
        });
        render(th);
        // A return from the base itself has no length: the walk is over, and play() at the end would restart it.
        if (wasPlaying && timeline.duration_s > th + EPS) play();
      });
    returnPromise = mine;
    return mine;
  }

  function resetRun() {
    runSeq++;
    stopClock();
    if (timeline) timeline.clearHazard();
    hazardFiredAt = null;
    returnPromise = null;
    fired.clear();
    lastCardStation = null;
    setWalk({
      t_s: 0, playing: false, held: [], card: null, return_leg: null, return_from: null, pending: false,
      schedule: baseSchedule, snapshot: timeline ? timeline.stateAt(0) : null, hazard: timeline ? hz(0) : null,
    });
    if (timeline) render(0);
  }

  // ---- planning
  function applyRoute(route, inputs) {
    const constraints = buildConstraints({ route, inputs, dose: data.dose });
    if (!route || route.ok !== true) {
      timeline = null;
      baseSchedule = null;
      const blocking = route && route.blocking ? route.blocking : { limit: "no_data", station_id: null, detail: "The planner gave no answer." };
      setPlan({ status: "no_route", empty: false, waiting: false, route: null, blocking, constraints, profile: null, schedule: null });
      announce("No route. The limit that blocks it is named in the limits panel.");
      return get().plan;
    }
    let profile = null;
    try {
      profile = routeProfile(route, terrain, { scene });
    } catch {
      profile = null;
    }
    try {
      timeline = buildTimeline({ route, inputs, conditions: data.conditions });
      baseDuration = timeline.duration_s;
      baseSchedule = scheduleOf(timeline, inputs);
    } catch {
      timeline = null;
      baseSchedule = null;
    }
    setPlan({ status: "ok", empty: false, waiting: false, route, blocking: null, constraints, profile, schedule: baseSchedule });
    resetRun();
    announce("Route planned.");
    return get().plan;
  }

  function replan() {
    const my = ++planSeq;
    const inputs = inputsNow();
    if (get().walk.active) exitWalk();
    stopClock();
    timeline = null;
    baseSchedule = null;
    returnPromise = null;
    hazardFiredAt = null;
    fired.clear();
    setWalk({ ...initialWalk(), speed: get().walk.speed });
    if (!inputs) {
      setPlan(initialPlan());
      planPromise = Promise.resolve(get().plan);
      return planPromise;
    }
    if (!inputs.stations || inputs.stations.length === 0) {
      setPlan({ ...initialPlan(), empty: true, constraints: buildConstraints({ route: null, inputs, dose: data.dose }) });
      planPromise = Promise.resolve(get().plan);
      return planPromise;
    }
    const grid = gridPayload(terrain, scene);
    if (!grid) {
      // The 1 m slope grid arrives in the second load stage; main.js calls replan() again when it is in.
      setPlan({ ...initialPlan(), status: "planning", waiting: true });
      planPromise = Promise.resolve(get().plan);
      return planPromise;
    }
    setPlan({ status: "planning", waiting: false, empty: false });
    const payload = { grid, base: inputs.base, stations: inputs.stations, noGo: inputs.no_go, limits };
    planPromise = planner.run("plan", payload).then(
      (route) => (my === planSeq ? applyRoute(route, inputs) : get().plan),
      (err) => {
        if (my !== planSeq) return get().plan;
        return applyRoute({ ok: false, blocking: { limit: "error", station_id: null, detail: String((err && err.message) || err) } }, inputs);
      },
    );
    return planPromise;
  }

  function waitForPlan() {
    const settled = (p) => p.status === "ok" || p.status === "no_route" || (p.status === "idle" && p.empty);
    if (settled(get().plan)) return Promise.resolve(get().plan);
    return new Promise((resolve) => {
      const off = store.subscribe((s) => {
        if (settled(s.plan)) {
          off();
          resolve(s.plan);
        }
      });
    });
  }

  // ---- actions
  function play() {
    if (!timeline || get().walk.pending) return;
    if (get().walk.t_s >= timeline.duration_s - EPS) resetRun();
    setWalk({ playing: true });
    lastNow = clk.now();
    if (frameId === null) frameId = clk.frame(tick);
  }

  function pause() {
    stopClock();
    if (get().walk.playing) setWalk({ playing: false });
  }

  function enterWalk({ play: autoplay = false } = {}) {
    if (get().plan.status !== "ok" || !timeline) return false;
    if (get().walk.t_s >= timeline.duration_s - EPS) resetRun();
    setWalk({ active: true });
    render(get().walk.t_s);
    store.setState({ view: "walk", picked: null });
    if (host) host.setView("walk");
    announce("Walk view. Keys: N next, A acknowledge, R return to rover.");
    if (autoplay) play();
    return true;
  }

  function exitWalk() {
    pause();
    setWalk({ active: false, card: null });
    store.setState({ view: "plan" });
    if (host) host.setView("plan");
  }

  function acknowledge() {
    const w = get().walk;
    if (w.card !== null) {
      setWalk({ card: null });
      return;
    }
    if (w.held.length) setWalk({ held: w.held.slice(1) });
  }

  function next() {
    if (!timeline || get().walk.pending) return Promise.resolve();
    const w = get().walk;
    const resume = w.playing;
    pause();
    if (w.card !== null) setWalk({ card: null });
    const ev = timeline.events.find((e) => e.t_s > w.t_s + EPS);
    const target = ev ? ev.t_s : timeline.duration_s;
    return stepTo(target, { stopArrivals: false, continueAfterHazard: false }).then(() => {
      if (resume && get().walk.t_s < timeline.duration_s - EPS) play();
    });
  }

  function seek(t) {
    if (!timeline || !Number.isFinite(t)) return Promise.resolve();
    return stepTo(t, { stopArrivals: false, continueAfterHazard: true });
  }

  function setSpeed(n) {
    if (SPEEDS.includes(n)) setWalk({ speed: n });
  }

  function returnToRover() {
    if (!timeline || timeline.hazard_t_s !== null) return Promise.resolve();
    return fireReturn(get().walk.t_s, { alert: false });
  }

  function startHazardScenario() {
    if (!timeline || hazardFiredAt !== null) return Promise.resolve();
    return fireReturn(get().walk.t_s, { alert: true });
  }

  function updateInputs(nextInputs) {
    const r = validateInputs(nextInputs);
    if (!r.ok) return r;
    store.setState({ inputs: r.inputs });
    try {
      saveLocal(r.inputs, storage);
    } catch {
      // private mode or no storage: the edit still applies for this visit
    }
    return { ok: true, inputs: r.inputs, done: replan() };
  }

  // Reset drops the copy kept in this browser, so the next visit reads team-inputs.json again.
  function resetInputs() {
    if (!defaults) return { ok: false, field: "(defaults)", problem: "no committed inputs to restore" };
    const r = validateInputs(defaults);
    if (!r.ok) return r;
    store.setState({ inputs: r.inputs });
    try {
      clearLocal(storage);
    } catch {
      // private mode or no storage: nothing was kept
    }
    return { ok: true, inputs: r.inputs, done: replan() };
  }

  // Picking a tab opens the Details drawer on it.
  function setPanel(name) {
    if (PANELS.includes(name)) store.setState({ panel: name, drawer: true });
  }

  function setDrawer(open, panel = null) {
    if (panel && PANELS.includes(panel)) store.setState({ panel });
    store.setState({ drawer: !!open });
  }

  function setLayer(id, on) {
    if (!LAYER_IDS.includes(id)) return;
    const layers = get().layers || [];
    const nextLayers = on ? (layers.includes(id) ? layers : [...layers, id]) : layers.filter((x) => x !== id);
    store.setState({ layers: nextLayers });
  }

  function setImagery(mode) {
    return host && typeof host.setImagery === "function" ? host.setImagery(mode) : Promise.resolve(false);
  }

  function setExaggeration(n) {
    store.setState({ exaggeration: n === 2 ? 2 : 1 });
  }

  function showSheet(name) {
    store.setState({ sheet: name || null });
  }

  // ---- the guided story (story.js): each step sets the view, the camera, the layers and the walk time itself.
  const reducedMotion = () => {
    try {
      if (motion && typeof motion.reduced === "function") return !!motion.reduced();
      return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  };
  const tabHidden = () => {
    try {
      if (motion && typeof motion.hidden === "function") return !!motion.hidden();
      return typeof document !== "undefined" && document.visibilityState === "hidden";
    } catch {
      return false;
    }
  };

  // The slow turn of step 1: one turn in TURN_S seconds around the centre. It stops for good on any input, with
  // reduced motion, in the 2D view, on a hidden tab, and when the step changes.
  let turn = null;
  // Set by the first user input; Back to step 1 never starts the turn again.
  let turnDone = false;
  const turnAllowed = () => !turnDone && !!host && host.kind === "3d" && typeof host.rotateBy === "function" && !reducedMotion() && !tabHidden()
    && get().step === 1 && !get().explore && get().view === "plan";
  function stopTurn() {
    if (turn && turn.id !== null) clk.cancel(turn.id);
    turn = null;
  }
  function turnTick() {
    if (!turn) return;
    turn.id = null;
    if (!turnAllowed()) return stopTurn();
    const now = clk.now();
    if (turn.last !== null) host.rotateBy((360 / TURN_S) * Math.min(0.1, Math.max(0, (now - turn.last) / 1000)));
    turn.last = now;
    turn.id = clk.frame(turnTick);
  }
  function startTurn() {
    stopTurn();
    if (!turnAllowed()) return;
    turn = { last: null, id: null };
    turn.id = clk.frame(turnTick);
  }

  let startT = null;
  let appliedRoute = null;

  // The camera right after the last route fit; a layout change (resize, drawer, caption) fits again only while the
  // visitor has not moved the map since.
  let fittedKey = null;
  function cameraKey() {
    const c = host && typeof host.getCamera === "function" ? host.getCamera() : null;
    if (!c) return null;
    return [c.x, c.y, c.zoom_px_per_m, c.heading_deg, c.tilt_deg].map((v) => (Number.isFinite(v) ? Math.round(v * 100) : 0)).join("|");
  }

  function fitNow() {
    let ok;
    if (typeof fit === "function") ok = fit() !== false;
    else {
      const s = get();
      const b = routeBounds(s.inputs, s.plan.status === "ok" ? s.plan.route : null);
      if (b && host && typeof host.fitBounds === "function") host.fitBounds(b, {});
      ok = !!b;
    }
    fittedKey = ok ? cameraKey() : null;
    return ok;
  }

  function fitCamera() {
    if (get().plan.status !== "ok") return false;
    return fitNow();
  }

  // Step 1 turns around the middle of the ridges; that middle sits in the middle of the free area.
  function placeCentre() {
    if (!host) return;
    const area = typeof freeArea === "function" ? freeArea() : null;
    const off = area && area.w > 0 ? freeCentreOffset(area.insets, area.w, area.h) : { dx: 0, dy: 0 };
    if (typeof host.setCentreOffset === "function" && host.kind !== "2d") host.setCentreOffset(off.dx, off.dy);
    else if ((off.dx || off.dy) && typeof host.panBy === "function") host.panBy(-off.dx, -off.dy);
  }

  // The camera right after step 1 was placed (2D: a layout change places it again only while it was not moved).
  let orbitKey = null;

  // Sets the camera of the step on screen (also after a renderer swap).
  function applyCamera() {
    const s = get();
    if (s.view !== "plan") return;
    if (s.explore) return;
    const cfg = stepConfig(s.step, { renderer: host ? host.kind : null, plan: planFacts(s.plan) });
    if (cfg.camera.mode === "orbit") {
      if (host && typeof host.flyTo === "function") {
        host.flyTo(cfg.camera.x, cfg.camera.y, { animate: false, tilt_deg: cfg.camera.tilt_deg, heading_deg: cfg.camera.heading_deg, span_m: cfg.camera.span_m });
        placeCentre();
        orbitKey = cameraKey();
      }
      if (cfg.camera.turn) startTurn();
    } else if (cfg.camera.mode === "fit") fitCamera();
  }

  // After a layout change (window size, the drawer, the caption plate): the fit steps fit again unless the map was
  // moved by hand since the last fit; step 1 moves its centre (3D: the view offset, so the turn keeps its middle;
  // 2D: the camera is placed again, unless it was moved by hand).
  function relayout() {
    const s = get();
    if (s.view !== "plan" || s.explore || !host) return;
    const mode = stepConfig(s.step).camera.mode;
    if (mode === "fit" && fittedKey !== null && cameraKey() === fittedKey) fitCamera();
    else if (mode === "orbit" && host.kind !== "2d" && typeof host.setCentreOffset === "function") placeCentre();
    else if (mode === "orbit" && host.kind === "2d" && orbitKey !== null && cameraKey() === orbitKey) applyCamera();
  }

  function applyWalk(cfg) {
    if (get().plan.status !== "ok" || !timeline) return;
    hazardArmed = cfg.step !== 3;
    if (cfg.step === 3) {
      resetRun();
      setSpeed(WALK_SPEED);
      if (startT !== null) {
        const t = startT;
        startT = null;
        enterWalk({ play: false });
        seek(t);
      } else enterWalk({ play: true });
      return;
    }
    if (cfg.step === 4) {
      resetRun();
      enterWalk({ play: false });
      const hs = scheduledHazardS();
      const at = hs !== null && hs < baseDuration ? hs : baseDuration / 2;
      const t = startT !== null ? Math.min(startT, baseDuration) : at;
      startT = null;
      const myRun = runSeq;
      seek(t).then(() => (myRun === runSeq && hazardFiredAt === null ? startHazardScenario() : undefined));
    }
  }

  function applyStep({ say = true } = {}) {
    stopTurn();
    const s = get();
    const cfg = stepConfig(s.step, { renderer: host ? host.kind : null, plan: planFacts(s.plan), stations: stationCounts(s.inputs) });
    store.setState({ layers: applyLayers(s.layers, cfg.layers), picked: null });
    appliedRoute = s.plan.status === "ok" ? s.plan.route : null;
    if (cfg.view === "walk") applyWalk(cfg);
    else {
      if (get().walk.active) exitWalk();
      // A plan step keeps nothing of a walk: no return path, no walked trail, no held alert.
      if (timeline) resetRun();
      applyCamera();
    }
    if (say) announce(stepAnnouncement(cfg));
  }

  function gotoStep(n) {
    const step = clampStep(n);
    store.setState({ step, explore: false, sheet: null });
    applyStep();
  }

  const actionsStory = {
    gotoStep,
    nextStep: () => gotoStep(stepAfter(get().step)),
    prevStep: () => gotoStep(stepBefore(get().step)),
    setSources: (on) => store.setState({ showSources: !!on }),
    setExplore(on) {
      stopTurn();
      if (on) {
        if (get().walk.active) exitWalk();
        hazardArmed = true;
        store.setState({ explore: true, drawer: true, picked: null });
        announce("Free view. The story waits; every panel is in Details.");
      } else {
        store.setState({ explore: false });
        applyStep();
      }
    },
    // The "fit route" map control.
    fitRoute: () => fitNow(),
    relayout,
    pickStation: (id) => store.setState({ picked: id === undefined ? null : id }),
    // Called on user input (main.js): the turn stops for good.
    stopTurn() {
      turnDone = true;
      stopTurn();
    },
    setDrawer,
  };

  // A route that arrives (or changes) while a step waits for it: that step is applied again, after the store has
  // settled (applyRoute resets the run right after it publishes the plan).
  store.subscribe((s) => {
    if (s.plan.status !== "ok" || s.plan.route === appliedRoute) return;
    appliedRoute = s.plan.route;
    Promise.resolve().then(() => {
      const now = get();
      if (now.plan.route !== appliedRoute || now.explore) return;
      if (now.step === 1) return;
      applyStep({ say: false });
    });
  });

  const actions = {
    replan, updateInputs, resetInputs, setPanel, enterWalk, exitWalk, play, pause, setSpeed, seek, next,
    acknowledge, returnToRover, startHazardScenario, setLayer, setImagery, setExaggeration, showSheet,
    ...actionsStory,
  };

  // The address picks the first step (story.js storyStart): ?step= wins, the older options map onto steps. ?panel=
  // opens the drawer on that tab; ?sheet=route-card opens the route card once the route exists.
  async function applyStartOptions(opts = {}) {
    const start = storyStart(opts, { hazard_s: scheduledHazardS() });
    startT = start.t;
    store.setState({ step: start.step, showSources: start.showSources || !!get().showSources });
    if (start.panel) setPanel(start.panel);
    applyStep({ say: false });
    if (opts.sheet !== "route-card") return;
    const plan = await waitForPlan();
    if (plan.status === "ok") showSheet("route-card");
  }

  // Status before the first plan: waiting for the slope grid when it is not in yet.
  if (get().plan.status === "idle" && !gridPayload(terrain, scene)) setPlan({ status: "planning", waiting: true });

  return {
    actions,
    applyStartOptions,
    applyCamera,
    waitForPlan,
    get timeline() {
      return timeline;
    },
    get planPromise() {
      return planPromise;
    },
    dispose() {
      stopClock();
      stopTurn();
      planner.dispose();
    },
  };
}
