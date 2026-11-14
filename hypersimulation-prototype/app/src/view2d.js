// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// 2D renderer with the method names of scene3d. World = local metres (x east, y north). Screen = CSS px, origin top-left,
// y down. rot = degrees the map is turned clockwise on screen (0 = north up). No number is ever drawn into the canvas.

import { fitInFree, FIT_PAD_PX } from "./fit.js";

const DEG = Math.PI / 180;
const MAX_SCALE = 10; // px per metre: 0.1 m per pixel, the same closest zoom as the 3D view
const WALK_SPAN_M = 160; // metres across the short screen side in the walk view
const MAX_DPR = 2;
const FALLBACK_MS = 250; // a redraw waits at most this long for a frame
const WHEEL_NOTCH = 100; // one wheel notch; a single wheel event never zooms more than one notch

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function normExtent(b) {
  if (Array.isArray(b)) return { x0: b[0], y0: b[1], x1: b[2], y1: b[3] };
  return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
}

export function worldToScreen(cam, x, y) {
  const r = cam.rot * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const ux = (x - cam.cx) * cam.scale;
  const uy = -(y - cam.cy) * cam.scale;
  return { sx: cam.w / 2 + ux * cos - uy * sin, sy: cam.h / 2 + ux * sin + uy * cos };
}

export function screenToWorld(cam, sx, sy) {
  const r = cam.rot * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const px = sx - cam.w / 2;
  const py = sy - cam.h / 2;
  const ux = px * cos + py * sin;
  const uy = -px * sin + py * cos;
  return { x: cam.cx + ux / cam.scale, y: cam.cy - uy / cam.scale };
}

// Canvas matrix [a, b, c, d, e, f] taking world metres to CSS px.
export function cameraMatrix(cam) {
  const r = cam.rot * DEG;
  const a = cam.scale * Math.cos(r);
  const b = cam.scale * Math.sin(r);
  const c = b;
  const d = -a;
  return [a, b, c, d, cam.w / 2 - a * cam.cx - c * cam.cy, cam.h / 2 - b * cam.cx - d * cam.cy];
}

// Matrix for drawImage(img, 0, 0, width_m, height_m): image pixel space in metres (u east, v south from the north-west
// corner of the extent) to CSS px.
export function imageMatrix(cam, extent) {
  const [a, b, c, d, e, f] = cameraMatrix(cam);
  return [a, b, -c, -d, a * extent.x0 + c * extent.y1 + e, b * extent.x0 + d * extent.y1 + f];
}

export function fitScale(extent, w, h, pad = 1) {
  return pad * Math.min(w / (extent.x1 - extent.x0), h / (extent.y1 - extent.y0));
}

export function zoomAt(cam, factor, sx, sy, limits) {
  const scale = clamp(cam.scale * factor, limits.min, limits.max);
  const before = screenToWorld(cam, sx, sy);
  const next = { ...cam, scale };
  const after = screenToWorld(next, sx, sy);
  return { ...next, cx: cam.cx + before.x - after.x, cy: cam.cy + before.y - after.y };
}

// Moves the viewpoint by (dsx, dsy) CSS px, right and down positive. Dragging the map by (mx, my) is (-mx, -my).
export function moveViewpoint(cam, dsx, dsy) {
  const c = screenToWorld(cam, cam.w / 2 + dsx, cam.h / 2 + dsy);
  return { ...cam, cx: c.x, cy: c.y };
}

// Plan camera (north up) that shows the box b = {x0, y0, x1, y1} in metres inside the free part of a w x h screen
// (insets in CSS px: top, right, bottom, left), centred on that free part.
export function fitPlan(b, insets, w, h) {
  const ins = { top: 0, right: 0, bottom: 0, left: 0, ...(insets || {}) };
  const fw = Math.max(40, w - ins.left - ins.right);
  const fh = Math.max(40, h - ins.top - ins.bottom);
  const bw = Math.max(1, b.x1 - b.x0);
  const bh = Math.max(1, b.y1 - b.y0);
  const scale = Math.min(fw / bw, fh / bh);
  const dx = ins.left + fw / 2 - w / 2;
  const dy = ins.top + fh / 2 - h / 2;
  return { cx: (b.x0 + b.x1) / 2 - dx / scale, cy: (b.y0 + b.y1) / 2 + dy / scale, scale, rot: 0 };
}

export function clampCentre(cam, extent) {
  return { ...cam, cx: clamp(cam.cx, extent.x0, extent.x1), cy: clamp(cam.cy, extent.y0, extent.y1) };
}

export function normDeg(d) {
  const m = ((d % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
}

// Heading-up map centred on the eye: the heading direction points to the top of the screen.
export function walkCamera(eye, scale, w, h) {
  return { cx: eye.x, cy: eye.y, scale, rot: -(eye.heading_deg || 0), w, h };
}

export function visibleBox(cam) {
  const pts = [[0, 0], [cam.w, 0], [0, cam.h], [cam.w, cam.h]].map(([sx, sy]) => screenToWorld(cam, sx, sy));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

export function intersects(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// Image names: "overview" and "surround" cover the surround square, "core_half" the core square, "core_r_c" one
// quarter of the core (row 0 is north, column 0 is west).
export function imageExtent(scene, name) {
  const s = scene.surround.size_m / 2;
  const c = scene.core.size_m / 2;
  if (name === "overview" || name === "surround") return { x0: -s, y0: -s, x1: s, y1: s };
  if (name === "core_half") return { x0: -c, y0: -c, x1: c, y1: c };
  const m = /^core_(\d+)_(\d+)$/.exec(name);
  if (!m) return null;
  const rows = scene.core.tiles.length;
  const cols = scene.core.tiles[0].length;
  const r = Number(m[1]);
  const col = Number(m[2]);
  if (r >= rows || col >= cols) return null;
  const tw = scene.core.size_m / cols;
  const th = scene.core.size_m / rows;
  return { x0: -c + col * tw, x1: -c + (col + 1) * tw, y1: c - r * th, y0: c - (r + 1) * th };
}

const DRAW_ORDER = ["overview", "surround", "core_half"];

function readVar(el, name, fallback) {
  try {
    const v = globalThis.getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

function shapePath(ctx, shape, sx, sy, r) {
  ctx.beginPath();
  if (shape === "square") ctx.rect(sx - r, sy - r, 2 * r, 2 * r);
  else if (shape === "diamond") {
    ctx.moveTo(sx, sy - r * 1.3);
    ctx.lineTo(sx + r * 1.3, sy);
    ctx.lineTo(sx, sy + r * 1.3);
    ctx.lineTo(sx - r * 1.3, sy);
    ctx.closePath();
  } else if (shape === "triangle") {
    ctx.moveTo(sx, sy - r * 1.3);
    ctx.lineTo(sx + r * 1.2, sy + r);
    ctx.lineTo(sx - r * 1.2, sy + r);
    ctx.closePath();
  } else ctx.arc(sx, sy, r, 0, Math.PI * 2);
}

export function createView2d(canvas, { scene, textures = {} }, opts = {}) {
  const doc = opts.document || globalThis.document;
  const raf = opts.raf || ((fn) => (typeof globalThis.requestAnimationFrame === "function" ? globalThis.requestAnimationFrame(fn) : setTimeout(fn, 16)));
  const caf = opts.caf || ((id) => (typeof globalThis.cancelAnimationFrame === "function" ? globalThis.cancelAnimationFrame(id) : clearTimeout(id)));
  const later = opts.later || ((fn, ms) => setTimeout(fn, ms));
  const cancelLater = opts.cancelLater || ((id) => clearTimeout(id));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");

  const surroundExtent = imageExtent(scene, "surround");
  const coreExtent = imageExtent(scene, "core_half");
  const pal = {
    bg: readVar(canvas, "--map-bg", "#101418"),
    line: readVar(canvas, "--paper", "#f4f1ea"),
    casing: readVar(canvas, "--ink", "#0b0e12"),
    accent: readVar(canvas, "--accent", "#e8b84a"),
  };

  const images = new Map();
  const rasters = new Map();
  const overlays = new Map();
  const layers = new Map([["image", true]]);
  const changeFns = new Set();
  const renderFns = new Set();
  const hatches = new Map();
  let w = 1;
  let h = 1;
  let dpr = 1;
  let mode = "plan";
  let eye = null;
  let plan = { cx: 0, cy: 0, scale: 1, rot: 0 };
  let walkScale = 0;
  let planned = false;
  let dirty = false;
  let rafId = 0;
  let timerId = null;
  let imageShown = false;
  let disposed = false;
  let anim = null;

  for (const [name, img] of Object.entries(textures)) if (img && imageExtent(scene, name)) images.set(name, img);

  const limits = () => ({ min: 0.9 * fitScale(surroundExtent, w, h), max: MAX_SCALE });
  const walkLimits = () => ({ min: fitScale({ x0: 0, y0: 0, x1: 600, y1: 600 }, w, h), max: fitScale({ x0: 0, y0: 0, x1: 30, y1: 30 }, w, h) });
  const walkActive = () => mode === "walk" && eye !== null;

  function cam() {
    if (walkActive()) return walkCamera(eye, walkScale, w, h);
    return { ...plan, w, h };
  }

  function shown(id) {
    return layers.has(id) ? layers.get(id) : true;
  }

  function notify() {
    for (const fn of [...changeFns]) fn();
  }

  // Until the first image is on screen every change draws at once, so the overview shows the moment it arrives.
  // After that a change draws on the next frame, or after FALLBACK_MS when frames are slow or paused (a hidden pane).
  function flush() {
    if (!dirty) return;
    dirty = false;
    if (rafId) caf(rafId);
    rafId = 0;
    if (timerId !== null) cancelLater(timerId);
    timerId = null;
    if (!disposed) draw();
  }

  function schedule() {
    if (disposed) return;
    if (!imageShown) {
      dirty = true;
      flush();
      return;
    }
    if (dirty) return;
    dirty = true;
    rafId = raf(flush);
    timerId = later(flush, FALLBACK_MS);
  }

  function changed() {
    schedule();
    notify();
  }

  function resize() {
    if (disposed) return;
    const cw = Math.max(1, canvas.clientWidth || canvas.width || 1);
    const ch = Math.max(1, canvas.clientHeight || canvas.height || 1);
    dpr = clamp(globalThis.devicePixelRatio || 1, 1, MAX_DPR);
    if (canvas.width !== Math.round(cw * dpr)) canvas.width = Math.round(cw * dpr);
    if (canvas.height !== Math.round(ch * dpr)) canvas.height = Math.round(ch * dpr);
    w = cw;
    h = ch;
    walkScale = clamp(walkScale || fitScale({ x0: 0, y0: 0, x1: WALK_SPAN_M, y1: WALK_SPAN_M }, w, h), walkLimits().min, walkLimits().max);
    if (!planned) {
      plan = { cx: 0, cy: 0, scale: fitScale(coreExtent, w, h, 0.95), rot: 0 };
      planned = true;
    } else {
      plan = { ...plan, scale: clamp(plan.scale, limits().min, limits().max) };
    }
    changed();
  }

  // The no-go hatch (same look as scene3d NOGO_HATCH): 45 and 135 degree ink lines with a paper casing, no tint.
  function hatchFor(ink, casing) {
    const key = `${ink}|${casing}`;
    if (!hatches.has(key)) {
      let pattern = null;
      if (doc && typeof doc.createElement === "function") {
        const n = 14;
        const tile = doc.createElement("canvas");
        tile.width = n;
        tile.height = n;
        const t = tile.getContext("2d");
        if (t) {
          const lines = () => {
            t.beginPath();
            for (const o of [-n, 0, n]) {
              t.moveTo(o - 1, n + 1);
              t.lineTo(o + n + 1, -1);
              t.moveTo(o - 1, -1);
              t.lineTo(o + n + 1, n + 1);
            }
          };
          t.lineCap = "butt";
          lines();
          t.strokeStyle = casing;
          t.lineWidth = 3.4;
          t.stroke();
          lines();
          t.strokeStyle = ink;
          t.lineWidth = 1.4;
          t.stroke();
          pattern = ctx.createPattern(tile, "repeat");
        }
      }
      hatches.set(key, pattern);
    }
    return hatches.get(key);
  }

  function imageList() {
    const out = [];
    for (const name of DRAW_ORDER) if (images.has(name)) out.push(name);
    const tiles = [...images.keys()].filter((n) => /^core_\d+_\d+$/.test(n));
    const need = scene.core.tiles.flat().length;
    if (tiles.length === need) {
      const half = out.indexOf("core_half");
      if (half >= 0) out.splice(half, 1);
    }
    return out.concat(tiles.sort());
  }

  function drawImage(img, extent, c, alpha = 1) {
    if (!intersects(extent, visibleBox(c))) return;
    const m = imageMatrix(c, extent).map((v) => v * dpr);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0, extent.x1 - extent.x0, extent.y1 - extent.y0);
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function strokeCased(points, style, close) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
    if (close) ctx.closePath();
    const width = style.width ?? 3;
    ctx.strokeStyle = style.casing || pal.casing;
    ctx.lineWidth = width + 4;
    ctx.stroke();
    ctx.strokeStyle = style.color || pal.line;
    ctx.lineWidth = width;
    if (style.dash) ctx.setLineDash(style.dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawOverlay(spec, c) {
    const style = spec.style || {};
    const pts = spec.coords.map(([x, y]) => worldToScreen(c, x, y));
    if (spec.kind === "line") {
      if (pts.length > 1) strokeCased(pts, style, false);
    } else if (spec.kind === "polygon") {
      if (pts.length < 3) return;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy)));
      ctx.closePath();
      if (style.fillBase) {
        ctx.fillStyle = style.fillBase;
        ctx.fill();
      }
      const pattern = hatchFor(style.hatch_color || pal.casing, style.hatch_casing || pal.line);
      ctx.fillStyle = pattern || "rgba(20,22,26,0.2)";
      ctx.fill();
      strokeCased(pts, style, true);
    } else {
      const r = style.size ?? 7;
      for (const p of pts) {
        shapePath(ctx, style.shape || "circle", p.sx, p.sy, r);
        ctx.lineWidth = 5;
        ctx.strokeStyle = style.casing || pal.casing;
        ctx.stroke();
        ctx.fillStyle = style.color || pal.line;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = style.outline || pal.casing;
        ctx.stroke();
      }
    }
  }

  function drawEye(c) {
    if (!eye) return;
    const p = worldToScreen(c, eye.x, eye.y);
    const ang = ((eye.heading_deg || 0) + c.rot) * DEG;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(9, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = pal.casing;
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    const c = cam();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);
    if (shown("image")) {
      const list = imageList();
      for (const name of list) drawImage(images.get(name), imageExtent(scene, name), c);
      if (list.length) imageShown = true;
    } else imageShown = true;
    for (const [id, r] of rasters) if (shown(id)) drawImage(r.image, r.extent, c, r.opacity);
    const order = [...overlays].sort((a, b) => (a[1].style.z || 0) - (b[1].style.z || 0));
    for (const [id, o] of order) if (shown(id)) drawOverlay(o, c);
    drawEye(c);
    if (renderFns.size) {
      const t = (globalThis.performance || Date).now();
      for (const fn of [...renderFns]) fn(t);
    }
  }

  function stopAnim() {
    anim = null;
  }

  function step(now) {
    if (!anim || disposed) return;
    const t = clamp((now - anim.t0) / anim.ms, 0, 1);
    const k = t * t * (3 - 2 * t);
    plan = { ...plan, cx: anim.from.cx + (anim.to.cx - anim.from.cx) * k, cy: anim.from.cy + (anim.to.cy - anim.from.cy) * k };
    changed();
    if (t < 1) raf(step);
    else anim = null;
  }

  function setPlan(next) {
    plan = clampCentre({ ...next, scale: clamp(next.scale, limits().min, limits().max) }, surroundExtent);
    stopAnim();
    changed();
  }

  const view = {
    setView(name) {
      if (name !== "plan" && name !== "walk") throw new Error(`setView: unknown view "${name}"`);
      mode = name;
      changed();
    },
    // The 2D map has no height axis, so there is nothing to stretch.
    setExaggeration() {},
    setLayer(id, on) {
      layers.set(id, !!on);
      schedule();
    },
    setOverlay(id, spec) {
      if (spec === null || spec === undefined) overlays.delete(id);
      else {
        if (!["line", "points", "polygon"].includes(spec.kind)) throw new Error(`setOverlay: unknown kind "${spec.kind}"`);
        if (!Array.isArray(spec.coords)) throw new Error("setOverlay: coords must be a list of [x, y]");
        overlays.set(id, { kind: spec.kind, coords: spec.coords, style: spec.style || {} });
      }
      changed();
    },
    // spec: {image: CanvasImageSource, bounds: [x0, y0, x1, y1] or {x0, y0, x1, y1} in metres, opacity: 0..1}; null removes it.
    // A 3D-format spec (rgba, no image) can arrive when the 3D view hands over to this one: it is dropped, and the
    // layer panel sends the image form when the renderer change reaches it.
    setRasterLayer(id, spec) {
      if (spec === null || spec === undefined || !spec.image) rasters.delete(id);
      else rasters.set(id, { image: spec.image, extent: normExtent(spec.bounds || coreExtent), opacity: spec.opacity ?? 1 });
      changed();
    },
    setCoreTile(name, bitmap) {
      if (!imageExtent(scene, name)) throw new Error(`setCoreTile: unknown image name "${name}"`);
      images.set(name, bitmap);
      schedule();
    },
    // opts.span_m (metres across the short side) and opts.heading_deg set a whole pose at once, without animation;
    // the 2D map has no tilt.
    flyTo(x, y, opts = {}) {
      const to = { cx: clamp(x, surroundExtent.x0, surroundExtent.x1), cy: clamp(y, surroundExtent.y0, surroundExtent.y1) };
      if (Number.isFinite(opts.span_m) || Number.isFinite(opts.heading_deg)) {
        const scale = Number.isFinite(opts.span_m) && opts.span_m > 0 ? Math.min(w, h) / opts.span_m : plan.scale;
        setPlan({ ...plan, ...to, scale, rot: Number.isFinite(opts.heading_deg) ? normDeg(-opts.heading_deg) : plan.rot });
        return;
      }
      const reduce = globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        plan = { ...plan, ...to };
        changed();
        return;
      }
      anim = { from: { cx: plan.cx, cy: plan.cy }, to, t0: (globalThis.performance || Date).now(), ms: 350 };
      raf(step);
    },
    setEye(next) {
      eye = next ? { x: next.x, y: next.y, heading_deg: next.heading_deg ?? 0 } : null;
      changed();
    },
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const sx = clientX - r.left;
      const sy = clientY - r.top;
      if (sx < 0 || sy < 0 || sx > w || sy > h) return null;
      const p = screenToWorld(cam(), sx, sy);
      if (p.x < surroundExtent.x0 || p.x > surroundExtent.x1 || p.y < surroundExtent.y0 || p.y > surroundExtent.y1) return null;
      return p;
    },
    // CSS px relative to the canvas top-left corner.
    project(x, y) {
      const p = worldToScreen(cam(), x, y);
      return { sx: p.sx, sy: p.sy, visible: p.sx >= 0 && p.sy >= 0 && p.sx <= w && p.sy <= h };
    },
    onChange(fn) {
      changeFns.add(fn);
      return () => changeFns.delete(fn);
    },
    onContextLost() {
      return () => {};
    },
    onRender(fn) {
      renderFns.add(fn);
      return () => renderFns.delete(fn);
    },
    // Same call as scene3d: "core" (default) or "surround" fills the screen, north up.
    fitView(which = "core") {
      if (walkActive()) return;
      setPlan({ cx: 0, cy: 0, scale: fitScale(which === "surround" ? surroundExtent : coreExtent, w, h, 0.95), rot: 0 });
    },
    // opts.pad: CSS px kept free inside the insets. The fit never shows the page background beside the image.
    fitBounds(b, insets, opts = {}) {
      if (walkActive() || !b) return;
      const f = fitInFree(normExtent(b), insets, w, h, { pad: opts.pad ?? FIT_PAD_PX, extent: surroundExtent, cover: opts.cover || null, maxScale: MAX_SCALE });
      setPlan({ cx: f.cx, cy: f.cy, scale: f.scale, rot: 0 });
    },
    getCamera() {
      if (walkActive()) return { view: "walk", x: eye.x, y: eye.y, heading_deg: eye.heading_deg || 0, zoom_px_per_m: walkScale, m_per_px: 1 / walkScale };
      return { view: "plan", x: plan.cx, y: plan.cy, tilt_deg: 0, heading_deg: normDeg(-plan.rot), zoom_px_per_m: plan.scale, m_per_px: 1 / plan.scale };
    },
    requestRender() {
      schedule();
    },
    // dx, dy: move the viewpoint by this many CSS px (right and down positive).
    panBy(dx, dy) {
      if (walkActive()) return;
      setPlan(moveViewpoint({ ...plan, w, h }, dx, dy));
    },
    zoomBy(factor, sx = w / 2, sy = h / 2) {
      if (walkActive()) {
        walkScale = clamp(walkScale * factor, walkLimits().min, walkLimits().max);
        changed();
        return;
      }
      setPlan(zoomAt({ ...plan, w, h }, factor, sx, sy, limits()));
    },
    tiltBy() {},
    rotateBy(deg) {
      if (walkActive()) return;
      setPlan({ ...plan, rot: normDeg(plan.rot + deg) });
    },
    resetNorth() {
      if (walkActive()) return;
      setPlan({ ...plan, rot: 0 });
    },
    resize,
    dispose() {
      disposed = true;
      stopAnim();
      caf(rafId);
      if (timerId !== null) cancelLater(timerId);
      timerId = null;
      for (const [type, fn] of listeners) canvas.removeEventListener(type, fn);
      if (observer) observer.disconnect();
      changeFns.clear();
      renderFns.clear();
    },
  };

  // Pointer: left drag pans; right drag or shift + drag turns the map; the wheel zooms toward the cursor about 8 % per
  // notch (a trackpad pinch arrives as ctrl + wheel and zooms the same way); a double click zooms in one step. Touch:
  // one finger pans, two fingers pinch to zoom and twist to turn.
  const pointers = new Map();
  let turning = false;
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const listeners = [
    ["pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      turning = e.pointerType === "mouse" && (e.button === 2 || e.shiftKey);
    }],
    ["pointermove", (e) => {
      if (!pointers.has(e.pointerId) || walkActive()) return;
      const prev = new Map(pointers);
      const now = local(e);
      pointers.set(e.pointerId, now);
      if (pointers.size === 1) {
        const old = prev.get(e.pointerId);
        if (turning) view.rotateBy((now.x - old.x) * 0.4);
        else view.panBy(-(now.x - old.x), -(now.y - old.y));
      } else if (pointers.size === 2) {
        const ids = [...pointers.keys()];
        const a0 = prev.get(ids[0]);
        const b0 = prev.get(ids[1]);
        const a1 = pointers.get(ids[0]);
        const b1 = pointers.get(ids[1]);
        const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
        const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
        if (d0 > 0 && d1 > 0) view.zoomBy(d1 / d0, (a1.x + b1.x) / 2, (a1.y + b1.y) / 2);
        let turn = (Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x)) / DEG;
        if (turn > 180) turn -= 360;
        if (turn < -180) turn += 360;
        if (Math.abs(turn) > 0.05) view.rotateBy(turn);
      }
    }],
    ["pointerup", (e) => pointers.delete(e.pointerId)],
    ["pointercancel", (e) => pointers.delete(e.pointerId)],
    ["contextmenu", (e) => e.preventDefault()],
    ["dblclick", (e) => {
      if (walkActive()) return;
      e.preventDefault();
      const p = local(e);
      view.zoomBy(1.25, p.x, p.y);
    }],
    ["wheel", (e) => {
      e.preventDefault();
      const p = local(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dy = clamp(e.deltaY * unit * (e.ctrlKey ? 10 : 1), -WHEEL_NOTCH, WHEEL_NOTCH);
      view.zoomBy(Math.pow(0.92, dy / WHEEL_NOTCH), p.x, p.y);
    }],
  ];
  for (const [type, fn] of listeners) canvas.addEventListener(type, fn, type === "wheel" ? { passive: false } : undefined);
  if (canvas.style) canvas.style.touchAction = "none";

  let observer = null;
  if (typeof globalThis.ResizeObserver === "function") {
    observer = new globalThis.ResizeObserver(() => resize());
    observer.observe(canvas);
  }
  resize();
  return view;
}
