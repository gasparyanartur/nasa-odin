// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The real start-up (main.js start) on the real data files with a frame source that never fires (a hidden pane, a
// paused tab): the detail files still load at once, the planner still finds the route, the speed test gives up on
// its wall-clock watchdog and 3D stays. A recording stand-in replaces the WebGL renderer and the screens are left out.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class FText {
  constructor(t) {
    this.nodeType = 3;
    this.nodeValue = String(t);
    this.parentNode = null;
  }
  get textContent() {
    return this.nodeValue;
  }
}

class FEl {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.childNodes = [];
    this.parentNode = null;
    this.handlers = {};
    const styles = {};
    this.style = { setProperty: (k, v) => (styles[k] = v), getPropertyValue: (k) => styles[k] ?? "" };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return k in this.attrs ? this.attrs[k] : null;
  }
  removeAttribute(k) {
    delete this.attrs[k];
  }
  hasAttribute(k) {
    return k in this.attrs;
  }
  appendChild(c) {
    const n = typeof c === "string" ? new FText(c) : c;
    if (n.parentNode) n.parentNode.childNodes = n.parentNode.childNodes.filter((x) => x !== n);
    n.parentNode = this;
    this.childNodes.push(n);
    return n;
  }
  append(...cs) {
    for (const c of cs) this.appendChild(c);
  }
  removeChild(c) {
    this.childNodes = this.childNodes.filter((x) => x !== c);
    c.parentNode = null;
    return c;
  }
  replaceChildren(...cs) {
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    this.append(...cs);
  }
  replaceWith(n) {
    const p = this.parentNode;
    if (!p) return;
    const i = p.childNodes.indexOf(this);
    p.childNodes[i] = n;
    n.parentNode = p;
    this.parentNode = null;
  }
  cloneNode() {
    const c = new FEl(this.ownerDocument, this.tagName);
    c.attrs = { ...this.attrs };
    return c;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  set textContent(t) {
    this.replaceChildren(String(t));
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join("");
  }
  addEventListener(t, fn) {
    (this.handlers[t] ||= []).push(fn);
  }
  removeEventListener() {}
  contains(n) {
    for (let x = n; x; x = x.parentNode) if (x === this) return true;
    return false;
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 1366, bottom: 768, width: 1366, height: 768 };
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getContext(kind) {
    return kind === "webgl2" ? {} : null;
  }
  get clientWidth() {
    return 1366;
  }
  get clientHeight() {
    return 768;
  }
}

function fakeDoc() {
  const doc = { activeElement: null, visibilityState: "visible", handlers: {} };
  doc.createElement = (t) => new FEl(doc, t);
  doc.createElementNS = (ns, t) => new FEl(doc, t);
  doc.createTextNode = (t) => new FText(t);
  doc.body = new FEl(doc, "body");
  doc.documentElement = new FEl(doc, "html");
  doc.addEventListener = (t, fn) => (doc.handlers[t] ||= []).push(fn);
  doc.removeEventListener = () => {};
  doc.querySelector = () => null;
  const ids = {};
  for (const id of ["app", "scene", "boot", "layer-modal", "notice", "status", "story-head", "story", "drawer", "labels", "hud"]) {
    ids[id] = new FEl(doc, id === "scene" ? "canvas" : "div");
    ids[id].setAttribute("id", id);
    doc.body.appendChild(ids[id]);
  }
  doc.getElementById = (id) => ids[id] || null;
  return doc;
}

// Stand-in for scene3d: records what the host hands it.
function fakeScene3d(log) {
  return {
    createScene3d() {
      const fns = { change: new Set() };
      const v = {
        core: null,
        onChange: (fn) => (fns.change.add(fn), () => fns.change.delete(fn)),
        onContextLost: () => () => {},
        onRender: () => () => {},
        setExaggeration() {},
        setLayer() {},
        setRasterLayer() {},
        setCoreTile: (name) => log.tiles.push(name),
        setCoreTerrain: (h, s) => {
          v.core = { h, s };
          log.core = true;
        },
        setOverlay() {},
        setContinuous: (on) => log.continuous.push(on),
        setEye() {},
        setView() {},
        fitBounds: (b) => log.fits.push(b),
        getCamera: () => ({ view: "plan", x: 0, y: 0, tilt_deg: 0, heading_deg: 0 }),
        resize() {},
        dispose() {},
      };
      log.view = v;
      return v;
    },
  };
}

test("start-up with frames that never fire: detail files at once, the route is planned, 3D stays untested", { timeout: 120000 }, async () => {
  const requests = [];
  const raf = [];
  const doc = fakeDoc();
  const win = {
    location: { search: "?step=2" },
    navigator: {},
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
  };
  const saved = {};
  const set = (k, v) => {
    saved[k] = globalThis[k];
    globalThis[k] = v;
  };
  set("__MARSWALK_NO_AUTOSTART", true);
  set("document", doc);
  set("window", win);
  set("requestAnimationFrame", (fn) => {
    raf.push(fn);
    return raf.length;
  });
  set("cancelAnimationFrame", () => {});
  set("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  set("createImageBitmap", async () => ({ width: 1, height: 1 }));
  set("localStorage", { getItem: () => null, setItem() {}, removeItem() {} });
  set("fetch", async (url) => {
    requests.push(String(url).replace(/^.*\/(public\/data\/)?/, ""));
    const buf = await readFile(resolve(APP, String(url)));
    const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return { ok: true, status: 200, body: null, headers: { get: () => null }, arrayBuffer: async () => body };
  });
  try {
    const { start } = await import("../src/main.js");
    const { directPlanner } = await import("../src/controller.js");
    const log = { tiles: [], core: false, continuous: [], fits: [], view: null };
    const out = await start({
      doc, win, modules: [], scene3d: fakeScene3d(log), plannerFactory: directPlanner,
      speedTest: { watchdogMs: 60 },
    });
    const plan = await out.controller.waitForPlan();
    await out.check;

    assert.equal(plan.status, "ok", "the route is planned without a single frame");
    assert.ok(plan.route.total_m > 1000, `route of ${plan.route.total_m} m`);
    assert.ok(log.core, "the 3D view got the core terrain");
    assert.equal(out.host.hasCoreTerrain(), true);
    assert.equal(out.host.kind, "3d");
    assert.equal(out.perf.decision, "3d-untested", "too few frames: the test is skipped and 3D stays");
    assert.deepEqual(log.continuous, [true, false], "the speed test ran once and switched continuous drawing off again");
    assert.ok(log.fits.length >= 1, "the plan camera was fitted to the route");

    // Request order: the detail grids come right after the first view, before the tiles and before layers.json.
    const dem = requests.indexOf("dem_core.bin");
    const slope = requests.indexOf("slope_core.bin");
    const firstTile = requests.findIndex((r) => /core_\d_\d\.webp$/.test(r));
    const layers = requests.indexOf("layers.json");
    assert.ok(dem >= 0 && slope === dem + 1, JSON.stringify(requests));
    assert.ok(firstTile > slope, "tiles after the core grids");
    assert.ok(layers > dem, "the detail grids do not wait for anything after the first view");
    assert.ok(log.tiles.some((t) => /^core_\d_\d$/.test(t)), "the image tiles reached the view");
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
});
