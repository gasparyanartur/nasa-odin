// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import {
  worldToScreen, screenToWorld, cameraMatrix, imageMatrix, zoomAt, moveViewpoint, walkCamera, imageExtent,
  visibleBox, normDeg, createView2d,
} from "../src/view2d.js";

const scene = {
  core: { size_m: 1024, tiles: [["a", "b"], ["c", "d"]] },
  surround: { size_m: 2048 },
};
const cam = { cx: 0, cy: 0, scale: 0.5, rot: 0, w: 1000, h: 800 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("north-west orientation: world (-512, 512) is the top-left of the core, (512, -512) the bottom-right", () => {
  const c = { ...cam, scale: 1 };
  const nw = worldToScreen(c, -512, 512);
  const se = worldToScreen(c, 512, -512);
  assert.ok(nw.sx < se.sx && nw.sy < se.sy);
  near(nw.sx, 500 - 512);
  near(nw.sy, 400 - 512);
  near(se.sx, 500 + 512);
  near(se.sy, 400 + 512);
});

test("world -> screen -> world round trip at several rotations", () => {
  for (const rot of [0, 33, -90, 180, 271]) {
    const c = { cx: 12, cy: -40, scale: 2.5, rot, w: 640, h: 480 };
    for (const [x, y] of [[0, 0], [-512, 512], [300.25, -77.5]]) {
      const s = worldToScreen(c, x, y);
      const back = screenToWorld(c, s.sx, s.sy);
      near(back.x, x, 1e-9);
      near(back.y, y, 1e-9);
    }
  }
});

test("the centre maps to the middle of the screen", () => {
  const s = worldToScreen({ ...cam, cx: 7, cy: 9 }, 7, 9);
  near(s.sx, 500);
  near(s.sy, 400);
});

test("cameraMatrix agrees with worldToScreen", () => {
  const c = { cx: 12, cy: -40, scale: 2.5, rot: 33, w: 640, h: 480 };
  const [a, b, cc, d, e, f] = cameraMatrix(c);
  const s = worldToScreen(c, 100, 50);
  near(a * 100 + cc * 50 + e, s.sx, 1e-9);
  near(b * 100 + d * 50 + f, s.sy, 1e-9);
});

test("imageMatrix puts the north-west image corner at the world north-west corner and the far corner south-east", () => {
  const c = { cx: 3, cy: 4, scale: 1.5, rot: 20, w: 640, h: 480 };
  const ext = { x0: -100, y0: -50, x1: 150, y1: 80 };
  const [a, b, cc, d, e, f] = imageMatrix(c, ext);
  const nw = worldToScreen(c, ext.x0, ext.y1);
  const se = worldToScreen(c, ext.x1, ext.y0);
  near(e, nw.sx, 1e-9);
  near(f, nw.sy, 1e-9);
  const u = ext.x1 - ext.x0;
  const v = ext.y1 - ext.y0;
  near(a * u + cc * v + e, se.sx, 1e-9);
  near(b * u + d * v + f, se.sy, 1e-9);
});

test("zoomAt keeps the world point under the cursor fixed and respects the limits", () => {
  const limits = { min: 0.1, max: 4 };
  const z = zoomAt(cam, 2, 200, 100, limits);
  const before = screenToWorld(cam, 200, 100);
  const s = worldToScreen(z, before.x, before.y);
  near(s.sx, 200, 1e-9);
  near(s.sy, 100, 1e-9);
  near(z.scale, 1);
  assert.equal(zoomAt(cam, 100, 0, 0, limits).scale, 4);
  assert.equal(zoomAt(cam, 0.0001, 0, 0, limits).scale, 0.1);
});

test("moveViewpoint right moves the centre east when north is up", () => {
  const m = moveViewpoint(cam, 100, 0);
  near(m.cx, 200);
  near(m.cy, 0);
  const n = moveViewpoint(cam, 0, -50);
  near(n.cy, 100);
});

test("heading-up: a point ahead of the eye is above the centre, whatever the heading", () => {
  for (const heading of [0, 90, 180, 250]) {
    const eye = { x: 10, y: 20, heading_deg: heading };
    const c = walkCamera(eye, 4, 600, 400);
    const r = (heading * Math.PI) / 180;
    const ahead = worldToScreen(c, eye.x + 10 * Math.sin(r), eye.y + 10 * Math.cos(r));
    near(ahead.sx, 300, 1e-9);
    assert.ok(ahead.sy < 200);
  }
});

test("imageExtent: tile row 0 is north, column 0 is west; overview and surround cover the surround", () => {
  assert.deepEqual(imageExtent(scene, "core_0_0"), { x0: -512, x1: 0, y0: 0, y1: 512 });
  assert.deepEqual(imageExtent(scene, "core_1_1"), { x0: 0, x1: 512, y0: -512, y1: 0 });
  assert.deepEqual(imageExtent(scene, "overview"), { x0: -1024, y0: -1024, x1: 1024, y1: 1024 });
  assert.deepEqual(imageExtent(scene, "core_half"), { x0: -512, y0: -512, x1: 512, y1: 512 });
  assert.equal(imageExtent(scene, "core_2_0"), null);
  assert.equal(imageExtent(scene, "nope"), null);
});

test("visibleBox covers the screen and normDeg wraps", () => {
  const b = visibleBox({ ...cam });
  near(b.x0, -1000);
  near(b.x1, 1000);
  near(b.y0, -800);
  near(b.y1, 800);
  assert.equal(normDeg(190), -170);
  assert.equal(normDeg(-190), 170);
});

function fakeCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => { calls.push([k, ...args]); return null; }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const canvas = {
    width: 0, height: 0, clientWidth: 800, clientHeight: 600, style: {},
    getContext: () => ctx,
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
  };
  return { canvas, calls };
}

test("createView2d: plan view starts on the core, picks world metres, projects back, draws on demand", () => {
  const { canvas, calls } = fakeCanvas();
  const queue = [];
  const view = createView2d(canvas, { scene, terrain: null, textures: { overview: {} } }, { raf: (fn) => queue.push(fn) });
  const p = view.pick(10 + 400, 20 + 300);
  near(p.x, 0, 1e-9);
  near(p.y, 0, 1e-9);
  assert.equal(view.pick(0, 0), null);
  const s = view.project(-512, 512);
  assert.ok(s.sx > 0 && s.sy > 0 && s.visible);
  let changes = 0;
  view.onChange(() => changes++);
  view.setOverlay("route", { kind: "line", coords: [[0, 0], [10, 10]], style: {} });
  view.setOverlay("zone", { kind: "polygon", coords: [[0, 0], [10, 0], [10, 10]], style: {} });
  view.setOverlay("pts", { kind: "points", coords: [[5, 5]], style: { shape: "diamond" } });
  assert.ok(changes >= 3);
  queue.splice(0).forEach((fn) => fn());
  assert.ok(calls.some(([k]) => k === "drawImage"));
  assert.ok(calls.some(([k]) => k === "stroke"));
  assert.ok(!calls.some(([k]) => k === "fillText" || k === "strokeText"), "no text in the canvas");
  view.setLayer("route", false);
  view.setView("walk");
  view.setEye({ x: 5, y: 5, heading_deg: 90 });
  const ahead = view.project(15, 5);
  assert.ok(ahead.sy < view.project(5, 5).sy, "east is up when the eye faces east");
  view.setOverlay("pts", null);
  assert.throws(() => view.setOverlay("x", { kind: "blob", coords: [] }));
  assert.throws(() => view.setCoreTile("core_9_9", {}));
  view.dispose();
});

test("createView2d: the overview draws the moment it arrives, and later changes draw without frames", () => {
  const { canvas, calls } = fakeCanvas();
  const timers = [];
  const view = createView2d(canvas, { scene, terrain: null, textures: {} }, {
    raf: () => 1, caf: () => {}, later: (fn) => timers.push(fn), cancelLater: () => {},
  });
  assert.ok(!calls.some(([k]) => k === "drawImage"));
  view.setCoreTile("overview", {});
  assert.ok(calls.some(([k]) => k === "drawImage"), "drawn at once, no frame needed");
  const before = calls.filter(([k]) => k === "drawImage").length;
  view.setOverlay("zone", { kind: "polygon", coords: [[0, 0], [10, 0], [10, 10]], style: {} });
  assert.equal(calls.filter(([k]) => k === "drawImage").length, before, "after the first image, changes wait for a frame");
  assert.equal(timers.length, 1);
  timers.splice(0).forEach((fn) => fn());
  assert.ok(calls.filter(([k]) => k === "drawImage").length > before, "the timer draws when no frame comes");
  view.dispose();
});

test("createView2d: a 3D-format raster spec (rgba, no image) handed over on a fallback is dropped, never drawn", () => {
  const { canvas, calls } = fakeCanvas();
  const view = createView2d(canvas, { scene, terrain: null, textures: {} }, { raf: () => 1, caf: () => {}, later: () => {}, cancelLater: () => {} });
  view.setRasterLayer("slope", { rgba: new Uint8Array(16), width: 2, height: 2, opacity: 0.9 });
  view.setLayer("slope", true);
  assert.doesNotThrow(() => view.setCoreTile("overview", {}));
  assert.equal(calls.filter(([k, img]) => k === "drawImage" && img === undefined).length, 0);
  view.setRasterLayer("slope", { image: { w: 1 }, opacity: 0.9 });
  view.dispose();
});
