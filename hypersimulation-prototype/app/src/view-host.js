// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// One stable view object for the whole app. It forwards to the current renderer (3D or 2D) and records everything that
// was set on it, so a swap of renderers (slow device, lost context, failed start) replays the whole state.

// Calls that are only forwarded. A renderer without the method gives null.
const FORWARD = [
  "flyTo", "panBy", "zoomBy", "tiltBy", "rotateBy", "resetNorth", "fitView", "fitBounds", "setCentreOffset", "resize", "requestRender",
  "getCamera", "getStats", "dispose",
];

// imagery: {modes: ["colour", "grey"], mode: "colour", load(mode, onImage, isCurrent) -> Promise}. Without it the
// host has one image set and setImagery does nothing.
export function createViewHost({ imagery = null } = {}) {
  let current = null;
  let kind = null;
  const memo = {
    view: "plan",
    exaggeration: 1,
    layers: new Map(),
    rasters: new Map(),
    overlays: new Map(),
    images: new Map(),
    core: null,
    eye: null,
    hillshade: null,
    continuous: null,
  };
  const subs = { change: new Set(), lost: new Set(), render: new Set() };
  const call = (name, ...args) => (current && typeof current[name] === "function" ? current[name](...args) : null);

  // ---- imagery
  const cfg = imagery && Array.isArray(imagery.modes) && imagery.modes.length ? imagery : null;
  const imageryFns = new Set();
  let imageryState = { mode: cfg ? cfg.mode || cfg.modes[0] : null, loading: false };
  let stable = { mode: imageryState.mode, images: null };
  let ready = false;
  let queued = null;
  let seq = 0;

  function emitImagery(error = null) {
    for (const fn of [...imageryFns]) fn({ ...imageryState }, error);
  }

  function restoreImages(map) {
    memo.images = new Map(map);
    for (const [name, img] of memo.images) call("setCoreTile", name, img);
  }

  async function switchImagery(mode) {
    if (mode === imageryState.mode) return true;
    if (mode === stable.mode) {
      // Back to the set that is already complete: no download, the held images come back.
      seq++;
      if (stable.images) restoreImages(stable.images);
      stable.images = null;
      imageryState = { mode, loading: false };
      emitImagery();
      return true;
    }
    if (!stable.images) stable.images = new Map(memo.images);
    const mine = ++seq;
    imageryState = { mode, loading: true };
    emitImagery();
    try {
      await cfg.load(
        mode,
        (name, bitmap) => {
          if (mine === seq) host.setCoreTile(name, bitmap);
        },
        () => mine === seq,
      );
    } catch (err) {
      if (mine !== seq) return false;
      restoreImages(stable.images);
      stable.images = null;
      imageryState = { mode: stable.mode, loading: false };
      emitImagery(err);
      return false;
    }
    if (mine !== seq) return false;
    stable = { mode, images: null };
    imageryState = { mode, loading: false };
    emitImagery();
    return true;
  }

  // ---- the host
  const host = {
    get kind() {
      return kind;
    },
    get current() {
      return current;
    },
    attach(view, nextKind) {
      current = view;
      kind = nextKind;
      view.onChange(() => {
        if (current === view) for (const fn of [...subs.change]) fn();
      });
      view.onContextLost(() => {
        if (current === view) for (const fn of [...subs.lost]) fn();
      });
      if (typeof view.onRender === "function") {
        view.onRender((t) => {
          if (current === view) for (const fn of [...subs.render]) fn(t);
        });
      }
      view.setExaggeration(memo.exaggeration);
      for (const [id, on] of memo.layers) view.setLayer(id, on);
      for (const [id, spec] of memo.rasters) view.setRasterLayer(id, spec);
      for (const [name, img] of memo.images) view.setCoreTile(name, img);
      if (memo.core && typeof view.setCoreTerrain === "function") view.setCoreTerrain(memo.core.height, memo.core.slope);
      for (const [id, spec] of memo.overlays) view.setOverlay(id, spec);
      if (memo.hillshade !== null && typeof view.setHillshade === "function") view.setHillshade(memo.hillshade);
      if (memo.continuous !== null && typeof view.setContinuous === "function") view.setContinuous(memo.continuous);
      if (memo.eye) view.setEye(memo.eye);
      view.setView(memo.view);
    },
    setView(name) {
      memo.view = name;
      call("setView", name);
    },
    setExaggeration(n) {
      memo.exaggeration = n;
      call("setExaggeration", n);
    },
    setLayer(id, on) {
      memo.layers.set(id, on);
      call("setLayer", id, on);
    },
    setOverlay(id, spec) {
      if (spec === null || spec === undefined) memo.overlays.delete(id);
      else memo.overlays.set(id, spec);
      call("setOverlay", id, spec);
    },
    setRasterLayer(id, spec) {
      if (spec === null || spec === undefined) memo.rasters.delete(id);
      else memo.rasters.set(id, spec);
      call("setRasterLayer", id, spec);
    },
    // Image names: "overview", "surround", "core_half", "core_r_c".
    setCoreTile(name, bitmap) {
      memo.images.set(name, bitmap);
      call("setCoreTile", name, bitmap);
    },
    // The 1 m core height grid (Uint16Array) and slope grid. Only the 3D view draws terrain.
    setCoreTerrain(height, slope = null) {
      memo.core = { height, slope };
      call("setCoreTerrain", height, slope);
    },
    // True once the 1 m core grids were handed over (every renderer gets them on attach).
    hasCoreTerrain: () => !!memo.core,
    // The image last handed over under this name (the walk map inset draws the surround image), or null.
    image: (name) => memo.images.get(name) || null,
    setEye(eye) {
      memo.eye = eye;
      call("setEye", eye);
    },
    setHillshade(on) {
      memo.hillshade = !!on;
      call("setHillshade", !!on);
    },
    setContinuous(on) {
      memo.continuous = !!on;
      call("setContinuous", !!on);
    },
    onChange(fn) {
      subs.change.add(fn);
      return () => subs.change.delete(fn);
    },
    onContextLost(fn) {
      subs.lost.add(fn);
      return () => subs.lost.delete(fn);
    },
    // Fires once per rendered frame with a timestamp in ms. Both renderers call it from their draw step.
    onRender(fn) {
      subs.render.add(fn);
      return () => subs.render.delete(fn);
    },
    pick: (...args) => call("pick", ...args),
    project: (...args) => call("project", ...args) || { sx: 0, sy: 0, visible: false },

    // ---- imagery modes
    imageryModes: () => (cfg ? [...cfg.modes] : []),
    getImagery: () => ({ ...imageryState }),
    // Mode switches asked before the first load has finished wait here and run when markImageryReady() is called.
    markImageryReady() {
      ready = true;
      if (queued !== null) {
        const mode = queued;
        queued = null;
        return switchImagery(mode);
      }
      return Promise.resolve(true);
    },
    setImagery(mode) {
      if (!cfg || !cfg.modes.includes(mode)) return Promise.resolve(false);
      if (!ready) {
        queued = mode === imageryState.mode ? null : mode;
        return Promise.resolve(false);
      }
      return switchImagery(mode);
    },
    onImagery(fn) {
      imageryFns.add(fn);
      return () => imageryFns.delete(fn);
    },
  };
  for (const name of FORWARD) host[name] = (...args) => call(name, ...args);
  return host;
}
