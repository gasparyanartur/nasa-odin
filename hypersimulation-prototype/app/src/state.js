// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

export const LAYER_IDS = [
  "image", "height", "slope", "thermal", "atmosphere", "radiation",
  "space_weather", "rover_path", "stations", "no_go", "drill_sites",
];

// The route, the stations, the base and the no-go zones are on at start; the slope hatch is off (it hides terrain).
const DEFAULT_LAYERS = ["image", "stations", "no_go"];
// The tabs of the Details drawer.
export const PANELS = ["limits", "timeline", "layers", "stations", "editor", "rover", "credits"];
export const SPEEDS = [10, 60, 240];
export const IMAGERY_MODES = ["colour", "grey"];
export const STEP_COUNT = 5;

// ?layer=a,b adds layers to the defaults; a leading minus removes one (?layer=slope,-no_go). Unknown ids are ignored.
export function layersFromOption(value) {
  const out = [...DEFAULT_LAYERS];
  for (const raw of (value || "").split(",")) {
    const s = raw.trim();
    const off = s.startsWith("-");
    const id = off ? s.slice(1).trim() : s;
    if (!LAYER_IDS.includes(id)) continue;
    const k = out.indexOf(id);
    if (off && k >= 0) out.splice(k, 1);
    else if (!off && k < 0) out.push(id);
  }
  return out;
}

export function parseUrlOptions(search) {
  const q = new URLSearchParams(typeof search === "string" ? search : "");
  const view = q.get("view");
  const t = q.get("t") !== null && q.get("t") !== "" ? Number(q.get("t")) : NaN;
  const step = Number(q.get("step"));
  return {
    step: Number.isInteger(step) && step >= 1 && step <= STEP_COUNT ? step : null,
    // ?sources=1: the origin labels show from the start.
    showSources: q.get("sources") === "1",
    view: ["plan", "walk", "2d"].includes(view) ? view : "plan",
    data: q.get("data") === "mock" ? "mock" : "real",
    layers: layersFromOption(q.get("layer")),
    t: Number.isFinite(t) && t >= 0 ? t : 0,
    hazard: q.get("hazard") === "1",
    exag: q.get("exag") === "2" ? 2 : 1,
    fps: q.get("fps") === "1",
    imagery: IMAGERY_MODES.includes(q.get("imagery")) ? q.get("imagery") : null,
    panel: PANELS.includes(q.get("panel")) ? q.get("panel") : null,
    sheet: q.get("sheet") === "route-card" ? "route-card" : null,
  };
}

export function stateFromOptions(opts) {
  return {
    view: opts.view === "walk" ? "walk" : "plan",
    renderer: opts.view === "2d" ? "2d" : "3d",
    layers: opts.layers,
    t: opts.t,
    hazard: opts.hazard,
    exaggeration: opts.exag,
    imagery: { mode: opts.imagery, loading: false },
    showSources: !!opts.showSources,
    ...(opts.panel ? { panel: opts.panel } : {}),
  };
}

// Plan and walk as the controller (controller.js) owns them. Everything else reads them only.
export function initialPlan() {
  return { status: "idle", empty: false, waiting: false, route: null, blocking: null, constraints: [], profile: null, schedule: null };
}

export function initialWalk() {
  return {
    active: false, playing: false, speed: 60, t_s: 0, snapshot: null, hazard: null,
    held: [], card: null, schedule: null, return_leg: null, return_from: null, pending: false,
  };
}

export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    getState: () => state,
    setState(patch) {
      const changed = Object.keys(patch).some((k) => !Object.is(state[k], patch[k]));
      if (!changed) return state;
      state = { ...state, ...patch };
      // One screen module that throws must not starve the ones after it (a stale primary action would stay drawn disabled).
      let first = null;
      for (const fn of [...subs]) {
        try {
          fn(state);
        } catch (err) {
          if (first === null) first = { err };
        }
      }
      if (first !== null) throw first.err;
      return state;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function initialState() {
  return {
    view: "plan",
    renderer: "3d",
    layers: [...DEFAULT_LAYERS],
    route: null,
    inputs: null,
    t: 0,
    hazard: false,
    exaggeration: 1,
    imagery: { mode: null, loading: false },
    plan: initialPlan(),
    walk: initialWalk(),
    panel: "limits",
    sheet: null,
    // The guided story (story.js): the step on screen, free exploring, the Details drawer, the origin labels, and
    // the station whose small card is open on the plan step.
    step: 1,
    explore: false,
    drawer: false,
    showSources: false,
    picked: null,
  };
}

const store = createStore(initialState());
export const getState = store.getState;
export const setState = store.setState;
export const subscribe = store.subscribe;
