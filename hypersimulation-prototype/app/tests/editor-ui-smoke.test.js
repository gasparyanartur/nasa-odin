// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Mounts the three panels against a small hand-made DOM so a typo shows up in Node, not in the browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInputs } from "../src/inputs.js";
import { createStore } from "../src/state.js";
import { audit } from "../src/provenance.js";
import { mount as mountEditor, routeLine, structureSignature } from "../src/ui/editor.js";
import { mount as mountStations, legTo, firstLine } from "../src/ui/stations-list.js";
import { mount as mountRover } from "../src/ui/rover-panel.js";

class Node_ {
  constructor(tag, doc) { this.tag = tag; this.doc = doc; this.nodeType = 1; this.attrs = {}; this.childNodes = []; this.parent = null; this.handlers = {}; this.value = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parent = this; this.childNodes.push(c); return c; }
  append(...cs) { for (const c of cs) this.appendChild(c); }
  replaceChildren(...cs) { this.childNodes = []; this.append(...cs); }
  remove() { if (this.parent) this.parent.childNodes = this.parent.childNodes.filter((c) => c !== this); }
  addEventListener(t, fn) { (this.handlers[t] ||= []).push(fn); }
  removeEventListener() {}
  click() { for (const fn of this.handlers.click || []) fn({ target: this }); }
  focus() { this.doc.activeElement = this; }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(""); }
  set textContent(t) { this.childNodes = [{ nodeType: 3, nodeValue: String(t), parent: this }]; }
  all(out = []) { for (const c of this.childNodes) if (c.nodeType === 1) { out.push(c); c.all(out); } return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    let test;
    let m;
    if ((m = sel.match(/^#(.+)$/))) test = (n) => n.attrs.id === m[1];
    else if ((m = sel.match(/^\[([a-z-]+)="(.*)"\]$/))) test = (n) => n.attrs[m[1]] === m[2];
    else test = () => false;
    return this.all().filter(test);
  }
}
function makeDoc() {
  const doc = {
    activeElement: null, listeners: {},
    createElement: (t) => new Node_(t, doc),
    createElementNS: (ns, t) => new Node_(t, doc),
    createTextNode: (t) => ({ nodeType: 3, nodeValue: t }),
    addEventListener(t, fn) { (doc.listeners[t] ||= []).push(fn); },
    removeEventListener() {},
    getElementById(id) { return doc.body.querySelector(`#${id}`); },
    defaultView: { innerWidth: 1366, innerHeight: 768, setTimeout: () => 0, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} } },
  };
  doc.body = new Node_("body", doc);
  return doc;
}

const inputs = validateInputs(JSON.parse(readFileSync(new URL("../public/data/team-inputs.json", import.meta.url), "utf8"))).inputs;
const waypoints = JSON.parse(readFileSync(new URL("../public/data/waypoints.json", import.meta.url), "utf8"));

function setup(panelId) {
  const doc = makeDoc();
  const panel = doc.createElement("div");
  panel.setAttribute("id", panelId);
  doc.body.appendChild(panel);
  const store = createStore({ inputs, plan: { status: "ok", route: { legs: [{ to: { id: 1 }, distance_m: 120.4, bearing_deg: 33 }] } }, panel: "editor" });
  const calls = { updates: [], flies: [], overlays: [], layers: [] };
  const ctx = {
    store, doc,
    host: {
      pick: (x, y) => ({ x: 10, y: 20 }),
      flyTo: (x, y) => calls.flies.push([x, y]),
      setOverlay: (id, spec) => calls.overlays.push([id, spec && spec.kind]),
    },
    data: { waypoints },
    terrain: { slopeAt: () => 8 },
    actions: {
      updateInputs: (next) => { calls.updates.push(next); store.setState({ inputs: next }); },
      resetInputs: () => {},
      setLayer: (id, on) => calls.layers.push([id, on]),
    },
    regions: {},
  };
  return { doc, panel, ctx, calls, store };
}
const byFk = (panel, fk) => panel.querySelector(`[data-fk="${fk}"]`);

test("editor mounts, steps a value, nudges, adds at the centre, and obeys no digit outside num()", () => {
  const { doc, panel, ctx, calls } = setup("panel-editor");
  const off = mountEditor(ctx, doc);
  assert.equal(audit(panel).length, 0, JSON.stringify(audit(panel).slice(0, 3)));
  byFk(panel, "walking_speed_m_s-more").click();
  assert.equal(calls.updates.at(-1).walking_speed_m_s.value, 0.8);
  byFk(panel, "nE10-1").click();
  assert.equal(calls.updates.at(-1).stations[0].x, inputs.stations[0].x + 10);
  const n = calls.updates.at(-1).stations.length;
  byFk(panel, "add-centre").click();
  assert.equal(calls.updates.at(-1).stations.length, n + 1);
  assert.equal(audit(panel).length, 0);
  byFk(panel, "zone-draw").click();
  for (let i = 0; i < 3; i++) byFk(panel, "zone-centre").click();
  assert.ok(calls.overlays.some(([id, k]) => id === "editor-draft" && k === "polygon"));
  byFk(panel, "zone-close").click();
  assert.equal(calls.updates.at(-1).no_go.length, inputs.no_go.length + 1);
  assert.equal(calls.overlays.at(-1)[1], null);
  off();
});

test("editor: the no-route line with a station id passes the number audit", () => {
  const { doc, panel, ctx, store } = setup("panel-editor");
  const off = mountEditor(ctx, doc);
  store.setState({ plan: { status: "no_route", blocking: { limit: "no_go", station_id: 1 } } });
  assert.match(panel.querySelector("#editor-route").textContent, /Station 1/);
  assert.equal(audit(panel).length, 0, JSON.stringify(audit(panel).slice(0, 3)));
  off();
});

test("editor: a store change that leaves inputs and the route line alone touches no DOM (walk clock frames)", () => {
  const { doc, panel, ctx, store } = setup("panel-editor");
  const off = mountEditor(ctx, doc);
  const box = panel.querySelector("#editor-route");
  const textNode = box.childNodes[0];
  for (let t = 1; t <= 5; t++) store.setState({ walk: { t_s: t } });
  assert.equal(box.childNodes[0], textNode);
  off();
});

test("routeLine names the limit and the station", () => {
  assert.equal(routeLine({ status: "ok" }), "Route: planned");
  assert.equal(routeLine({ status: "no_route", blocking: { limit: "slope_cap", station_id: 3 } }), "No route - slope cap at Station 3");
  assert.equal(routeLine({ status: "no_route", blocking: { limit: "no_go", station_id: "base" } }), "No route - no-go zone");
});

test("a task-only or label-only edit keeps the same structure signature", () => {
  const a = JSON.parse(JSON.stringify(inputs));
  const b = JSON.parse(JSON.stringify(inputs));
  b.stations[0].task = "changed";
  b.no_go[0].label = "changed";
  assert.equal(structureSignature(a), structureSignature(b));
  b.stations[0].x += 1;
  assert.notEqual(structureSignature(a), structureSignature(b));
});

test("stations list renders rows, flies on click, and has no bare digit", () => {
  const { doc, panel, ctx, calls } = setup("panel-stations");
  const off = mountStations(ctx, doc);
  assert.equal(audit(panel).length, 0, JSON.stringify(audit(panel).slice(0, 3)));
  const row = panel.querySelector('[aria-label="Station 2, fly to it"]');
  row.click();
  assert.deepEqual(calls.flies.at(-1), [inputs.stations[1].x, inputs.stations[1].y]);
  assert.equal(ctx.store.getState().selectedStation, 2);
  assert.equal(legTo({ legs: [{ to: { id: 1 } }] }, 2), null);
  assert.equal(firstLine("Do this. Then that."), "Do this.");
  assert.equal(firstLine("  "), "TASK NOT SET");
  off();
});

test("rover panel mounts with real waypoints and shows the verbatim alignment statement", () => {
  const { doc, panel, ctx } = setup("panel-rover");
  mountRover(ctx, doc);
  assert.equal(audit(panel).length, 0, JSON.stringify(audit(panel).slice(0, 3)));
  const text = panel.textContent;
  assert.ok(text.includes("The orbit image is older than the rover's drive, so it shows no wheel tracks."));
  assert.ok(text.includes("degrees by inference"));
  assert.ok(text.includes("The heights may share a source with the terrain."));
});
