// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { routeBounds, freeInsets, FIT_PAD_M, fitInFree, freeCentreOffset, opaqueBottom } from "../src/fit.js";
import { fitPlan, worldToScreen } from "../src/view2d.js";

const inputs = { base: { x: 200, y: 300 }, stations: [{ x: -100, y: 50 }, { x: 20, y: -80 }] };

test("routeBounds: base, stations and the route, plus the margin", () => {
  assert.equal(FIT_PAD_M, 60);
  assert.deepEqual(routeBounds(inputs), { x0: -160, y0: -140, x1: 260, y1: 360 });
  const route = { ok: true, legs: [{ path: [[200, 300], [-150, 40]] }] };
  assert.deepEqual(routeBounds(inputs, route), { x0: -210, y0: -140, x1: 260, y1: 360 });
  assert.equal(routeBounds({ stations: [] }), null);
  assert.equal(routeBounds(null), null);
});

test("freeInsets: bands on top and bottom, the dock on the right", () => {
  const frame = { left: 0, top: 0, right: 1366, bottom: 768 };
  const ins = freeInsets(frame, [
    { left: 0, top: 0, right: 1366, bottom: 56 },
    { left: 990, top: 56, right: 1366, bottom: 604 },
    { left: 0, top: 604, right: 1366, bottom: 768 },
    null,
    { left: 0, top: 0, right: 0, bottom: 0 },
  ]);
  assert.deepEqual(ins, { top: 56, right: 376, bottom: 164, left: 0 });
});

test("freeInsets at 390 px: the bottom sheet and the strip stack at the bottom", () => {
  const frame = { left: 0, top: 0, right: 390, bottom: 844 };
  const ins = freeInsets(frame, [
    { left: 0, top: 0, right: 390, bottom: 48 },
    { left: 0, top: 640, right: 390, bottom: 772 },
    { left: 0, top: 772, right: 390, bottom: 844 },
    { left: 8, top: 56, right: 52, bottom: 290 },
  ]);
  assert.deepEqual(ins, { top: 48, right: 0, bottom: 204, left: 52 });
});

test("fitPlan puts the box inside the free area, centred on it", () => {
  const b = { x0: -160, y0: -140, x1: 260, y1: 360 };
  const ins = { top: 56, right: 376, bottom: 164, left: 0 };
  const w = 1366;
  const h = 768;
  const cam = { ...fitPlan(b, ins, w, h), w, h };
  const nw = worldToScreen(cam, b.x0, b.y1);
  const se = worldToScreen(cam, b.x1, b.y0);
  const eps = 1e-6;
  assert.ok(nw.sx >= ins.left - eps && nw.sy >= ins.top - eps, JSON.stringify(nw));
  assert.ok(se.sx <= w - ins.right + eps && se.sy <= h - ins.bottom + eps, JSON.stringify(se));
  const mid = worldToScreen(cam, 50, 110);
  assert.ok(Math.abs(mid.sx - (w - ins.right) / 2) < 1e-6);
  assert.ok(Math.abs(mid.sy - (ins.top + (h - ins.bottom - ins.top) / 2)) < 1e-6);
});

test("freeInsets for the story shell: the title, stepper and caption are bands, the drawer and map controls columns", () => {
  const frame = { left: 0, top: 0, right: 1366, bottom: 768 };
  const ins = freeInsets(frame, [
    { left: 12, top: 0, right: 232, bottom: 54 }, // name, top left
    { left: 400, top: 0, right: 912, bottom: 48 }, // stepper, top centre
    { left: 332, top: 396, right: 1034, bottom: 742 }, // caption, bottom centre (narrower than the frame)
    { left: 1304, top: 392, right: 1354, bottom: 730 }, // map controls, bottom right
    { left: 950, top: 56, right: 1366, bottom: 768 }, // the open drawer
  ]);
  assert.deepEqual(ins, { top: 54, right: 416, bottom: 372, left: 0 });
});

// The walk box of the real inputs (about 470 m by 660 m) and the 2048 m surround image.
const walk = { x0: -242, y0: -317, x1: 229, y1: 344 };
const image = { x0: -1024, y0: -1024, x1: 1024, y1: 1024 };
const toScreen = (f, w, h, x, y, gx = 1, gy = 1) => ({ sx: w / 2 + (x - f.cx) * f.scale * gx, sy: h / 2 - (y - f.cy) * f.scale * gy });
const insideRect = (p, r, eps = 1e-6) => p.sx >= r.l - eps && p.sx <= r.r + eps && p.sy >= r.t - eps && p.sy <= r.b + eps;

test("fitInFree: the walk fills the free rectangle right of the caption plate, with the padding", () => {
  const w = 1366;
  const h = 768;
  const ins = { top: 55, right: 68, bottom: 26, left: 428 };
  const f = fitInFree(walk, ins, w, h, { pad: 24, extent: image });
  const free = { l: 428 + 24, r: w - 68 - 24, t: 55 + 24, b: h - 26 - 24 };
  assert.ok(insideRect(toScreen(f, w, h, walk.x0, walk.y1), free));
  assert.ok(insideRect(toScreen(f, w, h, walk.x1, walk.y0), free));
  // the long side touches the padded edges
  const top = toScreen(f, w, h, walk.x0, walk.y1).sy;
  const bottom = toScreen(f, w, h, walk.x1, walk.y0).sy;
  assert.ok(Math.abs(bottom - top - (free.b - free.t)) < 1e-6);
  // centred on the free rectangle
  const mid = toScreen(f, w, h, (walk.x0 + walk.x1) / 2, (walk.y0 + walk.y1) / 2);
  assert.ok(Math.abs(mid.sx - (free.l + free.r) / 2) < 1e-6 && Math.abs(mid.sy - (free.t + free.b) / 2) < 1e-6);
});

test("fitInFree: the image always covers the screen (no page background beside it)", () => {
  for (const [w, h, ins] of [[1366, 768, { top: 55, right: 68, bottom: 26, left: 428 }], [1920, 1080, { top: 55, right: 68, bottom: 26, left: 428 }], [3000, 600, { top: 0, right: 0, bottom: 0, left: 0 }]]) {
    const f = fitInFree(walk, ins, w, h, { pad: 24, extent: image });
    for (const [sx, sy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const x = f.cx + (sx - w / 2) / f.scale;
      const y = f.cy - (sy - h / 2) / f.scale;
      assert.ok(x >= image.x0 - 1e-6 && x <= image.x1 + 1e-6 && y >= image.y0 - 1e-6 && y <= image.y1 + 1e-6, `${w}x${h} corner ${sx},${sy}: ${x},${y}`);
    }
  }
  // a very wide screen: the scale goes up until the image fills the width
  const wide = fitInFree(walk, {}, 3000, 600, { extent: image });
  assert.ok(Math.abs(wide.scale - 3000 / 2048) < 1e-9);
});

test("fitInFree on a phone: a strip under opaque chrome may show past the image, so the walk sits above the caption", () => {
  const w = 390;
  const h = 844;
  const ins = { top: 93, right: 58, bottom: 360, left: 0 };
  const strict = fitInFree(walk, ins, w, h, { pad: 24, extent: image });
  const relaxed = fitInFree(walk, ins, w, h, { pad: 24, extent: image, cover: { bottom: 360 } });
  const free = { l: 24, r: w - 58 - 24, t: 93 + 24, b: h - 360 - 24 };
  assert.ok(!insideRect(toScreen(strict, w, h, walk.x1, walk.y0), free), "covering the whole phone screen pushes the walk under the caption");
  assert.ok(insideRect(toScreen(relaxed, w, h, walk.x0, walk.y1), free));
  assert.ok(insideRect(toScreen(relaxed, w, h, walk.x1, walk.y0), free));
  // the part of the screen above the caption still shows image only
  for (const [sx, sy] of [[0, 0], [w, 0], [0, h - 360], [w, h - 360]]) {
    const y = relaxed.cy - (sy - h / 2) / relaxed.scale;
    const x = relaxed.cx + (sx - w / 2) / relaxed.scale;
    assert.ok(x >= image.x0 && x <= image.x1 && y >= image.y0 && y <= image.y1);
  }
});

test("fitInFree: the 3D ground scale and the zoom limits", () => {
  const f = fitInFree(walk, {}, 1000, 1000, { gx: 2, gy: 2, maxScale: 0.1 });
  assert.equal(f.scale, 0.1);
  const g = fitInFree(walk, {}, 1000, 1000, { gx: 2, gy: 2 });
  assert.ok(Math.abs(g.scale - 1000 / (661 * 2)) < 1e-9, "scale is in px per world unit");
});

test("freeCentreOffset and opaqueBottom", () => {
  assert.deepEqual(freeCentreOffset({ top: 55, right: 68, bottom: 26, left: 428 }, 1366, 768), { dx: 180, dy: 14.5 });
  assert.deepEqual(freeCentreOffset({}, 800, 600), { dx: 0, dy: 0 });
  const frame = { left: 0, top: 0, right: 390, bottom: 844 };
  // the credit and the caption sheet stack from the bottom edge, edge to edge
  assert.equal(opaqueBottom(frame, [{ left: 0, top: 820, right: 390, bottom: 844 }, { left: 0, top: 484, right: 390, bottom: 820 }, { left: 332, top: 280, right: 382, bottom: 476 }]), 360);
  // a plate that leaves the sides free (wide screens) is not edge to edge
  assert.equal(opaqueBottom({ left: 0, top: 0, right: 1366, bottom: 768 }, [{ left: 0, top: 742, right: 1366, bottom: 768 }, { left: 12, top: 223, right: 428, bottom: 730 }]), 26);
  assert.equal(opaqueBottom(frame, [null]), 0);
});
