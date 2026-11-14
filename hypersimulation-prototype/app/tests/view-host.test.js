// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { createViewHost } from "../src/view-host.js";

const ALL = [
  "setView", "setExaggeration", "setLayer", "setOverlay", "setRasterLayer", "setCoreTile", "setEye", "setHillshade", "setCoreTerrain",
  "setContinuous", "flyTo", "panBy", "zoomBy", "tiltBy", "rotateBy", "resetNorth", "fitView", "resize", "requestRender", "getCamera",
  "getStats", "pick", "project", "dispose",
];

// A recording renderer. `only` limits the methods it has, like the 2D view that lacks some.
function fakeView(only = ALL) {
  const calls = [];
  const v = { calls };
  for (const n of only) v[n] = (...a) => { calls.push([n, ...a]); return n === "pick" ? { x: 1, y: 2 } : n === "getCamera" ? { x: 0 } : undefined; };
  v.onChange = (fn) => { v.change = fn; return () => {}; };
  v.onContextLost = (fn) => { v.lost = fn; return () => {}; };
  if (only.includes("fitView")) v.onRender = (fn) => { v.render = fn; return () => {}; };
  return v;
}
const names = (v) => v.calls.map((c) => c[0]);

test("host carries the full common API and the two read-only fields", () => {
  const host = createViewHost();
  for (const n of [...ALL, "attach", "onChange", "onContextLost", "onRender", "setImagery", "getImagery", "onImagery"]) {
    assert.equal(typeof host[n], "function", n);
  }
  assert.equal(host.kind, null);
  assert.equal(host.current, null);
  assert.equal(host.pick(1, 2), null);
  assert.equal(host.getCamera(), null);
  assert.deepEqual(host.project(1, 2), { sx: 0, sy: 0, visible: false });
  assert.doesNotThrow(() => host.setLayer("slope", true));
});

test("calls reach the current renderer; a method it lacks is a null no-op", () => {
  const host = createViewHost();
  const a = fakeView();
  host.attach(a, "3d");
  host.panBy(3, 4);
  host.fitView("core");
  assert.deepEqual(a.calls.at(-1), ["fitView", "core"]);
  assert.deepEqual(host.pick(5, 6), { x: 1, y: 2 });
  const b = fakeView(["setView", "setExaggeration", "setLayer", "setOverlay", "setRasterLayer", "setCoreTile", "setEye", "panBy"]);
  host.attach(b, "2d");
  assert.equal(host.getStats(), null);
  assert.equal(host.setHillshade(true), undefined);
  host.panBy(1, 2);
  assert.deepEqual(b.calls.at(-1), ["panBy", 1, 2]);
  assert.equal(host.kind, "2d");
  assert.equal(host.current, b);
});

test("record, switch, replay: layers, rasters, overlays, images, terrain, eye, view, exaggeration", () => {
  const host = createViewHost();
  const a = fakeView();
  host.attach(a, "3d");
  host.setLayer("slope", true);
  host.setLayer("image", false);
  host.setRasterLayer("slope", { image: "raster" });
  host.setRasterLayer("height", { image: "x" });
  host.setRasterLayer("height", null);
  host.setOverlay("route", { kind: "line", coords: [[0, 0], [1, 1]] });
  host.setOverlay("gone", { kind: "line", coords: [] });
  host.setOverlay("gone", null);
  host.setCoreTile("overview", "ov");
  host.setCoreTile("core_0_0", "t00");
  host.setCoreTile("core_0_0", "t00b");
  host.setCoreTerrain("DEM", "SLOPE");
  host.setEye({ x: 1, y: 2, heading_deg: 90 });
  host.setHillshade(true);
  host.setView("walk");
  host.setExaggeration(2);
  const b = fakeView();
  host.attach(b, "2d");
  const find = (n) => b.calls.filter((c) => c[0] === n);
  assert.deepEqual(find("setExaggeration"), [["setExaggeration", 2]]);
  assert.deepEqual(find("setLayer"), [["setLayer", "slope", true], ["setLayer", "image", false]]);
  assert.deepEqual(find("setRasterLayer"), [["setRasterLayer", "slope", { image: "raster" }]]);
  assert.deepEqual(find("setOverlay").map((c) => c[1]), ["route"]);
  assert.deepEqual(find("setCoreTile"), [["setCoreTile", "overview", "ov"], ["setCoreTile", "core_0_0", "t00b"]]);
  assert.deepEqual(find("setCoreTerrain"), [["setCoreTerrain", "DEM", "SLOPE"]]);
  assert.deepEqual(find("setEye"), [["setEye", { x: 1, y: 2, heading_deg: 90 }]]);
  assert.deepEqual(find("setHillshade"), [["setHillshade", true]]);
  assert.deepEqual(find("setView"), [["setView", "walk"]]);
  assert.equal(names(b).at(-1), "setView");
  assert.ok(names(b).indexOf("setCoreTerrain") < names(b).indexOf("setOverlay"));
});

test("subscriptions survive a switch and fire only from the current renderer", () => {
  const host = createViewHost();
  let changes = 0;
  let lost = 0;
  const frames = [];
  host.onChange(() => changes++);
  host.onContextLost(() => lost++);
  host.onRender((t) => frames.push(t));
  const a = fakeView();
  host.attach(a, "3d");
  const b = fakeView();
  host.attach(b, "2d");
  a.change();
  a.lost();
  a.render(1);
  assert.equal(changes + lost + frames.length, 0);
  b.change();
  b.lost();
  b.render(7);
  assert.equal(changes, 1);
  assert.equal(lost, 1);
  assert.deepEqual(frames, [7]);
  const off = host.onChange(() => changes++);
  off();
  b.change();
  assert.equal(changes, 2);
});

function imageryHost() {
  const loads = [];
  const host = createViewHost({
    imagery: {
      modes: ["colour", "grey"],
      mode: "colour",
      load: (mode, onImage, isCurrent) => new Promise((resolve, reject) => loads.push({ mode, onImage, isCurrent, resolve, reject })),
    },
  });
  const view = fakeView();
  host.attach(view, "3d");
  host.setCoreTile("overview", "c-ov");
  host.setCoreTile("core_0_0", "c-t");
  return { host, view, loads };
}

test("imagery: without a config setImagery does nothing", async () => {
  const host = createViewHost();
  assert.equal(await host.setImagery("grey"), false);
  assert.deepEqual(host.getImagery(), { mode: null, loading: false });
  assert.deepEqual(host.imageryModes(), []);
});

test("imagery: a switch before the first load has finished waits for markImageryReady", async () => {
  const { host, loads } = imageryHost();
  await host.setImagery("grey");
  assert.equal(loads.length, 0);
  const done = host.markImageryReady();
  assert.equal(loads.length, 1);
  assert.deepEqual(host.getImagery(), { mode: "grey", loading: true });
  loads[0].resolve();
  assert.equal(await done, true);
});

test("imagery: switch loads the other set, swaps images, reports loading then done, replays on a new renderer", async () => {
  const { host, view, loads } = imageryHost();
  const seen = [];
  host.onImagery((s) => seen.push(s));
  await host.markImageryReady();
  const p = host.setImagery("grey");
  assert.deepEqual(seen.at(-1), { mode: "grey", loading: true });
  loads[0].onImage("overview", "g-ov");
  loads[0].onImage("core_0_0", "g-t");
  assert.deepEqual(view.calls.filter((c) => c[0] === "setCoreTile").slice(-2), [["setCoreTile", "overview", "g-ov"], ["setCoreTile", "core_0_0", "g-t"]]);
  loads[0].resolve();
  assert.equal(await p, true);
  assert.deepEqual(seen.at(-1), { mode: "grey", loading: false });
  const b = fakeView();
  host.attach(b, "2d");
  assert.deepEqual(b.calls.filter((c) => c[0] === "setCoreTile"), [["setCoreTile", "overview", "g-ov"], ["setCoreTile", "core_0_0", "g-t"]]);
  assert.equal(await host.setImagery("grey"), true);
  assert.equal(loads.length, 1);
});

test("imagery: switching back mid-load drops the late images and restores the colour set", async () => {
  const { host, view, loads } = imageryHost();
  await host.markImageryReady();
  const p = host.setImagery("grey");
  loads[0].onImage("overview", "g-ov");
  await host.setImagery("colour");
  assert.deepEqual(host.getImagery(), { mode: "colour", loading: false });
  loads[0].onImage("core_0_0", "g-late");
  loads[0].resolve();
  assert.equal(await p, false);
  const tiles = view.calls.filter((c) => c[0] === "setCoreTile");
  assert.ok(!tiles.some((c) => c[2] === "g-late"));
  assert.deepEqual(tiles.slice(-2).map((c) => c[2]).sort(), ["c-ov", "c-t"]);
  assert.equal(loads.length, 1);
});

test("imagery: a failed load restores the previous set and reports the error", async () => {
  const { host, view, loads } = imageryHost();
  const seen = [];
  host.onImagery((s, e) => seen.push([s, e]));
  await host.markImageryReady();
  const p = host.setImagery("grey");
  loads[0].onImage("overview", "g-ov");
  const err = { file: "ortho/grey_core_0_0.webp", status: 404 };
  loads[0].reject(err);
  assert.equal(await p, false);
  assert.deepEqual(seen.at(-1), [{ mode: "colour", loading: false }, err]);
  assert.deepEqual(view.calls.filter((c) => c[0] === "setCoreTile").slice(-2).map((c) => c[2]).sort(), ["c-ov", "c-t"]);
  assert.equal(host.getImagery().mode, "colour");
});

test("imagery: an unknown mode is ignored", async () => {
  const { host, loads } = imageryHost();
  await host.markImageryReady();
  assert.equal(await host.setImagery("sepia"), false);
  assert.equal(loads.length, 0);
});
