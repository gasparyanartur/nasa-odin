// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Composition root. Start-up order: URL options, data base, first view with progress, then at once the detail files
// (core terrain first, then the image tiles) in parallel with the renderer choice (3D with a 2D fallback at every
// step) and the screens; the planner runs when the core terrain is in; the speed test runs last, off that path.
// The controller (controller.js) owns the plan, the walk and the guided story; every screen module is mounted by
// dynamic import (MODULES) and a missing one never breaks the page.
// Story keys (Right or Enter: Next, Left: Back), map keys and the walk keys are handled here (scene3d has none).
import { parseUrlOptions, stateFromOptions, getState, setState, subscribe, LAYER_IDS } from "./state.js";
import { createController, workerPlanner } from "./controller.js";
import { loadFirstView, loadTiles, loadImagery, imageryModes } from "./loader.js";
import { createViewHost } from "./view-host.js";
import { FpsMeter, speedTest, whenVisible } from "./perf.js";
import { fitRoute, sceneFree, STORY_PAD_M } from "./fit.js";
import { onNextFrame } from "./frame.js";
import { stepSearch } from "./story.js";
import { toUint16, toUint8 } from "./terrain.js";
import { chooseInputs } from "./inputs.js";
import { audit } from "./provenance.js";
import { createView2d } from "./view2d.js";
import { createProgress } from "./ui/progress.js";
import { showError } from "./ui/error.js";

const SOURCES_PATH = "../../sources.json"; // sources.json sits in app/, the data base is two folders deeper
const DEFAULT_INPUTS = "team-inputs.default.json";
const FPS_FLOOR = 24;
const TILT_UP_DEG = 55;
const PAN_STEP_PX = 80;

export function dataBase(opts) {
  return opts.data === "mock" ? "./public/data-mock/" : "./public/data/";
}

export function isLowDetail({ matchMedia, deviceMemory } = {}) {
  const narrow = typeof matchMedia === "function" && matchMedia("(max-width: 600px)").matches;
  return narrow || (typeof deviceMemory === "number" && deviceMemory <= 4);
}

export function hasWebgl(doc = globalThis.document) {
  try {
    const c = doc.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// Map keys in the plan view (plan amendment A5). Left and Right move the map only while the map has the focus;
// elsewhere they step the story (storyKeyAction). Walk view keys belong to the helmet display.
export function planKeyAction(key, shift = false) {
  const step = shift ? PAN_STEP_PX * 3 : PAN_STEP_PX;
  if (key === "ArrowLeft") return { name: "pan", dx: -step, dy: 0 };
  if (key === "ArrowRight") return { name: "pan", dx: step, dy: 0 };
  if (key === "ArrowUp") return { name: "pan", dx: 0, dy: -step };
  if (key === "ArrowDown") return { name: "pan", dx: 0, dy: step };
  if (key === "+" || key === "=") return { name: "zoom", factor: 1.25 };
  if (key === "-" || key === "_") return { name: "zoom", factor: 0.8 };
  if (key === "t" || key === "T") return { name: "tilt" };
  if (key === "0") return { name: "north" };
  return null;
}

// Story keys: Right = Next, Left = Back, Enter = Next when no control holds the focus (a focused button keeps its own
// Enter). Not while a text field, a tab list, a segmented control, the drawer or the focused map takes the key.
export function storyKeyAction(key, { target = null, mapFocused = false } = {}) {
  if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Enter") return null;
  if (mapFocused && key !== "Enter") return null;
  if (target) {
    if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return null;
    if (typeof target.closest === "function" && target.closest('[data-keys="off"], [role="tablist"], [role="radiogroup"], .drawer')) return null;
    if (key === "Enter" && target.tagName !== "BODY" && target.tagName !== "CANVAS") return null;
  }
  return key === "ArrowLeft" ? "back" : "next";
}

// What a story key does now: a held key (repeat) steps nothing; Next obeys the same rule as the Next button (from the
// plan step on it waits for the route); no step past either end. Returns "next", "back" or null.
export function storyKeyGo(action, { step, planStatus, repeat = false } = {}) {
  if (!action || repeat) return null;
  if (action === "next") return step < 5 && !(step >= 2 && planStatus !== "ok") ? "next" : null;
  if (action === "back") return step > 1 ? "back" : null;
  return null;
}

// Keys act on the plan view only: not in walk view, not while a modal is open, not while a text field or an element
// marked data-keys="off" holds the focus.
export function planKeysAllowed({ view, modalOpen = false, target = null } = {}) {
  if (view !== "plan" || modalOpen) return false;
  if (!target) return true;
  if (target.isContentEditable) return false;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return false;
  if (typeof target.closest === "function" && target.closest('[data-keys="off"]')) return false;
  return true;
}

// Real rendered frames per second while frames arrive; "idle" when nothing has rendered for a moment.
export function formatFps(fps, sinceLastFrameMs, idleMs = 600) {
  if (!Number.isFinite(fps) || sinceLastFrameMs === null || sinceLastFrameMs > idleMs) return "idle";
  return `${Math.round(fps)} fps`;
}

// Walk view keys (plan amendment A5): N next, A acknowledge, R return to rover.
export function walkKeyAction(key) {
  const k = typeof key === "string" ? key.toLowerCase() : "";
  if (k === "n") return "next";
  if (k === "a") return "acknowledge";
  if (k === "r") return "returnToRover";
  return null;
}

// Every screen module, in mount order: the drawer first (the panels others mount into), the story chrome last.
export const MODULES = [
  "drawer", "display", "no-route", "minimums", "timeline", "route-overlays", "map-controls", "route-card",
  "hud", "station-card", "layer-panel", "editor", "rover-panel", "stations-list", "minimap", "story",
];

// Each module exports mount(ctx) -> unmount. A module that is missing or throws is skipped without a message.
export async function mountModules(ctx, names = MODULES, load = (name) => import(`./ui/${name}.js`)) {
  const mounted = [];
  for (const name of names) {
    try {
      const mod = await load(name);
      if (mod && typeof mod.mount === "function") {
        const off = mod.mount(ctx);
        mounted.push({ name, off: typeof off === "function" ? off : () => {} });
      }
    } catch {
      // not built yet, or failed: the rest of the page carries on
    }
  }
  return mounted;
}

function refs(doc) {
  const get = (id) => doc.getElementById(id);
  return {
    app: get("app"), canvas: get("scene"), boot: get("boot"), modal: get("layer-modal"),
    notice: get("notice"), status: get("status"), head: get("story-head"), story: get("story"), drawer: get("drawer"),
    labels: get("labels"), hud: get("hud"),
  };
}

// A token from tokens.css, or undefined (the renderer keeps its own fallback).
function cssVar(doc, name) {
  try {
    const v = globalThis.getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

// A canvas that ever held a WebGL context cannot give out a 2D one, so a swap uses a fresh element.
function freshCanvas(old) {
  const next = old.cloneNode(false);
  old.replaceWith(next);
  return next;
}

async function withRetry(fn, modal) {
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      await new Promise((resolve) => showError(modal, err, { onRetry: resolve }));
    }
  }
}

function showFps(host, parent) {
  const el = document.createElement("div");
  el.setAttribute("class", "fps-readout");
  el.setAttribute("data-nonmetric", "");
  parent.appendChild(el);
  const meter = new FpsMeter({ windowMs: 1000 });
  let last = null;
  host.onRender((t) => {
    meter.tick(t);
    last = t;
  });
  const paint = () => {
    el.textContent = formatFps(meter.fps(), last === null ? null : performance.now() - last);
  };
  paint();
  setInterval(paint, 250);
}

// app/layers.json (the 11 layer ids with label, unit, kind, source ids). Missing: the layer panel uses its own list.
async function loadLayers() {
  try {
    const r = await fetch("./layers.json");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// The first view needs the walk inputs file. A bad field shows the input error screen with a button that loads
// the second committed copy (team-inputs.default.json); any other failure shows the retry screen.
async function loadFirst(base, onProgress, modal, imagery) {
  let inputsFile;
  for (;;) {
    try {
      return await loadFirstView(base, onProgress, { sourcesPath: SOURCES_PATH, imagery, inputsFile });
    } catch (err) {
      const badField = err && typeof err === "object" && "field" in err && !inputsFile;
      const choice = await new Promise((resolve) =>
        showError(modal, err, badField ? { onContinue: () => resolve("default"), onRetry: () => resolve("retry") } : { onRetry: () => resolve("retry") }),
      );
      if (choice === "default") inputsFile = DEFAULT_INPUTS;
    }
  }
}

// The detail files (dem_core.bin, slope_core.bin, then the image tiles) start the moment the first view is in,
// before the renderer, the walk inputs check or the screens. Files that arrive before their consumer is ready wait
// here; attach(fn) hands them over in arrival order and takes every later one directly.
export function createTileSink() {
  const queue = [];
  let sink = null;
  return {
    push(name, payload) {
      if (sink) sink(name, payload);
      else queue.push([name, payload]);
    },
    attach(fn) {
      sink = fn;
      while (queue.length) {
        const [name, payload] = queue.shift();
        fn(name, payload);
      }
    },
  };
}

// The start-up speed test, off the loading path: it waits for the core mesh and for a visible page, never counts a
// hidden page as slow, and gives up (3D stays, untested) when the frame source is too slow to measure.
export async function runSpeedCheck({ host, perf, coreIn, doc, onSlow, test = speedTest, floor = FPS_FLOOR, testOptions = {}, tries = 4 }) {
  await coreIn;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (host.kind !== "3d") return perf.decision;
    await whenVisible(doc);
    if (host.kind !== "3d") return perf.decision;
    perf.decision = "3d-testing";
    host.setContinuous(true);
    let r;
    try {
      r = await test({ isHidden: () => !!doc && doc.visibilityState === "hidden", ...testOptions });
    } catch {
      r = { status: "skipped" };
    }
    if (host.kind === "3d") host.setContinuous(false);
    if (host.kind !== "3d") return perf.decision;
    if (r.status === "hidden") {
      perf.decision = "3d-waiting";
      continue;
    }
    if (r.status === "measured") {
      perf.fps = Math.round(r.fps * 10) / 10;
      if (r.fps < floor) onSlow();
      else perf.decision = "3d";
      return perf.decision;
    }
    perf.decision = "3d-untested";
    return perf.decision;
  }
  if (host.kind === "3d") perf.decision = "3d-untested";
  return perf.decision;
}

// env (tests only): doc, win, modules (screen module names), scene3d (module with createScene3d), speedTest options.
export async function start(env = {}) {
  const doc = env.doc || document;
  const win = env.win || window;
  const ui = refs(doc);
  const opts = parseUrlOptions(win.location.search);
  // The walk view needs a planned route: the controller enters it once the route is there (?view=walk).
  setState({ ...stateFromOptions(opts), view: "plan" });
  const base = dataBase(opts);
  const nav = win.navigator || {};
  const lowDetail = isLowDetail({ matchMedia: typeof win.matchMedia === "function" ? win.matchMedia.bind(win) : undefined, deviceMemory: nav.deviceMemory });
  const perf = { fps: null, decision: "pending", lowDetail };

  const announce = (text) => {
    ui.status.textContent = text;
  };
  // A notice in the chart frame (design/states.html, 2D fallback): word, text, dismiss. Not an error.
  const say = (text, word = "Notice") => {
    announce(text);
    const banner = doc.createElement("div");
    banner.setAttribute("class", "banner banner--float");
    banner.setAttribute("role", "status");
    // Words like 3D, 2D and file names are names here, not measured values.
    banner.setAttribute("data-nonmetric", "");
    const w = doc.createElement("span");
    w.setAttribute("class", "banner__word");
    w.textContent = word;
    const t = doc.createElement("span");
    t.setAttribute("class", "banner__text");
    t.textContent = text;
    const b = doc.createElement("button");
    b.setAttribute("type", "button");
    b.setAttribute("class", "btn banner__action");
    b.textContent = "Dismiss";
    b.addEventListener("click", () => ui.notice.removeAttribute("data-open"));
    banner.append(w, t, b);
    ui.notice.replaceChildren(banner);
    ui.notice.setAttribute("data-open", "");
  };

  const progress = createProgress(ui.boot, doc);
  const first = await loadFirst(base, (p) => progress.update(p), ui.modal, opts.imagery);
  progress.remove();
  ui.boot.removeAttribute("data-open");
  const { scene, terrain } = first;
  const imageryMode = first.imagery;
  const modes = imageryModes(scene);

  // ---- second stage, at once and in parallel with everything below (request order: core height, core slope, tiles)
  const tileSink = createTileSink();
  const tileProgress = createProgress(ui.boot, doc);
  ui.boot.setAttribute("data-open", "");
  ui.boot.setAttribute("data-compact", "");
  const tiles = withRetry(
    () => loadTiles(scene, base, (name, payload) => tileSink.push(name, payload), {
      halfRes: lowDetail, imagery: imageryMode, onProgress: (p) => tileProgress.update(p),
    }),
    ui.modal,
  );
  const surround = loadImagery(scene, base, imageryMode, (name, bitmap) => tileSink.push(name, bitmap), { parts: ["surround"] })
    .catch((err) => say(`The surround image did not load (${err && err.file ? err.file : "unknown file"}). The overview stays under the core.`));

  const [inputs, layers] = await Promise.all([chooseInputs(first.inputs, (info) => new Promise((resolve) => showError(ui.modal, info, { onContinue: resolve }))), loadLayers()]);
  const data = {
    waypoints: first.waypoints, conditions: first.conditions, dose: first.dose, sep: first.sep,
    inputs, sources: first.sources, scene, layers,
  };
  setState({ inputs: data.inputs, imagery: { mode: imageryMode, loading: false } });

  const host = createViewHost({
    imagery: modes.length
      ? {
          modes,
          mode: imageryMode,
          load: (mode, onImage, isCurrent) => loadImagery(scene, base, mode, onImage, { halfRes: lowDetail, isCurrent }),
        }
      : null,
  });
  host.onImagery(({ mode, loading }, err) => {
    setState({ imagery: { mode, loading } });
    if (err) say(`The image did not load (${err && err.file ? err.file : "unknown file"}). The previous image stays.`);
  });
  host.setCoreTile("overview", first.textures.overview);

  // Both renderers start with no textures: the host replays everything it recorded, overview first.
  const views = { scene, terrain, textures: {} };
  let canvas = ui.canvas;
  let refit = () => {};
  const to2d = (text, decision) => {
    if (host.kind === "2d") return;
    if (host.current) {
      try {
        host.current.dispose();
      } catch {
        // the old view is being thrown away
      }
      canvas = freshCanvas(canvas);
    }
    host.attach(createView2d(canvas, views), "2d");
    setState({ renderer: "2d" });
    perf.decision = decision;
    if (text) say(text, "2D view");
    refit();
  };

  const wants2d = getState().renderer === "2d";
  if (wants2d) to2d(undefined, "2d-requested");
  else if (!hasWebgl(doc)) to2d("3D graphics are not available here. You see the 2D map, made from the same files.", "2d-no-webgl");
  else {
    try {
      const mod = env.scene3d || (await import("./scene3d.js"));
      host.attach(mod.createScene3d(canvas, views, { lowDetail, halfRes: lowDetail, background: cssVar(doc, "--ink"), sky: cssVar(doc, "--sky-plain") }), "3d");
      setState({ renderer: "3d" });
      perf.decision = "3d-waiting";
    } catch {
      to2d("3D could not start on this device. You see the 2D map, made from the same files.", "2d-start-failed");
    }
  }
  host.onContextLost(() => to2d("The 3D display was interrupted. You see the 2D map, made from the same files.", "2d-context-lost"));

  let prev = {};
  const attr = (name, value) => {
    if (ui.app && ui.app.getAttribute(name) !== value) ui.app.setAttribute(name, value);
  };
  const apply = (s) => {
    if (s.view !== prev.view) {
      host.setView(s.view);
      attr("data-view", s.view);
    }
    attr("data-step", String(s.step));
    attr("data-sources", s.showSources ? "on" : "off");
    attr("data-explore", s.explore ? "on" : "off");
    attr("data-drawer", s.drawer ? "open" : "closed");
    if (s.renderer !== prev.renderer) attr("data-renderer", s.renderer);
    if (s.exaggeration !== prev.exaggeration) host.setExaggeration(s.exaggeration);
    if (s.layers !== prev.layers) for (const id of LAYER_IDS) host.setLayer(id, s.layers.includes(id));
    prev = s;
  };
  apply(getState());
  subscribe(apply);

  // A layout change (window size, the drawer, the caption plate) fits the step's view again once the page has settled.
  let relayoutPending = false;
  let refitLayout = null;
  const relayout = () => {
    if (relayoutPending) return;
    relayoutPending = true;
    onNextFrame(() => {
      relayoutPending = false;
      if (typeof refitLayout === "function") refitLayout();
    });
  };
  const resize = () => {
    host.resize();
    relayout();
  };
  win.addEventListener("resize", resize);
  win.addEventListener("orientationchange", resize);
  let prevDrawer = getState().drawer;
  subscribe((s) => {
    if (s.drawer !== prevDrawer) {
      prevDrawer = s.drawer;
      relayout();
    }
  });

  let ctx = null;
  const controller = createController({
    store: { getState, setState, subscribe }, host, data, terrain, plannerFactory: env.plannerFactory || workerPlanner,
    defaults: first.inputs, announce,
    fit: () => (ctx ? fitRoute(ctx, doc, STORY_PAD_M) : false),
    freeArea: () => (ctx ? sceneFree(ctx.regions, doc) : null),
    motion: {
      reduced: () => typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches,
      hidden: () => doc.visibilityState === "hidden",
    },
  });
  const { actions } = controller;
  refit = () => controller.applyCamera();
  refitLayout = () => controller.actions.relayout();
  if (typeof win.ResizeObserver === "function" && ui.story) new win.ResizeObserver(relayout).observe(ui.story);

  // The core grids go to the terrain (planner, heights) and to the host (the 3D view builds the core mesh); the
  // planner runs the moment both grids are in, without waiting for the image tiles or the speed test.
  const buffers = {};
  let coreDone = false;
  let markCoreIn;
  const coreIn = new Promise((resolve) => {
    markCoreIn = resolve;
  });
  const coreReady = () => {
    if (coreDone || !buffers.dem_core || !buffers.slope_core) return;
    let height;
    let slope;
    try {
      height = toUint16(buffers.dem_core, scene.core.dem_samples ** 2, scene.core.dem);
      slope = toUint8(buffers.slope_core, scene.core.slope_cells ** 2, scene.core.slope);
    } catch (err) {
      throw { file: scene.core.dem, status: 200, reason: err.message };
    }
    coreDone = true;
    terrain.setCore(height, slope);
    host.setCoreTerrain(height, slope);
    actions.replan();
    markCoreIn();
  };
  tileSink.attach((name, payload) => {
    if (name === "dem_core" || name === "slope_core") {
      buffers[name] = payload;
      coreReady();
    } else host.setCoreTile(name, payload);
  });

  ctx = {
    store: { getState, setState, subscribe }, host, data, terrain, actions, controller, opts,
    regions: {
      head: ui.head, story: ui.story, drawer: ui.drawer, dock: ui.drawer, labels: ui.labels, hud: ui.hud,
      modal: ui.modal, status: ui.status,
    },
    view: host, scene,
  };
  // In a browser the audit also checks what shows: the origin labels show with "Show sources" on, in the drawer and
  // on the route card, and nowhere else (the helmet's science line keeps its sol and local time).
  const shown = (el) => {
    if (!el || typeof el.getClientRects !== "function" || el.getClientRects().length === 0) return false;
    try {
      return win.getComputedStyle(el).visibility !== "hidden";
    } catch {
      return true;
    }
  };
  const auditView = {
    isShown: shown,
    wantsLabel(n) {
      if (typeof n.closest !== "function") return null;
      // The hours table names the sol and the source in its heading, not in every cell (components.css).
      if (n.closest(".hours")) return null;
      if (n.closest(".drawer, .sheet")) return true;
      if (getState().showSources) return true;
      if (n.getAttribute("data-prov") === "measured" && n.closest(".hud__science, .hud-card")) return null;
      return false;
    },
  };
  win.__marswalk = {
    state: getState,
    actions,
    controller,
    get controllerState() {
      const s = getState();
      return { plan: s.plan, walk: s.walk, inputs: s.inputs, panel: s.panel, view: s.view, step: s.step };
    },
    view: host,
    perf,
    get renderer() {
      return host.kind;
    },
    setImagery: (mode) => host.setImagery(mode),
    audit: () => audit(doc.body, typeof win.getComputedStyle === "function" ? auditView : null),
  };
  const started = controller.applyStartOptions(opts);
  await mountModules(ctx, env.modules || MODULES);

  // The address follows the story step, so every screen can be opened again from its link (no reload, no request).
  let lastSearch = null;
  subscribe((s) => {
    if (!win.history || typeof win.history.replaceState !== "function") return;
    const search = stepSearch(win.location.search, s.step, s.showSources, s.drawer ? s.panel : null);
    if (search === lastSearch) return;
    lastSearch = search;
    if (search !== win.location.search) {
      try {
        win.history.replaceState(null, "", `${win.location.pathname || ""}${search}`);
      } catch {
        // a sandboxed frame may refuse; the story still works
      }
    }
  });

  // One key handler, added after the modules: a module that handled a key (preventDefault) wins.
  const modalOpen = () => ui.modal.hasAttribute("data-open") || !!doc.querySelector('[aria-modal="true"]');
  // Skip link: first Tab stop, moves the focus to the story's Next button.
  const skip = doc.querySelector(".skip-link");
  if (skip) {
    skip.addEventListener("click", (e) => {
      const go = doc.getElementById("story-next");
      if (!go) return;
      e.preventDefault();
      go.focus();
    });
  }
  // Any input anywhere in the app stops the slow turn of step 1 for good.
  const stopTurn = () => actions.stopTurn();
  for (const t of ["pointerdown", "wheel", "touchstart"]) (ui.app || ui.labels.parentNode)?.addEventListener?.(t, stopTurn, { passive: true });
  doc.addEventListener("keydown", (e) => {
    stopTurn();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (modalOpen()) return;
    const s = getState();
    const t = e.target;
    if (e.key === "Escape") {
      if (s.picked !== null) actions.pickStation(null);
      else if (s.drawer) {
        actions.setDrawer(false);
        doc.getElementById("story-details")?.focus?.();
      } else return;
      e.preventDefault();
      return;
    }
    if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
    if (s.view === "walk" && !e.repeat) {
      const name = walkKeyAction(e.key);
      if (name) {
        e.preventDefault();
        actions[name]();
        return;
      }
    }
    const mapFocused = !!t && t.tagName === "CANVAS";
    const story = s.explore ? null : storyKeyAction(e.key, { target: t, mapFocused });
    if (story) {
      e.preventDefault();
      const go = storyKeyGo(story, { step: s.step, planStatus: s.plan.status, repeat: e.repeat });
      if (go === "next") actions.nextStep();
      else if (go === "back") actions.prevStep();
      return;
    }
    if (!planKeysAllowed({ view: s.view, modalOpen: false, target: t })) return;
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !mapFocused && !s.explore) return;
    const action = planKeyAction(e.key, e.shiftKey);
    if (!action) return;
    e.preventDefault();
    if (action.name === "pan") host.panBy(action.dx, action.dy);
    else if (action.name === "zoom") host.zoomBy(action.factor);
    else if (action.name === "north") host.resetNorth();
    else if (action.name === "tilt") {
      const cam = host.getCamera();
      const now = cam && Number.isFinite(cam.tilt_deg) ? cam.tilt_deg : 0;
      host.tiltBy(now > 5 ? -now : TILT_UP_DEG);
    }
  });
  if (opts.fps) showFps(host, ui.app);

  // The speed test runs once the core mesh is in, off the loading path (it never holds up a file or the planner).
  const check = runSpeedCheck({
    host, perf, coreIn, doc, testOptions: env.speedTest || {},
    onSlow: () => to2d("3D runs too slowly on this device. You see the 2D map, made from the same files.", "2d-too-slow"),
  }).catch(() => {
    if (host.kind === "3d") perf.decision = "3d-untested";
  });

  await Promise.all([tiles, surround]);
  tileProgress.remove();
  ui.boot.removeAttribute("data-open");
  ui.boot.removeAttribute("data-compact");
  host.markImageryReady();
  await started;
  return { host, perf, check, controller };
}

if (typeof document !== "undefined" && typeof window !== "undefined" && !globalThis.__MARSWALK_NO_AUTOSTART) {
  start().catch((err) => {
    const modal = document.getElementById("layer-modal");
    if (modal) showError(modal, err, { onRetry: () => location.reload() });
  });
}
