// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Pure helpers of the plan screens, then the story shell and the drawer modules mounted on a small fake DOM with the
// real controller: a typo or a digit outside num() shows up here, not first in the browser.
import test from "node:test";
import assert from "node:assert/strict";
import { placeLabels, routeCoords, pointAlong, pathUpTo, walkedCoords, polygonCentre, walkLabelIds, mount as mountOverlays } from "../src/ui/route-overlays.js";
import { mount as mountMapControls, northRotation, holdToRepeat, HINT, HINT_MS, hintSeen, markHintSeen } from "../src/ui/map-controls.js";
import { profileShapes, profileTicks, tPlus, sliderStep, mount as mountTimeline } from "../src/ui/timeline.js";
import { minimumRows, routeTotals, legText, mount as mountMinimums } from "../src/ui/minimums.js";
import { describeBlocking, mount as mountNoRoute } from "../src/ui/no-route.js";
import { railStops, unsetValues, mount as mountCard } from "../src/ui/route-card.js";
import { nextTab, TABS, mount as mountDrawer } from "../src/ui/drawer.js";
import { IMAGE_LABELS, creditText, mount as mountDisplay } from "../src/ui/display.js";
import { mount as mountStory } from "../src/ui/story.js";
import { mount as mountMinimap, insetBox } from "../src/ui/minimap.js";
import { trackFiles } from "../src/ui/progress.js";
import { errorTitle, statusLine } from "../src/ui/error.js";
import { walkKeyAction, mountModules, MODULES } from "../src/main.js";
import { buildConstraints } from "../src/constraints.js";
import { createController, directPlanner } from "../src/controller.js";
import { createStore, initialState, LAYER_IDS } from "../src/state.js";
import { createTerrain } from "../src/terrain.js";
import { audit, num } from "../src/provenance.js";
import { readFileSync } from "node:fs";
import { mount as mountHud } from "../src/ui/hud.js";
import { mount as mountStationCards } from "../src/ui/station-card.js";
import { mount as mountLayers } from "../src/ui/layer-panel.js";
import { mount as mountCredits } from "../src/ui/credits.js";

// ---------------------------------------------------------------- pure helpers

test("placeLabels: a second tag moves aside, a colliding leg label hides, off-screen labels hide", () => {
  const items = [
    { id: "a", kind: "tag", x: 100, y: 100, w: 60, h: 20 },
    { id: "b", kind: "tag", x: 100, y: 112, w: 60, h: 20 },
    { id: "leg", kind: "leg", x: 140, y: 90, w: 50, h: 16 },
    { id: "far", kind: "leg", x: 2000, y: 90, w: 50, h: 16 },
  ];
  const out = placeLabels(items, { w: 800, h: 600 });
  assert.equal(out.get("a").place, "right");
  assert.notEqual(out.get("b").place, "right");
  assert.ok(out.get("b"));
  assert.equal(out.get("leg"), null);
  assert.equal(out.get("far"), null);
});

test("placeLabels: station and base tags try eight places, then the compact id, and are never dropped", () => {
  // A tag boxed in on the right and left by two others moves above.
  const boxed = placeLabels([
    { id: "l", kind: "tag", x: 100, y: 300, w: 70, h: 22 },
    { id: "r", kind: "tag", x: 300, y: 300, w: 80, h: 22 },
    { id: "s", kind: "tag", x: 200, y: 300, w: 90, h: 22, wc: 30 },
  ], { w: 800, h: 600 });
  assert.equal(boxed.get("l").place, "right");
  assert.equal(boxed.get("s").compact, false);
  assert.ok(["above", "below", "above-right", "below-right", "above-left", "below-left"].includes(boxed.get("s").place));
  // Every full place blocked, the compact form fits in a gap.
  const walls = [
    { x: 150, y: 0, w: 400, h: 288 }, { x: 150, y: 312, w: 400, h: 300 }, { x: 0, y: 0, w: 188, h: 600 }, { x: 240, y: 0, w: 400, h: 600 },
  ];
  const tight = placeLabels([{ id: "s4", kind: "tag", x: 200, y: 300, w: 120, h: 22, wc: 28 }], { w: 800, h: 600 }, walls);
  const t = tight.get("s4");
  assert.ok(t, "never nothing");
  assert.equal(t.compact, true, "compact id alone");
  // Nowhere free at all: still the compact form, forced on the right.
  const full = placeLabels([{ id: "base", kind: "tag", x: 200, y: 300, w: 160, h: 22, wc: 50 }], { w: 800, h: 600 }, [{ x: 0, y: 0, w: 800, h: 600 }]);
  assert.equal(full.get("base").compact, true);
  assert.equal(full.get("base").forced, true);
  assert.equal(full.get("base").place, "right");
  // A tag at the right screen edge flips left instead of leaving the screen.
  const edge = placeLabels([{ id: "base", kind: "tag", x: 780, y: 100, w: 160, h: 22, wc: 50 }], { w: 800, h: 600 });
  assert.equal(edge.get("base").place, "left");
  assert.equal(edge.get("base").compact, false);
  // Leg labels are the ones that hide.
  const legs = placeLabels([
    { id: "s1", kind: "tag", x: 100, y: 100, w: 60, h: 20 },
    { id: "leg", kind: "leg", x: 135, y: 100, w: 50, h: 16 },
  ], { w: 800, h: 600 });
  assert.ok(legs.get("s1"));
  assert.equal(legs.get("leg"), null);
});

test("route geometry: joined coords, point along, path up to a point, walked part", () => {
  const route = { ok: true, legs: [
    { path: [[0, 0], [10, 0]], to: { id: 1 } },
    { path: [[10, 0], [10, 10]], to: { id: "base" } },
  ] };
  assert.deepEqual(routeCoords(route), [[0, 0], [10, 0], [10, 10]]);
  assert.deepEqual(pointAlong(route.legs[0].path, 0.5), { x: 5, y: 0 });
  assert.deepEqual(pathUpTo([[0, 0], [10, 0], [10, 10]], { x: 10, y: 4 }), [[0, 0], [10, 0], [10, 4]]);
  const walk = { t_s: 12, snapshot: { mode: "walk", leg_index: 1, pos: { x: 10, y: 3 } } };
  assert.deepEqual(walkedCoords(route, walk), [[0, 0], [10, 0], [10, 3]]);
  assert.deepEqual(walkedCoords(route, { t_s: 0, snapshot: walk.snapshot }), []);
  const back = { t_s: 20, snapshot: { mode: "return", pos: { x: 5, y: 5 } }, return_leg: { path: [[10, 3], [0, 0]] }, return_from: { pos: { x: 10, y: 3 }, leg_index: 1, mode: "walk" } };
  const w = walkedCoords(route, back);
  assert.deepEqual(w[0], [0, 0]);
  assert.deepEqual(w.at(-1), [5, 5]);
});

test("profile shapes and ticks: ground closes to the baseline, close stations share one tick", () => {
  const profile = {
    points: [{ d_m: 0, h_m: 0 }, { d_m: 50, h_m: 10 }, { d_m: 100, h_m: 0 }],
    stations: [{ id: "base", d_m: 0 }, { id: 1, d_m: 50 }, { id: 2, d_m: 52 }, { id: "base", d_m: 100 }],
    min_m: 0, max_m: 10, total_m: 100,
  };
  const s = profileShapes(profile, 1000, 100);
  assert.match(s.line, /^M0 100L500 0L1000 100$/);
  assert.match(s.ground, /^M0 100L0 100L500 0L1000 100L1000 100Z$/);
  assert.deepEqual(s.drops, [500, 520]);
  assert.deepEqual(profileTicks(profile), [{ at: 0.5, label: "S1 S2" }]);
  assert.equal(profileShapes(null), null);
  assert.equal(tPlus(3900), "T+ 1:05");
  assert.equal(tPlus(null), null);
  assert.equal(sliderStep("ArrowRight", false), 60);
  assert.equal(sliderStep("ArrowLeft", true), -600);
  assert.equal(sliderStep("x", false), 0);
});

const P = (value) => ({ value, placeholder: false });
function inputsFixture(over = {}) {
  return {
    placeholder: false, signed_off_by: null,
    base: { x: -15.5, y: 0.5, label: "Crew rover, parked at the Curiosity position of sol 4534", assumption: true },
    walking_speed_m_s: P(1), work_time_min_per_station: P(1), partner_trail_m: P(20), hazard_start_min: P(1), start_lmst_hour: P(9),
    stations: [
      { id: 1, x: 10.5, y: 10.5, kind: "ridge", on_path: false, task: "Dig a trench 20 cm deep", photo: null, placeholder: { position: false, kind: false, task: false } },
      { id: 2, x: 10.5, y: -10.5, kind: "hollow", on_path: false, task: "Bag a chip", photo: null, placeholder: { position: false, kind: false, task: false } },
    ],
    no_go: [], drill_sites: [],
    ...over,
  };
}
const doseFixture = { sol: 4600, dose_rate: { value: null }, fallback: { value: 0.21, unit: "mGy/day" }, dose_equivalent_rate: { value: 0.64 } };

test("minimum rows: margin, bar share, state and provenance per limit", () => {
  const route = { ok: true, total_m: 100, legs: [{ max_slope_deg: 13, climb_m: 2, path: [[-15.5, 0.5], [10, 10]] }, { max_slope_deg: 5, climb_m: 1, path: [[10, 10], [-15.5, 0.5]] }] };
  const rows = minimumRows(buildConstraints({ route, inputs: inputsFixture(), dose: doseFixture }));
  assert.deepEqual(rows.map((r) => r.id), ["slope_cap", "rover_range", "partner_spacing", "suit_time", "walk_dose", "career_dose"]);
  const slope = rows[0];
  assert.equal(slope.state, "caution");
  assert.ok(Math.abs(slope.left - 2 / 15) < 1e-9);
  assert.equal(slope.value.prov, "derived");
  assert.equal(slope.assumedBase, true);
  assert.equal(rows[2].value.prov, "assumption");
  assert.ok(Array.isArray(rows[3].value.value), "suit time as h and min parts");
  assert.equal(rows[5].body, "All - NASA-STD-3001 Vol 1 via OCHMO; rate Hassler 2014");
  assert.deepEqual(rows[5].cites.map((c) => c.code), ["STD1", "HA14"]);
  assert.equal(rows[4].state, "info");
  assert.equal(rows[4].limit, null);
  assert.equal(rows[4].value.unit, "mGy");
  assert.equal(rows[4].value.prov, "assumption");
  const none = minimumRows(buildConstraints({ route: null, inputs: inputsFixture(), dose: doseFixture }));
  assert.equal(none[0].state, "nodata");
  assert.equal(none[2].state, "pass");
  assert.deepEqual(routeTotals(route), { distance_m: 100, climb_m: 3 });
  assert.deepEqual(routeTotals(null), { distance_m: null, climb_m: null });
});

test("describeBlocking names the station and the limit, in words without digits", () => {
  const inputs = inputsFixture();
  const a = describeBlocking({ limit: "slope_cap", station_id: 2, detail: "No path from 1 to 2; lifting the slope_cap limit (with those before it) opens one." }, inputs);
  assert.equal(a.station.id, "S2");
  assert.equal(a.station.kind, "hollow");
  assert.equal(a.name, "Slope cap");
  assert.equal(a.limit.value, 15);
  assert.equal(a.showSlope, true);
  assert.ok(!/\d/.test(a.why));
  const b = describeBlocking({ limit: "no_go", station_id: 1, detail: "Point 1 lies inside a no-go zone." }, inputs);
  assert.match(b.why, /sits inside a no-go zone/);
  const c = describeBlocking({ limit: "slope_cap", station_id: "base", detail: "No path from 2 to base, even with every limit lifted." }, inputs);
  assert.equal(c.station.id, "BASE");
  assert.equal(c.name, "Cut off");
  for (const x of [a, b, c]) assert.ok(!/\d/.test(x.why + x.name + x.station.text));
});

test("route card rows: legs between stops, arrival times from the schedule, unset values in words", () => {
  const route = { ok: true, legs: [
    { distance_m: 30, climb_m: 1, max_slope_deg: 4, bearing_deg: 45, to: { id: 1 } },
    { distance_m: 20, climb_m: 0, max_slope_deg: 3, bearing_deg: 180, to: { id: 2 } },
    { distance_m: 25, climb_m: 0.5, max_slope_deg: 2, bearing_deg: 270, to: { id: "base" } },
  ] };
  const schedule = { duration_s: 195, blocks: [{ kind: "work", station_id: 1, t0: 30 }, { kind: "work", station_id: 2, t0: 110 }] };
  const rows = railStops(route, schedule, inputsFixture());
  assert.deepEqual(rows.map((r) => r.type), ["stop", "leg", "stop", "leg", "stop", "leg", "stop"]);
  assert.equal(rows[1].bearing, "045");
  assert.equal(rows[1].time_s, 30);
  assert.equal(rows[2].id, "S1");
  assert.equal(rows[2].t, 30);
  assert.equal(rows[0].lmst, "09:00");
  assert.equal(rows[6].kind, "end of walk");
  assert.equal(rows[6].t, 195);
  const loose = inputsFixture({ walking_speed_m_s: { value: 1, placeholder: true } });
  loose.stations[1].placeholder.task = true;
  assert.deepEqual(unsetValues(loose), ["walking speed", "station 2 task"]);
  assert.deepEqual(unsetValues(inputsFixture()), []);
});

test("drawer tabs, image labels, progress files, error titles, walk keys", () => {
  assert.deepEqual(TABS.map((t) => t[1]), ["Limits", "Timeline", "Layers", "Stations", "Editor", "Rover check", "Credits"]);
  assert.equal(nextTab("limits", "ArrowRight"), "timeline");
  assert.equal(nextTab("limits", "ArrowLeft"), "credits");
  assert.equal(nextTab("rover", "End"), "credits");
  assert.equal(nextTab("rover", "x"), null);
  assert.match(creditText("colour"), /not a true-colour claim/);
  assert.deepEqual(insetBox({ base: { x: 0, y: 0 }, stations: [{ x: 100, y: 20 }] }, null, 10), { x0: -10, y0: -50, x1: 110, y1: 70 });
  assert.equal(IMAGE_LABELS.colour, "HiRISE colour mosaic (USGS, July 2025) - band mix not stated by USGS; not a true-colour claim");
  assert.equal(IMAGE_LABELS.grey, "Greyscale mosaic (USGS, 25 cm)");
  let files = trackFiles([], "scene.json");
  files = trackFiles(files, "dem_surround.bin");
  assert.deepEqual(files.map((f) => f.state), ["done", "loading"]);
  assert.equal(errorTitle({ kind: "data", file: "slope_core.bin" })[0], "The slope grid did not load");
  assert.equal(statusLine(404), "HTTP 404 - not found on this host");
  assert.equal(walkKeyAction("N"), "next");
  assert.equal(walkKeyAction("a"), "acknowledge");
  assert.equal(walkKeyAction("r"), "returnToRover");
  assert.equal(walkKeyAction("Escape"), null, "the story steps leave the walk, not Escape");
  assert.equal(walkKeyAction("t"), null);
});

test("mountModules skips a missing or failing module and mounts the rest", async () => {
  const seen = [];
  const mods = {
    a: { mount: () => { seen.push("a"); return () => {}; } },
    b: null,
    c: { mount: () => { throw new Error("boom"); } },
    d: { mount: () => { seen.push("d"); } },
  };
  const out = await mountModules({}, ["a", "b", "c", "d", "e"], async (n) => {
    if (n === "e") throw new Error("missing");
    return mods[n];
  });
  assert.deepEqual(seen, ["a", "d"]);
  assert.deepEqual(out.map((m) => m.name), ["a", "d"]);
  assert.equal(MODULES[0], "drawer", "the drawer first: the panels mount into it");
  assert.equal(MODULES.at(-1), "story");
  for (const gone of ["dock", "brief", "strip"]) assert.ok(!MODULES.includes(gone));
});

// ---------------------------------------------------------------- fake DOM smoke test

class FText {
  constructor(v) { this.nodeType = 3; this.nodeValue = String(v); this.parentNode = null; }
  get textContent() { return this.nodeValue; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
}
class FEl {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.nodeType = 1; this.attrs = {}; this.childNodes = [];
    this.parentNode = null; this.handlers = {}; this.hidden = false; this.scrollTop = 0;
    const styles = {};
    this.style = { setProperty: (k, v) => { styles[k] = v; }, getPropertyValue: (k) => styles[k] ?? "" };
    const self = this;
    this.classList = {
      list: () => (self.attrs.class || "").split(/\s+/).filter(Boolean),
      add(...c) { self.attrs.class = [...new Set([...this.list(), ...c])].join(" "); },
      remove(...c) { self.attrs.class = this.list().filter((x) => !c.includes(x)).join(" "); },
      toggle(c, on) { (on ?? !this.contains(c)) ? this.add(c) : this.remove(c); },
      contains(c) { return this.list().includes(c); },
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  toggleAttribute(k, on) { if (on ?? !(k in this.attrs)) this.attrs[k] = ""; else delete this.attrs[k]; }
  scrollIntoView() {}
  prepend(...cs) { const ns = cs.map((c) => this.adopt(c)); this.childNodes.unshift(...ns); }
  after(...cs) { const p = this.parentNode; if (!p) return; const i = p.childNodes.indexOf(this); for (const c of cs) p.adopt(c); p.childNodes.splice(i + 1, 0, ...cs.map((c) => (typeof c === "string" ? new FText(c) : c))); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get offsetWidth() { return 60; }
  get offsetHeight() { return 20; }
  get clientWidth() { return 1000; }
  get clientHeight() { return 700; }
  adopt(c) {
    const n = typeof c === "string" ? new FText(c) : c;
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this;
    return n;
  }
  appendChild(c) { const n = this.adopt(c); this.childNodes.push(n); return n; }
  append(...cs) { for (const c of cs) this.appendChild(c); }
  insertBefore(c, ref) {
    const n = this.adopt(c);
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(n);
    else this.childNodes.splice(i, 0, n);
    return n;
  }
  removeChild(c) { this.childNodes = this.childNodes.filter((x) => x !== c); c.parentNode = null; return c; }
  replaceChild(n, old) { const i = this.childNodes.indexOf(old); this.adopt(n); this.childNodes[i] = n; old.parentNode = null; return old; }
  replaceChildren(...cs) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...cs); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(t) { this.replaceChildren(String(t)); }
  addEventListener(t, fn) { (this.handlers[t] ||= []).push(fn); }
  removeEventListener() {}
  fire(t, e = {}) { for (const fn of this.handlers[t] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...e }); }
  click() { this.fire("click"); }
  focus() { this.ownerDocument.activeElement = this; }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 30 }; }
  all(out = []) { for (const c of this.childNodes) if (c.nodeType === 1) { out.push(c); c.all(out); } return out; }
  querySelectorAll(sel) {
    return this.all().filter((n) => sel.split(",").map((x) => x.trim()).some((one) => {
      if (one.startsWith("#")) return n.attrs.id === one.slice(1);
      if (one.startsWith(".")) return n.classList.contains(one.slice(1));
      const m = one.match(/^\[([a-z-]+)="(.*)"\]$/);
      if (m) return n.attrs[m[1]] === m[2];
      return n.tagName === one.toUpperCase();
    }));
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function fakeDoc() {
  const doc = { activeElement: null };
  doc.createElement = (t) => new FEl(doc, t);
  doc.createElementNS = (ns, t) => new FEl(doc, t);
  doc.createTextNode = (t) => new FText(t);
  doc.body = new FEl(doc, "body");
  doc.documentElement = new FEl(doc, "html");
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};
  doc.getElementById = (id) => doc.body.querySelector(`#${id}`);
  doc.querySelector = (sel) => doc.body.querySelector(sel);
  doc.querySelectorAll = (sel) => doc.body.querySelectorAll(sel);
  return doc;
}

const N = 40;
const scene = {
  core: { size_m: N, dem_samples: N + 1, slope_cells: N },
  surround: { size_m: 2 * N, dem_samples: N + 1 },
  height: { offset_m: -100, scale_m: 0.01, nodata: 65535 },
  slope: { scale_deg: 0.25, nodata: 255 },
  ground_scale: { x: 1, y: 1 },
};
function terrainFixture() {
  const slope = new Uint8Array(N * N);
  const s = N + 1;
  const core = new Uint16Array(s * s);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) core[j * s + i] = Math.round((0.1 * i + 100) / 0.01);
  return createTerrain(scene, { core, surround: new Uint16Array(s * s).fill(10000), slope });
}

function world(inputs = inputsFixture(), more = null, start = { step: 2 }) {
  const doc = fakeDoc();
  const app = doc.createElement("div");
  doc.body.appendChild(app);
  const mk = (id, tag = "div") => {
    const e = doc.createElement(tag);
    e.setAttribute("id", id);
    return e;
  };
  const frame = doc.createElement("div");
  const labels = mk("labels");
  frame.appendChild(labels);
  const head = mk("story-head", "header");
  const story = mk("story");
  const drawer = mk("drawer", "aside");
  for (const [id] of TABS) drawer.appendChild(mk(`panel-${id}`, "section"));
  app.append(frame, head, story, drawer);
  const overlays = new Map();
  const host = {
    kind: "3d",
    setView() {}, setEye() {}, setOverlay: (id, spec) => (spec ? overlays.set(id, spec) : overlays.delete(id)),
    project: (x, y) => ({ sx: 500 + x * 10, sy: 350 - y * 10, visible: true }), onChange: () => () => {},
    imageryModes: () => ["colour", "grey"], setImagery: () => Promise.resolve(true),
    flyTo() {}, fitBounds() {}, rotateBy() {}, image: () => null,
  };
  const store = createStore({ ...initialState(), inputs, ...start });
  const data = { scene, inputs, dose: doseFixture, sep: { sepID: "x", eventTime: "2025-05-13T18:14Z" }, conditions: { sol: 4600, earth_date: "2025-07-15", hours: [] }, ...(more ? more.data : {}) };
  const controller = createController({ store, host, data, terrain: terrainFixture(), plannerFactory: directPlanner, clock: { now: () => 0, frame: () => 1, cancel() {} } });
  const extra = more ? more.regions(mk) : {};
  for (const e of Object.values(extra)) app.appendChild(e);
  const ctx = { store, host, data, terrain: terrainFixture(), actions: controller.actions, opts: { data: "real" }, regions: { head, story, drawer, dock: drawer, labels, ...extra } };
  globalThis.document = doc;
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  globalThis.print = () => { globalThis.__printed = true; };
  const offs = [mountDrawer, mountDisplay, mountNoRoute, mountMinimums, mountTimeline, mountOverlays, mountCard, mountStory, ...(more ? more.mounts : [])].map((m) => m(ctx));
  return { doc, app, drawer, head, story, labels, overlays, store, controller, a: controller.actions, offs, ctx };
}

test("smoke: the plan step mounts, renders a planned route and passes the number audit", async () => {
  const w = world();
  await w.a.replan();
  assert.equal(w.store.getState().plan.status, "ok");
  // The drawer is closed: out of the page; opening it puts it back with seven tabs.
  assert.equal(w.drawer.parentNode, null);
  w.a.setDrawer(true);
  assert.equal(w.drawer.parentNode, w.app);
  assert.equal(w.drawer.querySelectorAll(".tabs__tab").length, 7);
  const limits = w.drawer.querySelector("#panel-limits");
  assert.equal(limits.querySelectorAll("tr").length, 13, "header and six limits of two lines each");
  assert.equal(limits.querySelectorAll(".minimums__r1").length, 6);
  assert.ok(limits.querySelectorAll(".cite").length >= 6, "each limit names its source code");
  assert.ok(limits.childNodes.at(-1).classList.contains("map-key-plate"), "the map key sits at the foot of the Limits tab");
  assert.ok(w.drawer.querySelector("#panel-timeline").querySelectorAll(".score__block").length >= 5);
  assert.ok(w.drawer.querySelector("#panel-layers").querySelector(".view-plate"), "the vertical scale sits in the Layers tab");
  assert.ok(w.overlays.has("route") && w.overlays.has("stations-ridge") && w.overlays.has("stations-hollow") && w.overlays.has("base"));
  assert.ok(!w.labels.querySelectorAll(".leg-tag").length, "no leg labels on the plan step");
  assert.ok(w.labels.querySelectorAll(".map-tag").length >= 3);
  assert.deepEqual(audit(w.doc.body), []);
  w.a.setDrawer(false);
  assert.equal(w.drawer.parentNode, null);
  // a station label opens its small card next to it, with the task, and Close closes it
  w.labels.querySelector("[data-station=\"1\"]").click();
  assert.equal(w.store.getState().picked, 1);
  const pop = w.labels.querySelector(".station-pop");
  assert.ok(pop);
  assert.match(pop.textContent, /Dig a trench/);
  assert.deepEqual(audit(w.doc.body), []);
  pop.querySelector(".station-pop__close").click();
  assert.equal(w.store.getState().picked, null);
  assert.equal(w.labels.querySelector(".station-pop"), null);
  // the route card sheet is in the page only while it is open, and prints
  assert.equal(w.doc.body.querySelector("#route-card-sheet"), null);
  w.a.showSheet("route-card");
  const sheet = w.doc.body.querySelector("#route-card-sheet");
  assert.equal(sheet.hidden, false);
  assert.equal(sheet.getAttribute("aria-modal"), "true");
  const cardText = w.doc.body.querySelector(".route-card").textContent;
  assert.match(cardText, /Bearings from true north/, "the read-me line keeps its words");
  assert.match(cardText, /USGS MSL Gale image mosaics/, "the sources line keeps its words");
  assert.ok(w.doc.body.querySelector(".route-card").querySelectorAll(".num__prov--word").length > 10, "the printed card keeps provenance in words");
  assert.equal(w.doc.body.querySelector(".route-card").querySelectorAll(".rail__stop").length, w.store.getState().plan.route.legs.length + 1, "one row per stop, the arriving leg on it");
  assert.deepEqual(audit(w.doc.body), []);
  sheet.querySelector(".btn--primary").click();
  assert.equal(globalThis.__printed, true);
  w.a.showSheet(null);
  assert.equal(w.doc.body.querySelector("#route-card-sheet"), null);
  // the walk step: the slim bar; it walks past the hazard start with no hazard
  w.a.gotoStep(3);
  assert.equal(w.story.getAttribute("data-kind"), "bar");
  await w.a.seek(90);
  assert.equal(w.store.getState().walk.hazard.active, false, "step 3 has no scheduled hazard");
  assert.ok(!w.overlays.has("route-return"));
  // the hazard step: the return path, and the audit still passes
  w.a.gotoStep(4);
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  assert.equal(w.store.getState().walk.hazard.active, true);
  assert.ok(w.overlays.has("route-return"));
  assert.ok(w.overlays.has("route-walked"));
  assert.deepEqual(audit(w.doc.body), []);
  // a plan step keeps nothing of the walk: no way back, no walked trail, no held alert
  w.a.gotoStep(5);
  assert.ok(!w.overlays.has("route-return"), "no red way back on the check step");
  assert.ok(!w.overlays.has("route-walked"), "no walked trail on the check step");
  assert.deepEqual(w.store.getState().walk.held, []);
  assert.deepEqual(audit(w.doc.body), []);
  for (const off of w.offs) off();
});

test("story shell: stepper, Details, the sources switch, Next keeps the focus, the walk bar, the end of the story", async () => {
  const w = world(inputsFixture(), null, { step: 1 });
  await w.a.replan();
  const steps = w.head.querySelectorAll(".story-step");
  assert.equal(steps.length, 5);
  assert.equal(steps[0].getAttribute("aria-current"), "step");
  const sw = w.head.querySelector(".story-switch");
  assert.equal(sw.getAttribute("role"), "switch");
  assert.equal(sw.getAttribute("aria-checked"), "false");
  sw.click();
  assert.equal(w.store.getState().showSources, true);
  assert.equal(sw.getAttribute("aria-checked"), "true");
  sw.click();
  // step 1: the caption with Next and no Back
  const next = () => w.doc.getElementById("story-next");
  assert.match(next().textContent, /See the plan/);
  assert.equal(w.story.querySelector(".story-back"), null);
  assert.equal(w.story.querySelector(".story-chips"), null);
  next().focus();
  next().fire("keydown", { key: "Enter" });
  assert.equal(w.store.getState().step, 2);
  assert.equal(w.doc.activeElement, next(), "the focus stays on Next");
  assert.equal(w.story.querySelectorAll(".keynum").length, 4);
  const chipRow = w.story.querySelector(".story-chips");
  assert.ok(chipRow);
  assert.ok(w.story.querySelector(".caption").contains(chipRow), "the layer chips sit inside the caption plate");
  assert.equal(chipRow.querySelector(".story-chips__label").textContent, "Show");
  assert.ok(w.story.querySelector(".caption").hasAttribute("data-fit-avoid"), "the plate, not the full-width foot, is what the fit avoids");
  assert.ok(!w.story.hasAttribute("data-fit-avoid"));
  assert.ok(w.story.querySelector(".caption__text--short"), "one short sentence for narrow screens");
  w.story.querySelectorAll(".story-chip")[0].click();
  assert.ok(w.store.getState().layers.includes("slope"));
  next().click();
  assert.equal(w.store.getState().step, 3);
  assert.equal(w.story.getAttribute("data-kind"), "bar");
  assert.match(w.story.textContent, /Step 3 of 5 - Walk/);
  assert.equal(w.story.querySelectorAll(".segmented__opt").length, 3, "speeds 10x, 60x, 240x");
  assert.equal(w.doc.activeElement, next());
  next().click();
  assert.equal(w.store.getState().step, 4);
  assert.match(w.story.textContent, /13 May 2025/);
  assert.match(w.story.textContent, /Arrival at Mars is not claimed/);
  next().click();
  assert.equal(w.store.getState().step, 5);
  assert.match(next().textContent, /Explore freely/, "the end of the story keeps a primary button under the focus");
  assert.ok(w.story.querySelector(".story-end__print"));
  w.story.querySelector(".story-back").click();
  assert.equal(w.store.getState().step, 4);
  w.a.gotoStep(5);
  next().click();
  assert.equal(w.store.getState().explore, true);
  assert.equal(w.store.getState().drawer, true);
  assert.equal(w.story.getAttribute("data-kind"), "explore");
  assert.ok(w.labels.querySelectorAll(".leg-tag").length > 0, "leg labels show while exploring");
  w.head.querySelector("#story-details").click();
  assert.equal(w.store.getState().drawer, false);
  next().click();
  assert.equal(w.store.getState().explore, false);
  assert.deepEqual(audit(w.doc.body), []);
  for (const off of w.offs) off();
});

test("smoke: no route and empty walk show their designed screens", async () => {
  const blocked = world(inputsFixture({ no_go: [{ id: "z", label: "Zone", polygon: [[8, 8], [13, 8], [13, 13], [8, 13]], placeholder: false }] }));
  await blocked.a.replan();
  const limits = blocked.drawer.querySelector("#panel-limits");
  assert.ok(limits.querySelector(".no-route"));
  assert.match(limits.textContent, /NO ROUTE/);
  assert.match(limits.textContent, /No-go zone/);
  limits.querySelector(".btn--primary").click();
  assert.equal(blocked.store.getState().panel, "editor");
  assert.deepEqual(audit(blocked.doc.body), []);

  const empty = world(inputsFixture({ stations: [] }));
  await empty.a.replan();
  assert.ok(empty.drawer.querySelector("#panel-limits").querySelector(".empty"));
  assert.deepEqual(audit(empty.doc.body), []);
});

test("slope cap exactly at the limit reads At limit and names the steepest leg", () => {
  const route = {
    ok: true, total_m: 100,
    legs: [
      { from: { id: "base" }, to: { id: 1 }, max_slope_deg: 9, climb_m: 1, path: [[0, 0], [10, 10]] },
      { from: { id: 4 }, to: { id: 5 }, max_slope_deg: 15, climb_m: 1, path: [[10, 10], [0, 0]] },
    ],
  };
  const rows = minimumRows(buildConstraints({ route, inputs: inputsFixture(), dose: doseFixture }));
  const slope = rows[0];
  assert.equal(slope.state, "limit", "margin zero with pass true is At limit, not Caution");
  assert.equal(slope.where, "steepest on leg S4 to S5");
  assert.equal(legText({ from: "base", to: 1 }), "steepest on leg base to S1");
  const over = minimumRows(buildConstraints({ route: { ...route, legs: [{ ...route.legs[1], max_slope_deg: 15.4 }] }, inputs: inputsFixture(), dose: doseFixture }));
  assert.equal(over[0].state, "fail");
});

test("labels: reserved rectangles push tags aside, zone labels sit on the zone or hide", () => {
  const credit = { x: 0, y: 500, w: 300, h: 60 };
  const items = [
    { id: "s1", kind: "tag", x: 100, y: 520, w: 60, h: 20 },
    { id: "z", kind: "zone", x: 400, y: 300, w: 120, h: 24 },
    { id: "z2", kind: "zone", x: 150, y: 530, w: 120, h: 24 },
  ];
  const out = placeLabels(items, { w: 800, h: 600 }, [credit]);
  const r = out.get("s1");
  assert.ok(r, "a station tag is never dropped");
  assert.ok(r.rect.y + r.rect.h <= credit.y || r.rect.y >= credit.y + credit.h || r.rect.x >= credit.x + credit.w, "the tag keeps off the credit");
  assert.equal(out.get("z").place, "centre");
  assert.equal(out.get("z2"), null, "a zone label over the credit hides");
  assert.deepEqual(polygonCentre([[0, 0], [10, 0], [10, 10], [0, 10]]), { x: 5, y: 5 });
  assert.deepEqual([...walkLabelIds({ next_station: 3 })], ["base", "s3"]);
  assert.deepEqual([...walkLabelIds({ next_station: null })], ["base"]);
});

test("map controls: one cluster of seven buttons and More; zoom and turn repeat while held; fit route fits the walk", () => {
  const w = world();
  const calls = [];
  w.labels.parentNode.ownerDocument = w.doc;
  const ctx = {
    storage: null,
    store: w.store,
    regions: { labels: w.labels, head: w.head, story: w.story, drawer: w.drawer },
    host: {
      kind: "3d",
      zoomBy: (f) => calls.push(["zoom", f]), tiltBy: (d) => calls.push(["tilt", d]), resetNorth: () => calls.push(["north"]),
      rotateBy: (d) => calls.push(["turn", d]),
      fitBounds: (b, ins) => calls.push(["fit", b, ins]), getCamera: () => ({ heading_deg: 30, tilt_deg: 0 }), onChange: () => () => {},
    },
  };
  const off = mountMapControls(ctx);
  const cluster = w.labels.parentNode.querySelector(".map-cluster");
  assert.ok(cluster && cluster.hasAttribute("data-label-avoid"));
  assert.ok(cluster.querySelector(".map-tools").hasAttribute("data-fit-avoid"));
  assert.equal(cluster.querySelector(".map-tools__hint").textContent, HINT);
  assert.ok(cluster.querySelector(".map-tools__hint").hasAttribute("data-fit-avoid"), "the route fit keeps clear of the hint");
  const btns = cluster.querySelectorAll("button");
  assert.equal(btns.length, 8);
  const more = cluster.querySelector(".map-tools__more");
  assert.equal(cluster.querySelectorAll(".map-tools__extra").length, 4, "tilt, the two turns and north up wait behind More on narrow screens");
  for (const b of btns) b.click();
  assert.deepEqual(calls.map((c) => c[0]), ["zoom", "zoom", "tilt", "turn", "turn", "north", "fit"]);
  assert.equal(more.getAttribute("aria-expanded"), "true");
  assert.ok(cluster.querySelector(".map-tools").hasAttribute("data-more"));
  assert.ok(calls[3][1] < 0 && calls[4][1] > 0, "turn left lowers the heading");
  const fit = calls.at(-1)[1];
  assert.ok(fit.x0 <= -15.5 - 24 && fit.x1 >= 10.5 + 24, JSON.stringify(fit));
  assert.equal(northRotation({ heading_deg: 30 }), -30);
  assert.deepEqual(audit(cluster), []);
  // the walk view takes the cluster out of the page; the 2D view takes the tilt button out
  w.store.setState({ view: "walk" });
  assert.equal(w.labels.parentNode.querySelector(".map-cluster"), null);
  w.store.setState({ view: "plan", renderer: "2d" });
  assert.equal(w.labels.parentNode.querySelector(".map-cluster").querySelectorAll("button").length, 7);
  off();
  for (const o of w.offs) o();
});

test("first-time hint: once per browser, gone on the first input or after its time, never in the walk steps", () => {
  const mk = () => {
    const w = world();
    w.labels.parentNode.ownerDocument = w.doc;
    return w;
  };
  const host = { kind: "3d", zoomBy() {}, getCamera: () => ({ heading_deg: 0, tilt_deg: 0 }), onChange: () => () => {} };
  const memory = new Map();
  const storage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) };
  const timers = { fns: [], setTimeout(fn, ms) { this.fns.push([fn, ms]); return this.fns.length; }, clearTimeout() {} };
  // first visit: the hint shows and the time to hide it is HINT_MS
  let w = mk();
  let off = mountMapControls({ storage, timers, store: w.store, host, regions: { labels: w.labels } });
  const hintOf = () => w.labels.parentNode.querySelector(".map-tools__hint");
  assert.ok(hintOf());
  assert.equal(timers.fns[0][1], HINT_MS);
  timers.fns[0][0]();
  assert.equal(hintOf(), null, "gone after its time");
  off();
  // second visit in the same browser: no hint
  w = mk();
  off = mountMapControls({ storage, timers, store: w.store, host, regions: { labels: w.labels } });
  assert.equal(hintOf(), null);
  off();
  // storage that refuses: the page still works and the hint shows
  const refusing = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(hintSeen(refusing), false);
  assert.doesNotThrow(() => markHintSeen(refusing));
  w = mk();
  off = mountMapControls({ storage: refusing, timers, store: w.store, host, regions: { labels: w.labels } });
  assert.ok(hintOf());
  w.labels.parentNode.fire("pointerdown");
  assert.equal(hintOf(), null, "gone on the first input on the scene");
  off();
  // the walk and hazard steps never show it, also while they wait for the route with the plan view still on
  w = mk();
  w.store.setState({ step: 3 });
  off = mountMapControls({ storage: null, timers, store: w.store, host, regions: { labels: w.labels } });
  assert.equal(hintOf(), null);
  off();
  for (const o of w.offs) o();
});

test("placeLabels: a dense cluster of station tags on a phone finds a wider ring before any tag is forced over another", () => {
  const pts = [[60, 60], [70, 66], [64, 74], [76, 58], [58, 70], [72, 76]];
  const items = pts.map(([x, y], i) => ({ id: `s${i}`, kind: "tag", x: x + 100, y: y + 100, w: 46, h: 26, wc: 34 }));
  const out = placeLabels(items, { w: 390, h: 400 }, []);
  const rects = items.map((it) => out.get(it.id).rect);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `tags ${i} and ${j} overlap`);
    }
  }
});

test("map inset: a close control on its corner hides it; one Map button in the same corner brings it back", () => {
  const more = { data: {}, regions: (mk) => ({ hud: mk("hud") }), mounts: [mountMinimap] };
  const w = world(inputsFixture(), more, { step: 3 });
  w.store.setState({ view: "walk" });
  const inset = w.doc.body.querySelector(".minimap");
  assert.ok(inset);
  const close = inset.querySelector(".minimap__close");
  const open = inset.querySelector(".minimap__open");
  assert.equal(close.getAttribute("aria-label"), "Hide map");
  assert.equal(open.hidden, true);
  assert.equal(close.textContent, "", "an icon, no text");
  close.click();
  assert.equal(inset.querySelector(".minimap__frame").hidden, true);
  assert.equal(close.hidden, true);
  assert.equal(open.hidden, false);
  assert.equal(open.textContent, "Map");
  assert.equal(w.doc.activeElement, open, "the focus moves to the button that brings it back");
  open.click();
  assert.equal(inset.querySelector(".minimap__frame").hidden, false);
  assert.equal(w.doc.activeElement, close);
  for (const o of w.offs) o();
});

test("hold to repeat: a held pointer repeats, a keyboard click acts once", () => {
  const handlers = {};
  const button = { addEventListener: (t, fn) => (handlers[t] = fn) };
  const timers = { t: [], i: [], setTimeout(fn) { this.t.push(fn); return 1; }, setInterval(fn) { this.i.push(fn); return 2; }, clearTimeout() {}, clearInterval() { this.i = []; } };
  let n = 0;
  holdToRepeat(button, () => n++, { timers });
  handlers.pointerdown({ button: 0 });
  assert.equal(n, 1);
  timers.t[0]();
  timers.i[0]();
  timers.i[0]();
  assert.equal(n, 3);
  handlers.pointerup();
  handlers.click({ detail: 1 });
  assert.equal(n, 3, "the click after a press does not act again");
  handlers.click({ detail: 0 });
  assert.equal(n, 4, "a keyboard click acts once");
});

test("walk view labels: only the base and the next station stay, legs and zones hide", async () => {
  const w = world(inputsFixture({ no_go: [{ id: "z", label: "Loose ground", polygon: [[-30, -30], [-25, -30], [-25, -25]], placeholder: false }] }));
  await w.a.replan();
  assert.ok(w.labels.querySelectorAll(".zone-tag").length === 1, "the no-go zone has its label in the plan view");
  w.a.enterWalk();
  const marks = w.labels.querySelectorAll(".mark");
  const shown = marks.filter((m) => !m.hasAttribute("data-hidden"));
  const kinds = shown.map((m) => (m.classList.contains("mark--base") ? "base" : m.querySelector(".map-tag") ? "station" : "other"));
  assert.ok(kinds.includes("base"));
  assert.ok(!kinds.includes("other"), "no leg or zone label in the walk view");
  assert.ok(kinds.filter((k) => k === "station").length <= 1);
  assert.ok(w.labels.querySelector(".label-group").hasAttribute("data-walk"));
  for (const o of w.offs) o();
});

// ---------------------------------------------------------------- strict audit over the helmet, cards, layers and credits

test("strict audit (text, SVG text, aria and title attributes, units) holds in every walk state", async () => {
  const real = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf8"));
  const more = {
    data: { conditions: real("conditions.json"), dose: real("dose.json"), sep: real("sep-event.json"), sources: JSON.parse(readFileSync(new URL("../sources.json", import.meta.url), "utf8")), layers: JSON.parse(readFileSync(new URL("../layers.json", import.meta.url), "utf8")) },
    regions: (mk) => ({ hud: mk("hud"), status: mk("status"), modal: mk("layer-modal") }),
    mounts: [mountHud, mountStationCards, mountLayers, mountCredits, mountMinimap],
  };
  const w = world(inputsFixture(), more, { step: 2, drawer: true });
  const bad = (what) => {
    const r = audit(w.doc.body);
    assert.deepEqual(r, [], `${what}: ${JSON.stringify(r.slice(0, 4))}`);
  };
  await w.a.replan();
  for (const panel of ["limits", "timeline", "layers", "stations", "editor", "rover", "credits"]) {
    w.a.setPanel(panel);
    bad(`plan, panel ${panel}`);
  }
  for (const step of [1, 2, 5]) {
    w.a.gotoStep(step);
    for (const on of [false, true]) {
      w.a.setSources(on);
      bad(`step ${step}, sources ${on ? "on" : "off"}`);
    }
  }
  w.a.setExplore(true);
  bad("explore");
  w.a.setExplore(false);
  w.a.setPanel("layers");
  for (const id of LAYER_IDS.filter((x) => x !== "height" && x !== "slope")) { // the two raster layers build real canvases
    w.a.setLayer(id, true);
    bad(`layer ${id} on`);
  }
  w.a.gotoStep(3);
  for (const t of [0, 30, 90, 200, 400]) {
    await w.a.seek(t);
    bad(`walk t=${t}`);
  }
  assert.ok(w.doc.body.querySelector(".hud"), "the helmet display is mounted, so the audit covers it");
  assert.ok(w.doc.body.querySelector(".hud__sim-line"), "the one fixed simulation line");
  const suit = w.doc.body.querySelector('[data-margin="suit"]').querySelector(".hud__label");
  assert.equal(suit.textContent, "Suit time left");
  assert.equal(suit.querySelector(".hud__label-rest").textContent, " time left", "narrow screens show the first word only");
  assert.ok(w.doc.body.querySelector(".minimap"), "the map inset is in the walk view");
  assert.ok(w.doc.body.querySelector(".layer-panel"), "the layer panel is mounted");
  w.a.startHazardScenario();
  bad("hazard");
  w.a.returnToRover();
  bad("return");
  for (const o of w.offs) o();
});
