// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Frames: local projected metres x east, y north (plan A4). Inside the terrain group a vertex is
// (x, h - h0, -y); the group scale (ground_scale.x, exaggeration, ground_scale.y) turns that into true
// ground metres in the world, so exaggeration and ground scale never touch the vertex buffers.
// Textures keep flipY false: image row 0 (north) sits at v = 0. ImageBitmaps ignore flipY in WebGL anyway.
// Nothing with a digit is ever drawn here; labels follow project() in the DOM (plan A5).
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { toUint16 } from "./terrain.js";
import { fitInFree, FIT_PAD_PX } from "./fit.js";

// Assumption, not a sourced value: eye height of a standing suited astronaut above the ground.
export const EYE_HEIGHT_M = 1.7;
export const TEXTURE_FLIP_Y = false;
export const MAX_TILT_DEG = 70;
export const MAX_ZOOM_PX_PER_M = 10;
export const SKIRT_DEPTH_M = 6;
// Same geometry as src/styles/hatches.svg, drawn in screen pixels so it stays legible at every zoom. The no-go zone
// is a light diagonal cross hatch: ink lines with a paper casing every 10 px (NOGO_HATCH), no tint under it.
export const NOGO_HATCH = { period_px: 10, ink_px: 1.4, casing_px: 1 };
export const PATTERNS = { "hatch-caution": 0, "hatch-blocked": 1, "hatch-nogo": 2, diagonal: 0, cross: 1, grid: 2 };
export const SHAPES = { circle: 0, square: 1, diamond: 2, triangle: 3 };
// Used only when the caller passes no colour; values copied from src/styles/tokens.css (--ink, --paper, --grey-3).
export const FALLBACK = { ink: "#14161a", line: "#f4f1ea", plain: "#6b6862", sky: "#cdc7bb" };

const DEG = Math.PI / 180;
const MIN_POLAR = 1e-4;
const ORTHO_RADIUS_M = 4000;
// Wheel: 0.95 ^ (1.6 x one notch of 100) is about 8 % per notch; a double click is three notches.
export const WHEEL_ZOOM_SPEED = 1.6;
export const WHEEL_NOTCH = 100;

// ---------------------------------------------------------------------------------------------
// Pure parts (no WebGL). Tested in tests/scene3d.test.js.
// ---------------------------------------------------------------------------------------------

export function groundScale(scene) {
  const g = scene ? scene.ground_scale : undefined;
  if (typeof g === "number" && Number.isFinite(g) && g > 0) return { x: g, y: 1 };
  if (g && typeof g === "object") {
    const x = Number(g.x);
    const y = Number(g.y);
    return { x: Number.isFinite(x) && x > 0 ? x : 1, y: Number.isFinite(y) && y > 0 ? y : 1 };
  }
  return { x: 1, y: 1 };
}

// Midpoint of the valid heights in metres, so relative heights stay small in float32.
export function referenceHeight(grid, nodata, offset, scale) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < grid.length; k++) {
    const v = grid[k];
    if (v === nodata) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return offset;
  return offset + ((lo + hi) / 2) * scale;
}

// Whole-grid relative heights with no-data filled from the nearest valid sample in the row, then from the
// row above. Filling the whole grid once keeps shared chunk borders identical.
export function fillNoData(grid, n, nodata, offset, scale, h0) {
  const out = new Float32Array(n * n);
  let anyPrevRow = false;
  for (let j = 0; j < n; j++) {
    const row = j * n;
    let firstValid = -1;
    let last = NaN;
    for (let i = 0; i < n; i++) {
      const v = grid[row + i];
      if (v !== nodata) {
        last = offset + v * scale - h0;
        if (firstValid < 0) firstValid = i;
        out[row + i] = last;
      } else if (!Number.isNaN(last)) {
        out[row + i] = last;
      } else {
        out[row + i] = NaN;
      }
    }
    if (firstValid < 0) {
      for (let i = 0; i < n; i++) out[row + i] = anyPrevRow ? out[row - n + i] : 0;
    } else {
      const lead = out[row + firstValid];
      for (let i = 0; i < firstValid; i++) out[row + i] = lead;
      anyPrevRow = true;
    }
  }
  return out;
}

export function relRange(rel) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < rel.length; k++) {
    const v = rel[k];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo === Infinity ? { min: 0, max: 0 } : { min: lo, max: hi };
}

// Bilinear on a filled relative grid (row 0 north, column 0 west, samples on the grid corners).
export function sampleGrid(rel, n, half, step, x, y) {
  if (!(Math.abs(x) <= half && Math.abs(y) <= half)) return null;
  const fx = (x + half) / step;
  const fy = (half - y) / step;
  const i0 = Math.min(Math.floor(fx), n - 2);
  const j0 = Math.min(Math.floor(fy), n - 2);
  const tx = fx - i0;
  const ty = fy - j0;
  const a = rel[j0 * n + i0];
  const b = rel[j0 * n + i0 + 1];
  const c = rel[(j0 + 1) * n + i0];
  const d = rel[(j0 + 1) * n + i0 + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// One chunk per image tile; chunk borders share DEM samples. lowDetail keeps every second sample.
export function coreChunkLayout(scene, { lowDetail = false, sampleStride = 0 } = {}) {
  const n = scene.core.dem_samples;
  const size = scene.core.size_m;
  const step = size / (n - 1);
  const tiles = scene.core.tiles;
  const tr = tiles.length;
  const tc = tiles[0].length;
  const stride = sampleStride || (lowDetail ? 2 : 1);
  const cellsX = (n - 1) / tc;
  const cellsY = (n - 1) / tr;
  if (!Number.isInteger(cellsX) || !Number.isInteger(cellsY) || cellsX % stride || cellsY % stride) {
    throw new Error(`core DEM of ${n} samples does not split into ${tr} x ${tc} chunks at stride ${stride}`);
  }
  const chunks = [];
  for (let r = 0; r < tr; r++) {
    for (let c = 0; c < tc; c++) {
      chunks.push({
        row: r,
        col: c,
        i0: c * cellsX,
        j0: r * cellsY,
        cols: cellsX / stride + 1,
        rows: cellsY / stride + 1,
        west: -size / 2 + c * cellsX * step,
        north: size / 2 - r * cellsY * step,
        width: cellsX * step,
        height: cellsY * step,
      });
    }
  }
  return { n, step, stride, tileRows: tr, tileCols: tc, chunks };
}

export function skirtVertexCount(cols, rows) {
  return 2 * cols + 2 * rows;
}

// Vertices (i, j) row-major, then skirt strips: north (j = 0), south (j = rows - 1), west (i = 0), east.
export function gridPositions(rel, n, { i0 = 0, j0 = 0, cols, rows, stride = 1, west, north, step, skirtDepth = 0 }) {
  const nv = cols * rows + (skirtDepth > 0 ? skirtVertexCount(cols, rows) : 0);
  const out = new Float32Array(nv * 3);
  let k = 0;
  for (let j = 0; j < rows; j++) {
    const z = -(north - j * stride * step);
    const srow = (j0 + j * stride) * n;
    for (let i = 0; i < cols; i++) {
      out[k++] = west + i * stride * step;
      out[k++] = rel[srow + i0 + i * stride];
      out[k++] = z;
    }
  }
  if (skirtDepth > 0) {
    const copyDown = (vi) => {
      out[k++] = out[vi * 3];
      out[k++] = out[vi * 3 + 1] - skirtDepth;
      out[k++] = out[vi * 3 + 2];
    };
    for (let i = 0; i < cols; i++) copyDown(i);
    for (let i = 0; i < cols; i++) copyDown((rows - 1) * cols + i);
    for (let j = 0; j < rows; j++) copyDown(j * cols);
    for (let j = 0; j < rows; j++) copyDown(j * cols + cols - 1);
  }
  return out;
}

// u east, v south, both 0..1 edge to edge: vertex (0, 0) is the north-west corner = texel (0, 0).
export function gridUvs(cols, rows, skirt = false) {
  const nv = cols * rows + (skirt ? skirtVertexCount(cols, rows) : 0);
  const out = new Float32Array(nv * 2);
  let k = 0;
  const put = (i, j) => {
    out[k++] = cols > 1 ? i / (cols - 1) : 0;
    out[k++] = rows > 1 ? j / (rows - 1) : 0;
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) put(i, j);
  if (skirt) {
    for (let i = 0; i < cols; i++) put(i, 0);
    for (let i = 0; i < cols; i++) put(i, rows - 1);
    for (let j = 0; j < rows; j++) put(0, j);
    for (let j = 0; j < rows; j++) put(cols - 1, j);
  }
  return out;
}

// Triangles wind counter-clockwise seen from above (+Y). keepCell(i, j) gets vertex-unit cell corners.
export function gridIndex(cols, rows, { stride = 1, skirt = false, keepCell = null } = {}) {
  if ((cols - 1) % stride || (rows - 1) % stride) throw new Error("grid size does not fit the stride");
  const cx = (cols - 1) / stride;
  const cy = (rows - 1) / stride;
  const idx = (i, j) => j * cols + i;
  let count = 0;
  const cap = (cx * cy + (skirt ? cx * 2 + cy * 2 : 0)) * 6;
  const out = new Uint32Array(cap);
  for (let j = 0; j + stride < rows; j += stride) {
    for (let i = 0; i + stride < cols; i += stride) {
      if (keepCell && !keepCell(i, j)) continue;
      const a = idx(i, j);
      const b = idx(i, j + stride);
      const c = idx(i + stride, j);
      const d = idx(i + stride, j + stride);
      out[count++] = a; out[count++] = b; out[count++] = c;
      out[count++] = c; out[count++] = b; out[count++] = d;
    }
  }
  if (skirt) {
    const base = cols * rows;
    const strip = (topOf, bottomBase, len) => {
      for (let t = 0; t + stride < len; t += stride) {
        const t0 = topOf(t);
        const t1 = topOf(t + stride);
        const b0 = bottomBase + t;
        const b1 = bottomBase + t + stride;
        out[count++] = t0; out[count++] = b0; out[count++] = t1;
        out[count++] = t1; out[count++] = b0; out[count++] = b1;
      }
    };
    strip((i) => idx(i, 0), base, cols);
    strip((i) => idx(i, rows - 1), base + cols, cols);
    strip((j) => idx(0, j), base + 2 * cols, rows);
    strip((j) => idx(cols - 1, j), base + 2 * cols + rows, rows);
  }
  return count === cap ? out : out.slice(0, count);
}

// Drops surround cells whose centre lies inside the core square.
export function surroundKeepCell(n, step, half, holeHalf) {
  return (i, j) => {
    const x = -half + (i + 0.5) * step;
    const y = half - (j + 0.5) * step;
    return !(Math.abs(x) < holeHalf && Math.abs(y) < holeHalf);
  };
}

// Surround vertices that lie on the border of the core square (snapped to core heights).
export function surroundRingVertices(n, step, half, holeHalf) {
  const eps = step * 1e-6;
  const out = [];
  for (let j = 0; j < n; j++) {
    const y = half - j * step;
    if (Math.abs(y) > holeHalf + eps) continue;
    for (let i = 0; i < n; i++) {
      const x = -half + i * step;
      if (Math.abs(x) > holeHalf + eps) continue;
      const onX = Math.abs(Math.abs(x) - holeHalf) <= eps;
      const onY = Math.abs(Math.abs(y) - holeHalf) <= eps;
      if (onX || onY) out.push(j * n + i);
    }
  }
  return Uint32Array.from(out);
}

// [offsetU, offsetV, scaleU, scaleV] that maps chunk uv (0..1) into an image covering imageRect.
export function uvTransform(chunkRect, imageRect) {
  return [
    (chunkRect.west - imageRect.west) / imageRect.width,
    (imageRect.north - chunkRect.north) / imageRect.height,
    chunkRect.width / imageRect.width,
    chunkRect.height / imageRect.height,
  ];
}

// Texel under a uv with flipY false: row 0 is the image's top row (north).
export function uvToTexel(u, v, width, height) {
  return {
    col: Math.min(width - 1, Math.max(0, Math.floor(u * width))),
    row: Math.min(height - 1, Math.max(0, Math.floor(v * height))),
  };
}

export function squareRect(size) {
  return { west: -size / 2, north: size / 2, width: size, height: size };
}

// Rect whose pixel centres sit on grid samples (samples on the corners of a square of size_m).
export function sampleRect(sizeM, samples) {
  const step = sizeM / (samples - 1);
  return { west: -sizeM / 2 - step / 2, north: sizeM / 2 + step / 2, width: sizeM + step, height: sizeM + step };
}

export function toGroup(x, y, rel) {
  return [x, rel, -y];
}

export function toWorld(x, y, rel, frame) {
  return [x * frame.gs.x, rel * frame.exag, -y * frame.gs.y];
}

export function fromWorld(X, Z, frame) {
  return { x: X / frame.gs.x, y: -Z / frame.gs.y };
}

// Flat [x0, y0, x1, y1, ...] with points no farther apart than maxStep. closed repeats the first point.
export function densifyPath(coords, maxStep, { closed = false, maxPoints = 50000 } = {}) {
  const pts = coords.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (closed && pts.length > 2) pts.push(pts[0]);
  if (pts.length === 0) return new Float64Array(0);
  let total = 0;
  for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  const step = Math.max(maxStep, total / Math.max(1, maxPoints - pts.length));
  const out = [pts[0][0], pts[0][1]];
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    const len = Math.hypot(bx - ax, by - ay);
    const parts = Math.max(1, Math.ceil(len / step));
    for (let s = 1; s <= parts; s++) {
      const t = s / parts;
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return Float64Array.from(out);
}

// xy flat -> group-local xyz at relative height + lift. Missing heights take the last known one.
export function drapePoints(xy, heightRel, lift) {
  const n = xy.length / 2;
  const out = new Float32Array(n * 3);
  let last = 0;
  for (let k = 0; k < n; k++) {
    const x = xy[2 * k];
    const y = xy[2 * k + 1];
    const h = heightRel(x, y);
    if (h !== null && Number.isFinite(h)) last = h;
    out[3 * k] = x;
    out[3 * k + 1] = last + lift;
    out[3 * k + 2] = -y;
  }
  return out;
}

// One quad per segment, extruded in screen space by the line shader. Vertex order per segment:
// A side +1, A side -1, B side -1, B side +1 (the shader's normal flips at B, so B -1 lies beside A +1).
export function buildSegmentRibbon(xyz) {
  const np = xyz.length / 3;
  const ns = Math.max(0, np - 1);
  const position = new Float32Array(ns * 12);
  const other = new Float32Array(ns * 12);
  const side = new Float32Array(ns * 4);
  const index = new Uint32Array(ns * 6);
  for (let s = 0; s < ns; s++) {
    const a = s * 3;
    const b = (s + 1) * 3;
    const ends = [a, a, b, b];
    const others = [b, b, a, a];
    const sides = [1, -1, -1, 1];
    for (let v = 0; v < 4; v++) {
      const o = (s * 4 + v) * 3;
      for (let c = 0; c < 3; c++) {
        position[o + c] = xyz[ends[v] + c];
        other[o + c] = xyz[others[v] + c];
      }
      side[s * 4 + v] = sides[v];
    }
    const base = s * 4;
    index.set([base, base + 2, base + 3, base, base + 3, base + 1], s * 6);
  }
  return { position, other, side, index };
}

// Even-odd scanline fill at pixel centres. Pixel row 0 is the north edge of rect. channel 0..2 = R, G, B.
export function rasterizePolygonMask(polys, rect, w, h) {
  const out = new Uint8Array(w * h * 4);
  const pw = rect.width / w;
  const ph = rect.height / h;
  const xs = [];
  for (const poly of polys) {
    const pts = poly.coords;
    if (!pts || pts.length < 3) continue;
    const ch = poly.channel | 0;
    for (let r = 0; r < h; r++) {
      const y = rect.north - (r + 0.5) * ph;
      xs.length = 0;
      for (let k = 0; k < pts.length; k++) {
        const [x1, y1] = pts[k];
        const [x2, y2] = pts[(k + 1) % pts.length];
        if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - rect.west) / pw - 0.5));
        const c1 = Math.min(w - 1, Math.ceil((xs[k + 1] - rect.west) / pw - 0.5) - 1);
        for (let c = c0; c <= c1; c++) out[(r * w + c) * 4 + ch] = 255;
      }
    }
  }
  for (let p = 0; p < w * h; p++) out[p * 4 + 3] = 255;
  return out;
}

export function maskRectFor(polys, { pxM = 0.5, maxPx = 2048, pad = 4, clamp = null } = {}) {
  let w0 = Infinity, e0 = -Infinity, s0 = Infinity, n0 = -Infinity;
  for (const p of polys) {
    for (const [x, y] of p.coords || []) {
      if (x < w0) w0 = x;
      if (x > e0) e0 = x;
      if (y < s0) s0 = y;
      if (y > n0) n0 = y;
    }
  }
  if (w0 === Infinity) return null;
  w0 -= pad; e0 += pad; s0 -= pad; n0 += pad;
  if (clamp) {
    w0 = Math.max(w0, clamp.west);
    e0 = Math.min(e0, clamp.west + clamp.width);
    n0 = Math.min(n0, clamp.north);
    s0 = Math.max(s0, clamp.north - clamp.height);
    if (e0 <= w0 || n0 <= s0) return null;
  }
  const px = Math.max(pxM, (e0 - w0) / maxPx, (n0 - s0) / maxPx);
  const w = Math.max(1, Math.ceil((e0 - w0) / px));
  const h = Math.max(1, Math.ceil((n0 - s0) / px));
  return { west: w0, north: n0, width: w * px, height: h * px, w, h };
}

// Lambert relief shading in 0..255 per sample; 255 * sin(altitude) is a flat cell. Off by default in the app.
export function computeHillshade(rel, n, stepX, stepY, { azimuthDeg = 315, altitudeDeg = 45 } = {}) {
  const out = new Uint8Array(n * n);
  const az = azimuthDeg * DEG;
  const alt = altitudeDeg * DEG;
  const sx = Math.sin(az) * Math.cos(alt);
  const sy = Math.cos(az) * Math.cos(alt);
  const sz = Math.sin(alt);
  for (let j = 0; j < n; j++) {
    const jn = Math.max(0, j - 1);
    const js = Math.min(n - 1, j + 1);
    for (let i = 0; i < n; i++) {
      const iw = Math.max(0, i - 1);
      const ie = Math.min(n - 1, i + 1);
      const dzdx = (rel[j * n + ie] - rel[j * n + iw]) / ((ie - iw) * stepX);
      const dzdy = (rel[jn * n + i] - rel[js * n + i]) / ((js - jn) * stepY);
      const len = Math.hypot(dzdx, dzdy, 1);
      const v = (-dzdx * sx - dzdy * sy + sz) / len;
      out[j * n + i] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
  }
  return out;
}

// Camera offset from the target on the orbit sphere. heading = view direction, 0 north, clockwise.
export function planPose(target, radius, tiltDeg, headingDeg) {
  const phi = Math.max(MIN_POLAR, Math.min(MAX_TILT_DEG, tiltDeg) * DEG);
  const theta = -headingDeg * DEG;
  return {
    x: target.x + radius * Math.sin(phi) * Math.sin(theta),
    y: target.y + radius * Math.cos(phi),
    z: target.z + radius * Math.sin(phi) * Math.cos(theta),
  };
}

export function headingFromAzimuth(azimuthRad) {
  const d = (-azimuthRad / DEG) % 360;
  const h = d < 0 ? d + 360 : d;
  return Math.abs(h - 360) < 1e-9 ? 0 : h;
}

// groundRel: terrain relative height under the eye; world eye = ground * exag + EYE_HEIGHT_M.
export function walkPose({ x, y, groundRel, headingDeg, pitchDeg = -8 }, frame) {
  const [X, , Z] = toWorld(x, y, 0, frame);
  const Y = groundRel * frame.exag + EYE_HEIGHT_M;
  const h = headingDeg * DEG;
  const p = pitchDeg * DEG;
  const dir = { x: Math.sin(h) * Math.cos(p), y: Math.sin(p), z: -Math.cos(h) * Math.cos(p) };
  return { position: { x: X, y: Y, z: Z }, target: { x: X + dir.x * 10, y: Y + dir.y * 10, z: Z + dir.z * 10 }, dir };
}

export function zoomLimits(cssW, cssH, groundW, groundH) {
  const fit = Math.min(cssW / groundW, cssH / groundH);
  return { minZoom: Math.min(fit * 0.9, MAX_ZOOM_PX_PER_M), maxZoom: MAX_ZOOM_PX_PER_M };
}

// hWorld(X, Z) -> world height or null. Returns the first crossing of the ray below the terrain.
export function rayMarchHeightfield(o, d, hWorld, { yMin, yMax, stepM = 1, iterations = 24 } = {}) {
  if (!(d.y < 0)) {
    if (o.y > yMax || d.y === 0) return null;
  }
  let t0 = 0;
  if (o.y > yMax) {
    if (!(d.y < 0)) return null;
    t0 = (yMax - o.y) / d.y;
  }
  const t1 = d.y < 0 ? (yMin - o.y) / d.y : t0 + 20000;
  if (!(t1 > t0)) return null;
  const hfrac = Math.hypot(d.x, d.z);
  const dt = Math.min(t1 - t0, stepM / Math.max(hfrac, 1e-9));
  const at = (t) => ({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t });
  const below = (t) => {
    const p = at(t);
    const h = hWorld(p.x, p.z);
    return h === null ? null : p.y <= h;
  };
  let prev = t0;
  for (let t = t0; ; t = Math.min(t + dt, t1)) {
    const b = below(t);
    if (b === true) {
      let lo = prev;
      let hi = t;
      for (let k = 0; k < iterations; k++) {
        const mid = (lo + hi) / 2;
        if (below(mid) === true) hi = mid;
        else lo = mid;
      }
      const p = at(hi);
      return { x: p.x, y: hWorld(p.x, p.z), z: p.z };
    }
    prev = t;
    if (t >= t1) return null;
  }
}

// True when terrain rises more than tol above the straight line from a towards b (skips the first skipM).
export function segmentOccluded(a, b, hWorld, { stepM = 2, tol = 0.3, skipM = 2, yMax = Infinity } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len <= skipM) return false;
  for (let s = skipM; s < len; s += stepM) {
    const t = s / len;
    const y = a.y + dy * t;
    if (y > yMax + tol) return false;
    const h = hWorld(a.x + dx * t, a.z + dz * t);
    if (h !== null && h > y + tol) return true;
  }
  return false;
}

export function triangleBudget(scene, { lowDetail = false, sampleStride = 0, surroundStride = 1 } = {}) {
  const lay = coreChunkLayout(scene, { lowDetail, sampleStride });
  let core = 0;
  let skirts = 0;
  for (const ch of lay.chunks) {
    core += (ch.cols - 1) * (ch.rows - 1) * 2;
    skirts += ((ch.cols - 1) * 2 + (ch.rows - 1) * 2) * 2;
  }
  const sn = scene.surround.dem_samples;
  const sstep = scene.surround.size_m / (sn - 1);
  const keep = surroundKeepCell(sn, sstep, scene.surround.size_m / 2, scene.core.size_m / 2);
  let surround = 0;
  for (let j = 0; j < sn - 1; j+=surroundStride) for (let i = 0; i < sn - 1; i+=surroundStride) if (keep(i, j)) surround += 2;
  return { core, skirts, surround, total: core + skirts + surround };
}

function colorOr(value, fallback) {
  return typeof value === "string" && value ? value : fallback;
}

function styleOf(kind, style = {}) {
  return {
    color: colorOr(style.color, FALLBACK.line),
    casing: colorOr(style.casing, FALLBACK.ink),
    width_px: Number.isFinite(style.width_px) ? style.width_px : 3,
    casing_px: Number.isFinite(style.casing_px) ? style.casing_px : 1.5,
    shape: SHAPES[style.shape] === undefined ? "circle" : style.shape,
    size_px: Number.isFinite(style.size_px) ? style.size_px : 14,
    pattern: PATTERNS[style.pattern] === undefined ? "hatch-nogo" : style.pattern,
    hatch_color: colorOr(style.hatch_color, colorOr(style.color, FALLBACK.line)),
    hatch_casing: colorOr(style.hatch_casing, FALLBACK.line),
    layer: typeof style.layer === "string" ? style.layer : null,
    z: Number.isInteger(style.z) ? Math.max(0, Math.min(5, style.z)) : 0,
    kind,
  };
}

// ---------------------------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------------------------

const TERRAIN_VS = /* glsl */ `
varying vec2 vUv;
varying vec2 vXY;
void main() {
  vUv = uv;
  vXY = vec2(position.x, -position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TERRAIN_FS = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uMapXform;
uniform float uImageOn;
uniform vec3 uPlain;
uniform sampler2D uRaster;
uniform vec4 uRasterRect;
uniform float uRasterOn;
uniform float uRasterOpacity;
uniform sampler2D uRasterHatch;
uniform float uRasterHatchOn;
uniform vec3 uRasterHatchColor;
uniform sampler2D uShade;
uniform vec4 uShadeRect;
uniform float uShadeOn;
uniform float uShadeStrength;
uniform sampler2D uHatch;
uniform vec4 uHatchRect;
uniform float uHatchOn;
uniform vec3 uHatchColor0;
uniform vec3 uHatchColor1;
uniform vec3 uHatchColor2;
uniform vec3 uHatchCasing2;
uniform vec3 uNogo;
uniform float uPixelRatio;
varying vec2 vUv;
varying vec2 vXY;

vec2 rectUv(vec4 r, vec2 p) { return vec2((p.x - r.x) / r.z, (r.y - p.y) / r.w); }
float inside(vec2 uv) { return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
float stripe(float coord, float spacing, float width) { return step(mod(coord, spacing), width); }
float lineDist(float coord, float spacing) { float m = mod(coord, spacing); return min(m, spacing - m); }

void main() {
  vec3 col = uImageOn > 0.5 ? texture2D(uMap, uMapXform.xy + vUv * uMapXform.zw).rgb : uPlain;
  vec2 fc = gl_FragCoord.xy / uPixelRatio;
  if (uShadeOn > 0.5) {
    vec2 su = rectUv(uShadeRect, vXY);
    if (inside(su) > 0.5) {
      float f = texture2D(uShade, su).r / 0.7071;
      col *= mix(1.0, f, uShadeStrength);
    }
  }
  if (uRasterOn > 0.5) {
    vec2 ru = rectUv(uRasterRect, vXY);
    if (inside(ru) > 0.5) {
      vec4 r = texture2D(uRaster, ru);
      col = mix(col, r.rgb, r.a * uRasterOpacity);
      if (uRasterHatchOn > 0.5) {
        float m = texture2D(uRasterHatch, ru).r;
        float caution = step(0.25 / 255.0, m) * (1.0 - step(127.5 / 255.0, m));
        float blocked = step(127.5 / 255.0, m);
        // Slope hatch: ink at 55 percent, no casing, so the terrain stays readable underneath.
        // Blocked = one 45 degree family, 9.5 px apart, 1.5 px wide. Caution = a sparse dot grid, 10 px apart.
        float lineBlocked = stripe((fc.x + fc.y) * 0.70711, 9.5, 1.5);
        float dotCaution = 1.0 - step(1.3, length(mod(fc, 10.0) - 5.0));
        col = mix(col, uRasterHatchColor, 0.55 * (caution * dotCaution + blocked * lineBlocked));
      }
    }
  }
  if (uHatchOn > 0.5) {
    vec2 hu = rectUv(uHatchRect, vXY);
    if (inside(hu) > 0.5) {
      vec4 m = texture2D(uHatch, hu);
      float diag = stripe(fc.x + fc.y, 10.0, 2.0);
      float back = stripe(fc.x - fc.y, 10.0, 2.0);
      col = mix(col, uHatchColor0, step(0.5, m.r) * diag);
      col = mix(col, uHatchColor1, step(0.5, m.g) * max(diag, back));
      // No-go: 45 and 135 degree ink lines with a paper casing (uNogo = period, ink width, casing width in px).
      float dn = min(lineDist((fc.x + fc.y) * 0.70711, uNogo.x), lineDist((fc.x - fc.y) * 0.70711, uNogo.x));
      float nogo = step(0.5, m.b);
      col = mix(col, uHatchCasing2, nogo * (1.0 - step(uNogo.y * 0.5 + uNogo.z, dn)));
      col = mix(col, uHatchColor2, nogo * (1.0 - step(uNogo.y * 0.5, dn)));
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const BIAS_GLSL = /* glsl */ `
uniform float uOrtho;
uniform float uBiasOrtho;
uniform float uBiasPersp;
vec4 biasView(vec4 v) {
  if (uOrtho > 0.5) { v.z += uBiasOrtho; return v; }
  float d = length(v.xyz);
  float b = max(0.05, d * uBiasPersp);
  v.xyz *= max(d - b, d * 0.5) / max(d, 1e-6);
  return v;
}`;

const LINE_VS = /* glsl */ `
${BIAS_GLSL}
uniform vec2 uResolution;
uniform float uWidth;
uniform float uNear;
attribute vec3 aOther;
attribute float aSide;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0);
  vec4 b = modelViewMatrix * vec4(aOther, 1.0);
  if (uOrtho < 0.5) {
    float lim = -uNear;
    bool aBehind = a.z > lim;
    bool bBehind = b.z > lim;
    if (aBehind && bBehind) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    if (aBehind) a = mix(b, a, (b.z - lim) / (b.z - a.z));
    else if (bBehind) b = mix(a, b, (a.z - lim) / (a.z - b.z));
  }
  a = biasView(a);
  b = biasView(b);
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 sa = (ca.xy / ca.w) * 0.5 * uResolution;
  vec2 sb = (cb.xy / cb.w) * 0.5 * uResolution;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 off = (nrm * aSide - dir) * (uWidth * 0.5);
  ca.xy += off / (0.5 * uResolution) * ca.w;
  gl_Position = ca;
}`;

const FLAT_FS = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;

const POINT_VS = /* glsl */ `
${BIAS_GLSL}
uniform float uSize;
void main() {
  vec4 mv = biasView(modelViewMatrix * vec4(position, 1.0));
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize;
}`;

const POINT_FS = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCasing;
uniform float uShape;
uniform float uInner;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float d;
  if (uShape < 0.5) d = length(p);
  else if (uShape < 1.5) d = max(abs(p.x), abs(p.y));
  else if (uShape < 2.5) d = abs(p.x) + abs(p.y);
  else d = max(-p.y, max(0.866 * p.x + 0.5 * p.y, -0.866 * p.x + 0.5 * p.y)) / 0.5;
  if (d > 1.0) discard;
  gl_FragColor = vec4(d > uInner ? uCasing : uColor, 1.0);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------------------------------------
// The scene (thin three.js layer)
// ---------------------------------------------------------------------------------------------

function parseTileName(name) {
  const m = /^core_(\d+)_(\d+)$/.exec(name);
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}

export function displayStride(lowDetail, rendererName, adaptive = true) {
  return lowDetail ? (adaptive && /SwiftShader|llvmpipe|softpipe|Software/i.test(rendererName) ? 4 : 2) : 1;
}

export function createScene3d(canvas, data, extraOptions = {}) {
  const opts = { ...data, ...extraOptions };
  const { scene, terrain } = opts;
  if (!scene || !terrain || !terrain.surround) throw new Error("createScene3d needs scene and a terrain with the surround DEM");
  const lowDetail = !!opts.lowDetail;
  const hgt = scene.height;
  const frame = { gs: groundScale(scene), exag: 1, h0: referenceHeight(terrain.surround, hgt.nodata, hgt.offset_m, hgt.scale_m) };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias !== false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const maxPR = Number.isFinite(opts.maxPixelRatio) ? opts.maxPixelRatio : lowDetail ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, maxPR));
  // Plan view clears to the page ink; the walk view to a plain daylight tone (tokens.css --sky-plain), no gradient.
  const clear = { plan: colorOr(opts.background, FALLBACK.ink), walk: colorOr(opts.sky, FALLBACK.sky) };
  renderer.setClearColor(new THREE.Color(clear.plan), 1);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const context=renderer.getContext(), debug=context.getExtension('WEBGL_debug_renderer_info');
  const rendererName=debug?String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';
  const detailStride=displayStride(lowDetail,rendererName,opts.adaptiveDisplay===true);
  const surroundStride=detailStride;
  canvas.dataset.surfaceStride=String(detailStride);

  const world = new THREE.Scene();
  const group = new THREE.Group();
  group.scale.set(frame.gs.x, frame.exag, frame.gs.y);
  world.add(group);

  const S = scene.surround;
  const C = scene.core;
  const sn = S.dem_samples;
  const sHalf = S.size_m / 2;
  const sStep = S.size_m / (sn - 1);
  const cHalf = C.size_m / 2;
  const surroundRect = squareRect(S.size_m);
  const coreRect = squareRect(C.size_m);
  const surroundRel = fillNoData(terrain.surround, sn, hgt.nodata, hgt.offset_m, hgt.scale_m, frame.h0);
  let coreRel = null;
  let coreLayout = null;
  let range = relRange(surroundRel);

  const listeners = { change: new Set(), lost: new Set(), restored: new Set(), render: new Set() };
  const disposables = new Set();
  const track = (obj) => {
    disposables.add(obj);
    return obj;
  };

  // ---- uniforms shared by every terrain material
  const shared = {
    uImageOn: { value: 1 },
    uPlain: { value: new THREE.Color(colorOr(opts.plainColor, FALLBACK.plain)) },
    uRaster: { value: null },
    uRasterRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRasterOn: { value: 0 },
    uRasterOpacity: { value: 0.6 },
    uRasterHatch: { value: null },
    uRasterHatchOn: { value: 0 },
    uRasterHatchColor: { value: new THREE.Color(FALLBACK.ink) },
    uHatch: { value: null },
    uHatchRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uHatchOn: { value: 0 },
    uHatchColor0: { value: new THREE.Color(FALLBACK.ink) },
    uHatchColor1: { value: new THREE.Color(FALLBACK.ink) },
    uHatchColor2: { value: new THREE.Color(FALLBACK.ink) },
    uHatchCasing2: { value: new THREE.Color(FALLBACK.line) },
    uNogo: { value: new THREE.Vector3(NOGO_HATCH.period_px, NOGO_HATCH.ink_px, NOGO_HATCH.casing_px) },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uShadeStrength: { value: 1 },
  };
  const shadeSurround = { uShade: { value: null }, uShadeRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uShadeOn: { value: 0 } };
  const shadeCore = { uShade: { value: null }, uShadeRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uShadeOn: { value: 0 } };
  const overlayShared = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uOrtho: { value: 1 },
    uNear: { value: 0.1 },
    uBiasOrtho: { value: 1.0 },
    uBiasPersp: { value: 0.004 },
  };

  function terrainMaterial(shade) {
    return track(
      new THREE.ShaderMaterial({
        uniforms: { ...shared, ...shade, uMap: { value: null }, uMapXform: { value: new THREE.Vector4(0, 0, 1, 1) } },
        vertexShader: TERRAIN_VS,
        fragmentShader: TERRAIN_FS,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
  }

  function imageTexture(img) {
    const t = new THREE.Texture(img);
    t.flipY = TEXTURE_FLIP_Y;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    track(t);
    try {
      renderer.initTexture(t);
    } catch {
      // upload happens on first render instead
    }
    return t;
  }

  function dataTexture(arr, w, h, format, { srgb = false, nearest = false, mipmaps = false } = {}) {
    const t = new THREE.DataTexture(arr, w, h, format, THREE.UnsignedByteType);
    t.flipY = false;
    t.unpackAlignment = 1;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.generateMipmaps = mipmaps;
    t.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : t.magFilter;
    t.anisotropy = mipmaps ? aniso : 1;
    t.needsUpdate = true;
    return track(t);
  }

  // ---- surround mesh
  const surroundGeom = track(new THREE.BufferGeometry());
  const surroundPos = new THREE.BufferAttribute(
    gridPositions(surroundRel, sn, { cols: sn, rows: sn, west: -sHalf, north: sHalf, step: sStep }),
    3,
  );
  surroundGeom.setAttribute("position", surroundPos);
  surroundGeom.setAttribute("uv", new THREE.BufferAttribute(gridUvs(sn, sn), 2));
  surroundGeom.setIndex(new THREE.BufferAttribute(gridIndex(sn, sn, {stride:surroundStride}), 1));
  surroundGeom.computeBoundingSphere();
  const surroundMat = terrainMaterial(shadeSurround);
  const surroundMesh = new THREE.Mesh(surroundGeom, surroundMat);
  surroundMesh.renderOrder = 0;
  group.add(surroundMesh);

  // ---- textures by rank: tile 4, core_half 3, surround image 2, overview 1
  const images = { overview: null, surround: null, core_half: null, tiles: new Map() };
  let surroundRank = 0;
  const chunkState = [];

  function setSurroundMap() {
    const best = images.surround ? [images.surround, 2] : images.overview ? [images.overview, 1] : null;
    if (!best || best[1] <= surroundRank) return;
    surroundRank = best[1];
    surroundMat.uniforms.uMap.value = best[0];
    surroundMat.uniforms.uMapXform.value.set(0, 0, 1, 1);
  }

  function refreshChunkMaps() {
    for (const ch of chunkState) {
      const tile = images.tiles.get(`${ch.layout.row}_${ch.layout.col}`);
      let pick = null;
      if (tile) pick = [tile, 4, [0, 0, 1, 1]];
      else if (images.core_half) pick = [images.core_half, 3, uvTransform(ch.layout, coreRect)];
      else if (images.surround) pick = [images.surround, 2, uvTransform(ch.layout, surroundRect)];
      else if (images.overview) pick = [images.overview, 1, uvTransform(ch.layout, surroundRect)];
      if (!pick || pick[1] <= ch.rank) continue;
      ch.rank = pick[1];
      ch.material.uniforms.uMap.value = pick[0];
      ch.material.uniforms.uMapXform.value.set(...pick[2]);
    }
  }

  // A second image under the same name replaces the first (imagery switch): the old texture is disposed and the
  // rank it held is released, otherwise the equal-rank new texture would never be bound.
  function replaced(old, rank) {
    if (!old) return;
    old.dispose();
    disposables.delete(old);
    if ((rank === 1 || rank === 2) && surroundRank === rank) surroundRank = 0;
    for (const ch of chunkState) if (ch.rank === rank) ch.rank = 0;
  }

  function addImage(name, img) {
    if (!img) return false;
    const t = parseTileName(name);
    if (t) {
      const key = `${t.row}_${t.col}`;
      const old = images.tiles.get(key);
      images.tiles.set(key, imageTexture(img));
      if (old) {
        old.dispose();
        disposables.delete(old);
        for (const ch of chunkState) if (`${ch.layout.row}_${ch.layout.col}` === key) ch.rank = 0;
      }
    } else if (name === "core_half") {
      const old = images.core_half;
      images.core_half = imageTexture(img);
      replaced(old, 3);
    } else if (name === "surround") {
      const old = images.surround;
      images.surround = imageTexture(img);
      replaced(old, 2);
    } else if (name === "overview") {
      const old = images.overview;
      images.overview = imageTexture(img);
      replaced(old, 1);
    } else return false;
    setSurroundMap();
    refreshChunkMaps();
    requestRender();
    return true;
  }

  // ---- core chunks
  function heightRel(x, y) {
    if (coreRel && Math.abs(x) <= cHalf && Math.abs(y) <= cHalf) return sampleGrid(coreRel, C.dem_samples, cHalf, coreLayout.step, x, y);
    return sampleGrid(surroundRel, sn, sHalf, sStep, x, y);
  }
  const hWorld = (X, Z) => {
    const p = fromWorld(X, Z, frame);
    const h = heightRel(p.x, p.y);
    return h === null ? null : h * frame.exag;
  };

  function setCoreTerrain(core = terrain.core) {
    if (!core || coreRel) return false;
    const n = C.dem_samples;
    if (core.length !== n * n) throw new Error(`core DEM has ${core.length} samples, expected ${n * n}`);
    coreLayout = coreChunkLayout(scene, { lowDetail, sampleStride:detailStride });
    coreRel = fillNoData(core, n, hgt.nodata, hgt.offset_m, hgt.scale_m, frame.h0);
    const cr = relRange(coreRel);
    range = { min: Math.min(range.min, cr.min), max: Math.max(range.max, cr.max) };
    const first = coreLayout.chunks[0];
    const uvAttr = new THREE.BufferAttribute(gridUvs(first.cols, first.rows, true), 2);
    const fullIndex = new THREE.BufferAttribute(gridIndex(first.cols, first.rows, { skirt: true }), 1);
    const lodIndex = lowDetail
      ? null
      : new THREE.BufferAttribute(gridIndex(first.cols, first.rows, { stride: 2, skirt: true }), 1);
    for (const ch of coreLayout.chunks) {
      const pos = new THREE.BufferAttribute(
        gridPositions(coreRel, n, { ...ch, stride: coreLayout.stride, step: coreLayout.step, skirtDepth: SKIRT_DEPTH_M }),
        3,
      );
      const material = terrainMaterial(shadeCore);
      const make = (index) => {
        const g = track(new THREE.BufferGeometry());
        g.setAttribute("position", pos);
        g.setAttribute("uv", uvAttr);
        g.setIndex(index);
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, material);
        group.add(m);
        return m;
      };
      const full = make(fullIndex);
      const lod = lodIndex ? make(lodIndex) : null;
      if (lod) lod.visible = false;
      chunkState.push({ layout: ch, material, full, lod, rank: 0 });
    }
    surroundGeom.setIndex(
      new THREE.BufferAttribute(gridIndex(sn, sn, { stride:surroundStride, keepCell: surroundKeepCell(sn, sStep, sHalf, cHalf) }), 1),
    );
    const ring = surroundRingVertices(sn, sStep, sHalf, cHalf);
    for (const vi of ring) {
      const x = surroundPos.getX(vi);
      const y = -surroundPos.getZ(vi);
      const h = sampleGrid(coreRel, n, cHalf, coreLayout.step, x, y);
      if (h !== null) surroundPos.setY(vi, h);
    }
    surroundPos.needsUpdate = true;
    surroundGeom.computeBoundingSphere();
    refreshChunkMaps();
    if (shadeOn) buildShade();
    redrapeAll();
    applyView();
    requestRender();
    return true;
  }

  // ---- hillshade (separate, off by default)
  let shadeOn = false;
  let shadeBuilt = { surround: false, core: false };
  function buildShade() {
    if (!shadeBuilt.surround) {
      const hs = computeHillshade(surroundRel, sn, sStep * frame.gs.x, sStep * frame.gs.y);
      shadeSurround.uShade.value = dataTexture(hs, sn, sn, THREE.RedFormat, { mipmaps: true });
      const r = sampleRect(S.size_m, sn);
      shadeSurround.uShadeRect.value.set(r.west, r.north, r.width, r.height);
      shadeBuilt.surround = true;
    }
    if (coreRel && !shadeBuilt.core) {
      const n = C.dem_samples;
      const step = C.size_m / (n - 1);
      const hs = computeHillshade(coreRel, n, step * frame.gs.x, step * frame.gs.y);
      shadeCore.uShade.value = dataTexture(hs, n, n, THREE.RedFormat, { mipmaps: true });
      const r = sampleRect(C.size_m, n);
      shadeCore.uShadeRect.value.set(r.west, r.north, r.width, r.height);
      shadeBuilt.core = true;
    }
  }
  function setHillshade(on) {
    shadeOn = !!on;
    if (shadeOn) buildShade();
    shadeSurround.uShadeOn.value = shadeOn ? 1 : 0;
    shadeCore.uShadeOn.value = shadeOn && shadeBuilt.core ? 1 : 0;
    requestRender();
  }

  // ---- raster layers (one shown at a time: the most recently enabled one)
  const rasters = new Map();
  const layerState = new Map([["image", true], ["hillshade", false]]);
  const rasterOrder = [];
  function applyRaster() {
    let active = null;
    for (let k = rasterOrder.length - 1; k >= 0; k--) {
      const id = rasterOrder[k];
      if (rasters.has(id) && layerState.get(id) === true) {
        active = rasters.get(id);
        break;
      }
    }
    shared.uRasterOn.value = active ? 1 : 0;
    shared.uRasterHatchOn.value = active && active.hatch ? 1 : 0;
    if (active) {
      shared.uRaster.value = active.tex;
      shared.uRasterRect.value.set(active.rect.west, active.rect.north, active.rect.width, active.rect.height);
      shared.uRasterOpacity.value = active.opacity;
      shared.uRasterHatch.value = active.hatch;
      shared.uRasterHatchColor.value.set(active.hatchColor);
    }
    requestRender();
  }

  // spec: {rgba: Uint8Array w*h*4 (sRGB), width, height} or {image: ImageBitmap | canvas},
  // rect {west, north, width, height} in projected metres (default: the core square), opacity 0..1,
  // filter "nearest" | "linear", hatch: Uint8Array w*h (0 none, 1..127 hatch-caution, 128..255 hatch-blocked), hatch_color.
  function setRasterLayer(id, spec) {
    const old = rasters.get(id);
    if (old) {
      old.tex.dispose();
      if (old.hatch) old.hatch.dispose();
      rasters.delete(id);
    }
    if (spec) {
      let tex;
      if (spec.image) {
        tex = imageTexture(spec.image);
        if (spec.filter === "nearest") tex.magFilter = THREE.NearestFilter;
      } else {
        const w = spec.width;
        const h = spec.height;
        if (!spec.rgba || spec.rgba.length !== w * h * 4) throw new Error(`raster ${id}: rgba must hold width * height * 4 bytes`);
        tex = dataTexture(spec.rgba, w, h, THREE.RGBAFormat, { srgb: true, nearest: spec.filter !== "linear", mipmaps: true });
      }
      let hatch = null;
      if (spec.hatch) {
        const w = spec.width || (spec.image && spec.image.width);
        const h = spec.height || (spec.image && spec.image.height);
        if (spec.hatch.length !== w * h) throw new Error(`raster ${id}: hatch must hold width * height bytes`);
        hatch = dataTexture(spec.hatch, w, h, THREE.RedFormat, { nearest: true });
      }
      rasters.set(id, {
        tex,
        hatch,
        rect: spec.rect || coreRect,
        opacity: Number.isFinite(spec.opacity) ? spec.opacity : 0.6,
        hatchColor: colorOr(spec.hatch_color, FALLBACK.ink),
        legend: spec.legend || null,
      });
      if (!layerState.has(id)) layerState.set(id, false);
    }
    applyRaster();
  }

  // ---- overlays
  const overlays = new Map();
  const lineMaterial = (color, widthPx) =>
    track(
      new THREE.ShaderMaterial({
        uniforms: { ...overlayShared, uColor: { value: new THREE.Color(color) }, uWidth: { value: widthPx } },
        vertexShader: LINE_VS,
        fragmentShader: FLAT_FS,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );

  function overlayVisible(ov) {
    const key = ov.style.layer || ov.id;
    return layerState.get(key) !== false;
  }

  function buildRibbon(ov, coordsList, closed) {
    const step = lowDetail ? 2 : 1;
    const lift = lowDetail ? 0.4 : 0.15;
    const pr = renderer.getPixelRatio();
    for (const coords of coordsList) {
      const xy = densifyPath(coords, step, { closed });
      if (xy.length < 4) continue;
      const rb = buildSegmentRibbon(drapePoints(xy, heightRel, lift));
      const g = track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.BufferAttribute(rb.position, 3));
      g.setAttribute("aOther", new THREE.BufferAttribute(rb.other, 3));
      g.setAttribute("aSide", new THREE.BufferAttribute(rb.side, 1));
      g.setIndex(new THREE.BufferAttribute(rb.index, 1));
      const casing = lineMaterial(ov.style.casing, (ov.style.width_px + 2 * ov.style.casing_px) * pr);
      casing.depthWrite = false;
      const fill = lineMaterial(ov.style.color, ov.style.width_px * pr);
      const mc = new THREE.Mesh(g, casing);
      const mf = new THREE.Mesh(g, fill);
      // Lines of one z share a pass (casings first, so crossings merge); a higher z draws over the lower ones.
      mc.renderOrder = 10 + 3 * ov.style.z;
      mf.renderOrder = 11 + 3 * ov.style.z;
      mc.frustumCulled = false;
      mf.frustumCulled = false;
      ov.objects.push(mc, mf);
    }
  }

  function buildPoints(ov) {
    const xy = [];
    for (const p of ov.coords) if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) xy.push(p[0], p[1]);
    if (!xy.length) return;
    const pos = drapePoints(Float64Array.from(xy), heightRel, lowDetail ? 0.4 : 0.15);
    const g = track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pr = renderer.getPixelRatio();
    const size = ov.style.size_px * pr;
    const m = track(
      new THREE.ShaderMaterial({
        uniforms: {
          ...overlayShared,
          uSize: { value: size },
          uColor: { value: new THREE.Color(ov.style.color) },
          uCasing: { value: new THREE.Color(ov.style.casing) },
          uShape: { value: SHAPES[ov.style.shape] },
          uInner: { value: Math.max(0, 1 - (2 * ov.style.casing_px) / ov.style.size_px) },
        },
        vertexShader: POINT_VS,
        fragmentShader: POINT_FS,
        toneMapped: false,
      }),
    );
    const pts = new THREE.Points(g, m);
    pts.renderOrder = 30;
    pts.frustumCulled = false;
    ov.objects.push(pts);
  }

  function clearOverlayObjects(ov) {
    for (const o of ov.objects) {
      group.remove(o);
      o.geometry.dispose();
      disposables.delete(o.geometry);
      o.material.dispose();
      disposables.delete(o.material);
    }
    ov.objects = [];
  }

  function buildOverlay(ov) {
    clearOverlayObjects(ov);
    if (ov.style.kind === "line") buildRibbon(ov, [ov.coords], false);
    else if (ov.style.kind === "polygon") buildRibbon(ov, [ov.coords], true);
    else buildPoints(ov);
    const vis = overlayVisible(ov);
    for (const o of ov.objects) {
      o.visible = vis;
      group.add(o);
    }
  }

  function redrapeAll() {
    for (const ov of overlays.values()) buildOverlay(ov);
    rebuildHatch();
  }

  let hatchTex = null;
  function rebuildHatch() {
    const polys = [];
    const colors = [null, null, null];
    let casing2 = null;
    for (const ov of overlays.values()) {
      if (ov.style.kind !== "polygon" || !overlayVisible(ov) || ov.coords.length < 3) continue;
      const ch = PATTERNS[ov.style.pattern];
      polys.push({ coords: ov.coords, channel: ch });
      colors[ch] = ov.style.hatch_color;
      if (ch === 2) casing2 = ov.style.hatch_casing;
    }
    if (hatchTex) {
      hatchTex.dispose();
      disposables.delete(hatchTex);
      hatchTex = null;
    }
    const rect = polys.length ? maskRectFor(polys, { clamp: surroundRect }) : null;
    if (!rect) {
      shared.uHatchOn.value = 0;
      requestRender();
      return;
    }
    hatchTex = dataTexture(rasterizePolygonMask(polys, rect, rect.w, rect.h), rect.w, rect.h, THREE.RGBAFormat);
    shared.uHatch.value = hatchTex;
    shared.uHatchRect.value.set(rect.west, rect.north, rect.width, rect.height);
    if (colors[0]) shared.uHatchColor0.value.set(colors[0]);
    if (colors[1]) shared.uHatchColor1.value.set(colors[1]);
    if (colors[2]) shared.uHatchColor2.value.set(colors[2]);
    if (casing2) shared.uHatchCasing2.value.set(casing2);
    shared.uHatchOn.value = 1;
    requestRender();
  }

  // spec: {kind: "line" | "points" | "polygon", coords: [[x, y]], style}; null removes the overlay.
  function setOverlay(id, spec) {
    const old = overlays.get(id);
    if (old) {
      clearOverlayObjects(old);
      overlays.delete(id);
    }
    if (spec) {
      const kind = ["line", "points", "polygon"].includes(spec.kind) ? spec.kind : null;
      if (!kind) throw new Error(`overlay ${id}: kind must be line, points or polygon`);
      const ov = { id, coords: Array.isArray(spec.coords) ? spec.coords : [], style: styleOf(kind, spec.style), objects: [] };
      overlays.set(id, ov);
      buildOverlay(ov);
    }
    if ((old && old.style.kind === "polygon") || (spec && spec.kind === "polygon")) rebuildHatch();
    requestRender();
  }

  function setLayer(id, on) {
    const v = !!on;
    if (id === "image") {
      layerState.set(id, v);
      shared.uImageOn.value = v ? 1 : 0;
      requestRender();
      return;
    }
    if (id === "hillshade") {
      layerState.set(id, v);
      setHillshade(v);
      return;
    }
    layerState.set(id, v);
    const k = rasterOrder.indexOf(id);
    if (k >= 0) rasterOrder.splice(k, 1);
    if (v) rasterOrder.push(id);
    else rasterOrder.unshift(id);
    let polygonsChanged = false;
    for (const ov of overlays.values()) {
      if ((ov.style.layer || ov.id) !== id) continue;
      for (const o of ov.objects) o.visible = v;
      if (ov.style.kind === "polygon") polygonsChanged = true;
    }
    if (polygonsChanged) rebuildHatch();
    applyRaster();
  }

  // ---- cameras
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, ORTHO_RADIUS_M * 2.5);
  const perspCam = new THREE.PerspectiveCamera(70, 1, 0.1, 6000);
  const controls = new MapControls(orthoCam, canvas);
  controls.enableDamping = false;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = MAX_TILT_DEG * DEG;
  controls.maxTargetRadius = Math.hypot(sHalf * frame.gs.x, sHalf * frame.gs.y);
  // Gentle wheel: about 8 % per notch toward the cursor; one wheel event never moves more than one notch, so a fast
  // two-finger scroll or a trackpad pinch (ctrl + wheel) zooms smoothly instead of jumping.
  controls.zoomSpeed = WHEEL_ZOOM_SPEED;
  const wheelEvent = controls._customWheelEvent.bind(controls);
  controls._customWheelEvent = (event) => {
    const e = wheelEvent(event);
    if (!event.marswalkStep) e.deltaY = Math.max(-WHEEL_NOTCH, Math.min(WHEEL_NOTCH, e.deltaY));
    return e;
  };
  // Touch: one finger pans, two fingers pinch to zoom and pan; the twist of two fingers turns the map (below).
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  let view = "plan";
  let eye = { x: 0, y: 0, heading_deg: 0, pitch_deg: -8 };
  let cssW = 1;
  let cssH = 1;

  function groundWorldY(x, y) {
    const h = heightRel(x, y);
    return (h === null ? 0 : h) * frame.exag;
  }

  function setPlanPose(tx, ty, tiltDeg, headingDeg) {
    const target = { x: tx * frame.gs.x, y: groundWorldY(tx, ty), z: -ty * frame.gs.y };
    controls.target.set(target.x, target.y, target.z);
    const p = planPose(target, ORTHO_RADIUS_M, tiltDeg, headingDeg);
    orthoCam.position.set(p.x, p.y, p.z);
    orthoCam.up.set(0, 1, 0);
    orthoCam.lookAt(controls.target);
    controls.update();
  }

  function planState() {
    const p = fromWorld(controls.target.x, controls.target.z, frame);
    const polar = controls.getPolarAngle();
    return {
      x: p.x,
      y: p.y,
      tilt_deg: polar <= MIN_POLAR * 1.5 ? 0 : polar / DEG,
      heading_deg: headingFromAzimuth(controls.getAzimuthalAngle()),
      zoom: orthoCam.zoom,
    };
  }

  function updateZoomLimits() {
    const lim = zoomLimits(cssW, cssH, S.size_m * frame.gs.x, S.size_m * frame.gs.y);
    controls.minZoom = lim.minZoom;
    controls.maxZoom = lim.maxZoom;
    const z = Math.max(lim.minZoom, Math.min(lim.maxZoom, orthoCam.zoom));
    if (z !== orthoCam.zoom) {
      orthoCam.zoom = z;
      orthoCam.updateProjectionMatrix();
    }
  }

  function fitView(which = "core") {
    centreOffset.dx = 0;
    centreOffset.dy = 0;
    applyCentreOffset();
    const size = which === "surround" ? S.size_m : C.size_m;
    const z = Math.min(cssW / (size * frame.gs.x), cssH / (size * frame.gs.y)) * 0.95;
    orthoCam.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, z));
    orthoCam.updateProjectionMatrix();
    setPlanPose(0, 0, 0, 0);
    changed();
  }

  // Where the orbit centre (the controls target) sits on screen, from the canvas centre, in CSS px. The step 1 view
  // puts it in the middle of the area the story chrome leaves free; the fit and the plain views clear it.
  const centreOffset = { dx: 0, dy: 0 };
  function applyCentreOffset() {
    if (centreOffset.dx || centreOffset.dy) orthoCam.setViewOffset(cssW, cssH, -centreOffset.dx, -centreOffset.dy, cssW, cssH);
    else orthoCam.clearViewOffset();
    orthoCam.updateProjectionMatrix();
  }
  function setCentreOffset(dx = 0, dy = 0) {
    centreOffset.dx = Number.isFinite(dx) ? dx : 0;
    centreOffset.dy = Number.isFinite(dy) ? dy : 0;
    applyCentreOffset();
    changed();
  }

  // Top-down, north up: the box b = {x0, y0, x1, y1} in metres fills the free part of the canvas (insets in CSS px,
  // opts.pad px more on every side), never so far out that the page background shows beside the surround image.
  function fitBounds(b, insets = {}, opts = {}) {
    if (view !== "plan" || !b) return;
    centreOffset.dx = 0;
    centreOffset.dy = 0;
    const f = fitInFree(b, insets, cssW, cssH, {
      pad: opts.pad ?? FIT_PAD_PX, gx: frame.gs.x, gy: frame.gs.y, extent: { x0: -sHalf, y0: -sHalf, x1: sHalf, y1: sHalf }, cover: opts.cover || null,
      minScale: controls.minZoom, maxScale: controls.maxZoom,
    });
    orthoCam.zoom = f.scale;
    applyCentreOffset();
    anim = null;
    setPlanPose(f.cx, f.cy, 0, 0);
    changed();
  }

  function applyWalkPose() {
    const g = heightRel(eye.x, eye.y);
    const pose = walkPose({ x: eye.x, y: eye.y, groundRel: g === null ? 0 : g, headingDeg: eye.heading_deg, pitchDeg: eye.pitch_deg }, frame);
    perspCam.position.set(pose.position.x, pose.position.y, pose.position.z);
    perspCam.up.set(0, 1, 0);
    perspCam.lookAt(pose.target.x, pose.target.y, pose.target.z);
    perspCam.updateMatrixWorld();
  }

  function applyView() {
    renderer.setClearColor(new THREE.Color(view === "walk" ? clear.walk : clear.plan), 1);
    controls.enabled = view === "plan";
    if (view === "walk") applyWalkPose();
  }

  const activeCamera = () => (view === "walk" ? perspCam : orthoCam);

  function resize() {
    const w = canvas.clientWidth || (cssW === 1 ? canvas.width : 0);
    const h = canvas.clientHeight || (cssH === 1 ? canvas.height : 0);
    if (!w || !h) return;
    cssW = w;
    cssH = h;
    renderer.setSize(w, h, false);
    orthoCam.left = -w / 2;
    orthoCam.right = w / 2;
    orthoCam.top = h / 2;
    orthoCam.bottom = -h / 2;
    applyCentreOffset();
    perspCam.aspect = w / h;
    perspCam.updateProjectionMatrix();
    updateZoomLimits();
    requestRender();
    emitChange();
  }

  // ---- render on demand
  let raf = 0;
  let continuous = false;
  let anim = null;
  let disposed = false;
  let lost = false;

  function requestRender() {
    if (!raf && !disposed) raf = requestAnimationFrame(frameLoop);
  }

  function frameLoop(t) {
    raf = 0;
    if (anim) stepAnim(t);
    renderNow(t);
    if (continuous || anim) requestRender();
  }

  function renderNow(t = performance.now()) {
    if (disposed || lost) return;
    const cam = activeCamera();
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    overlayShared.uResolution.value.copy(buf);
    overlayShared.uOrtho.value = cam.isOrthographicCamera ? 1 : 0;
    overlayShared.uNear.value = cam.near * 1.01;
    shared.uPixelRatio.value = renderer.getPixelRatio();
    const useLod = view === "plan" && orthoCam.zoom < 1;
    for (const ch of chunkState) {
      if (!ch.lod) continue;
      ch.full.visible = !useLod;
      ch.lod.visible = useLod;
    }
    renderer.render(world, cam);
    for (const fn of listeners.render) fn(t);
  }

  function emitChange() {
    if (!listeners.change.size) return;
    const st = getCamera();
    for (const fn of listeners.change) fn(st);
  }

  function changed() {
    requestRender();
    emitChange();
  }

  controls.addEventListener("change", changed);

  // Double click zooms in one step toward the pointer (three wheel notches through the same controls).
  function onDblClick(e) {
    if (view !== "plan" || typeof WheelEvent !== "function") return;
    e.preventDefault();
    const w = new WheelEvent("wheel", { clientX: e.clientX, clientY: e.clientY, deltaY: -3 * WHEEL_NOTCH, deltaMode: 0, cancelable: true });
    w.marswalkStep = true;
    canvas.dispatchEvent(w);
  }
  // Two touching fingers that twist turn the map with them.
  const touches = new Map();
  let twist = null;
  const twistAngle = () => {
    const [a, b] = [...touches.values()];
    return Math.atan2(b.y - a.y, b.x - a.x) / DEG;
  };
  function onTouchDown(e) {
    if (e.pointerType !== "touch") return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    twist = touches.size === 2 ? twistAngle() : null;
  }
  function onTouchMove(e) {
    if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2 || twist === null || view !== "plan") return;
    const now = twistAngle();
    let d = now - twist;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    twist = now;
    if (Math.abs(d) > 0.05) rotateBy(-d);
  }
  function onTouchUp(e) {
    touches.delete(e.pointerId);
    twist = touches.size === 2 ? twistAngle() : null;
  }
  canvas.addEventListener("dblclick", onDblClick);
  canvas.addEventListener("pointerdown", onTouchDown);
  canvas.addEventListener("pointermove", onTouchMove);
  canvas.addEventListener("pointerup", onTouchUp);
  canvas.addEventListener("pointercancel", onTouchUp);

  // ---- animation (flyTo)
  const reducedMotion = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function stepAnim(t) {
    if (anim.start === null) anim.start = t;
    const k = Math.min(1, (t - anim.start) / anim.ms);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const st = planState();
    setPlanPose(anim.from.x + (anim.to.x - anim.from.x) * e, anim.from.y + (anim.to.y - anim.from.y) * e, st.tilt_deg, st.heading_deg);
    if (k >= 1) anim = null;
  }

  // opts: animate; tilt_deg, heading_deg and span_m (metres across the short side of the canvas) set a whole pose at
  // once, without animation (the story's opening view).
  function flyTo(x, y, { animate = true, tilt_deg, heading_deg, span_m } = {}) {
    if (view === "walk") {
      setEye({ ...eye, x, y });
      return;
    }
    const st = planState();
    if (Number.isFinite(tilt_deg) || Number.isFinite(heading_deg) || Number.isFinite(span_m)) {
      anim = null;
      if (Number.isFinite(span_m) && span_m > 0) {
        const z = Math.min(cssW, cssH) / (span_m * frame.gs.x);
        orthoCam.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, z));
        orthoCam.updateProjectionMatrix();
      }
      setPlanPose(x, y, Number.isFinite(tilt_deg) ? tilt_deg : st.tilt_deg, Number.isFinite(heading_deg) ? heading_deg : st.heading_deg);
      changed();
      return;
    }
    if (!animate || reducedMotion()) {
      anim = null;
      setPlanPose(x, y, st.tilt_deg, st.heading_deg);
      changed();
      return;
    }
    anim = { from: { x: st.x, y: st.y }, to: { x, y }, start: null, ms: 450 };
    requestRender();
  }

  // ---- public camera methods
  function panBy(dx, dy) {
    if (view !== "plan") return;
    controls.pan(-dx, -dy);
  }
  function zoomBy(f) {
    if (view !== "plan" || !(f > 0)) return;
    orthoCam.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, orthoCam.zoom * f));
    orthoCam.updateProjectionMatrix();
    controls.update();
    changed();
  }
  function tiltBy(deg) {
    if (view !== "plan") return;
    const st = planState();
    setPlanPose(st.x, st.y, Math.max(0, Math.min(MAX_TILT_DEG, st.tilt_deg + deg)), st.heading_deg);
    changed();
  }
  function rotateBy(deg) {
    if (view !== "plan") return;
    const st = planState();
    setPlanPose(st.x, st.y, st.tilt_deg, st.heading_deg + deg);
    changed();
  }
  function resetNorth() {
    if (view !== "plan") return;
    const st = planState();
    setPlanPose(st.x, st.y, 0, 0);
    changed();
  }

  function setView(v) {
    if (v !== "plan" && v !== "walk") throw new Error(`setView: unknown view ${v}`);
    if (v === view) return;
    if (v === "walk") {
      const st = planState();
      if (!eye.set) eye = { ...eye, x: st.x, y: st.y, heading_deg: st.heading_deg };
    }
    view = v;
    applyView();
    changed();
  }

  function setEye({ x, y, heading_deg, pitch_deg }) {
    eye = {
      x: Number.isFinite(x) ? x : eye.x,
      y: Number.isFinite(y) ? y : eye.y,
      heading_deg: Number.isFinite(heading_deg) ? heading_deg : eye.heading_deg,
      pitch_deg: Number.isFinite(pitch_deg) ? pitch_deg : eye.pitch_deg,
      set: true,
    };
    if (view === "walk") {
      applyWalkPose();
      changed();
    }
  }

  function setExaggeration(e) {
    const v = e === 2 ? 2 : 1;
    if (v === frame.exag) return;
    const st = planState();
    frame.exag = v;
    group.scale.y = v;
    setPlanPose(st.x, st.y, st.tilt_deg, st.heading_deg);
    applyView();
    changed();
  }

  const raycaster = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const cam = activeCamera();
    cam.updateMatrixWorld();
    raycaster.setFromCamera(ndc, cam);
    const hit = rayMarchHeightfield(raycaster.ray.origin, raycaster.ray.direction, hWorld, {
      yMin: range.min * frame.exag - 1,
      yMax: range.max * frame.exag + 1,
      stepM: 0.5,
    });
    return hit ? fromWorld(hit.x, hit.z, frame) : null;
  }

  // sx, sy in CSS px from the canvas top-left. visible: in front, inside the canvas, not behind terrain.
  function project(x, y) {
    const cam = activeCamera();
    cam.updateMatrixWorld();
    const h = heightRel(x, y);
    const [X, Y, Z] = toWorld(x, y, (h === null ? 0 : h) + 0.3, frame);
    const v = new THREE.Vector3(X, Y, Z).project(cam);
    const sx = ((v.x + 1) / 2) * cssW;
    const sy = ((1 - v.y) / 2) * cssH;
    let visible = v.z >= -1 && v.z <= 1 && v.x >= -1 && v.x <= 1 && v.y >= -1 && v.y <= 1;
    const tilted = view === "walk" || controls.getPolarAngle() > 1 * DEG;
    if (visible && tilted) {
      const a = { x: X, y: Y, z: Z };
      let b;
      if (cam.isPerspectiveCamera) b = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      else {
        const back = cam.getWorldDirection(new THREE.Vector3()).negate().multiplyScalar(4000);
        b = { x: X + back.x, y: Y + back.y, z: Z + back.z };
      }
      visible = !segmentOccluded(a, b, hWorld, { yMax: range.max * frame.exag, tol: 0.3 * frame.exag });
    }
    return { sx, sy, visible };
  }

  function getCamera() {
    if (view === "walk") return { view, x: eye.x, y: eye.y, heading_deg: eye.heading_deg, eye_height_m: EYE_HEIGHT_M, exaggeration: frame.exag };
    const st = planState();
    return { view, x: st.x, y: st.y, tilt_deg: st.tilt_deg, heading_deg: st.heading_deg, zoom_px_per_m: st.zoom, m_per_px: 1 / st.zoom, exaggeration: frame.exag };
  }

  // ---- context loss
  function onLost(ev) {
    lost = true;
    for (const fn of listeners.lost) fn(ev);
  }
  function onRestored(ev) {
    lost = false;
    for (const fn of listeners.restored) fn(ev);
    requestRender();
  }
  canvas.addEventListener("webglcontextlost", onLost, false);
  canvas.addEventListener("webglcontextrestored", onRestored, false);

  let ro = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  } else if (typeof addEventListener === "function") {
    addEventListener("resize", resize);
  }

  function onTile(name, payload) {
    if (name === "dem_core") return setCoreTerrain(payload instanceof ArrayBuffer ? toUint16(payload, C.dem_samples ** 2, C.dem) : payload);
    if (name === "slope_core") return false;
    return addImage(name, payload);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ro) ro.disconnect();
    else if (typeof removeEventListener === "function") removeEventListener("resize", resize);
    canvas.removeEventListener("webglcontextlost", onLost, false);
    canvas.removeEventListener("webglcontextrestored", onRestored, false);
    controls.removeEventListener("change", changed);
    canvas.removeEventListener("dblclick", onDblClick);
    canvas.removeEventListener("pointerdown", onTouchDown);
    canvas.removeEventListener("pointermove", onTouchMove);
    canvas.removeEventListener("pointerup", onTouchUp);
    canvas.removeEventListener("pointercancel", onTouchUp);
    controls.dispose();
    for (const o of overlays.values()) clearOverlayObjects(o);
    overlays.clear();
    for (const d of disposables) d.dispose();
    disposables.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    for (const set of Object.values(listeners)) set.clear();
  }

  const subscribe = (set) => (fn) => {
    set.add(fn);
    return () => set.delete(fn);
  };

  // ---- start
  const tex = opts.textures || {};
  if (tex.overview) addImage("overview", tex.overview);
  if (tex.surround) addImage("surround", tex.surround);
  resize();
  updateZoomLimits();
  fitView("core");
  if (terrain.core) setCoreTerrain(terrain.core);
  for (const [name, img] of Object.entries(tex)) if (name !== "overview" && name !== "surround") addImage(name, img);
  if (opts.exaggeration === 2) setExaggeration(2);
  requestRender();

  return {
    setView,
    getView: () => view,
    setExaggeration,
    setLayer,
    setOverlay,
    flyTo,
    setEye,
    pick,
    project,
    // Navigation coordinates intentionally ignore terrain occlusion (same semantics as the original HUD).
    projectNavigation(x, y) {
      const cam = activeCamera(); cam.updateMatrixWorld();
      const h = terrain.heightAt(x,y); if(h === null)return {visible:false,sx:0,sy:0,distance:0};
      const v = new THREE.Vector3(...toWorld(x,y,h-frame.h0+1.8,frame));
      const distance=v.distanceTo(cam.position);v.project(cam);
      return {visible:Math.abs(v.x)<.90&&Math.abs(v.y)<.88&&v.z>=-1&&v.z<=1,sx:(v.x+1)*cssW/2,sy:(1-v.y)*cssH/2,distance};
    },
    setDrawingRatio(ratio) {renderer.setPixelRatio(ratio);resize();requestRender();},
    onContextLost: subscribe(listeners.lost),
    onContextRestored: subscribe(listeners.restored),
    onChange: subscribe(listeners.change),
    onRender: subscribe(listeners.render),
    dispose,
    // additions
    onTile,
    setCoreTile: addImage,
    setSurroundImage: (img) => addImage("surround", img),
    setCoreTerrain,
    hasCore: () => !!coreRel,
    setRasterLayer,
    setHillshade: (on) => setLayer("hillshade", on),
    setBackground: (c) => {
      clear.plan = colorOr(c, clear.plan);
      applyView();
      requestRender();
    },
    panBy,
    zoomBy,
    tiltBy,
    rotateBy,
    resetNorth,
    fitView,
    fitBounds,
    setCentreOffset,
    getCamera,
    resize,
    requestRender,
    renderNow: () => renderNow(),
    setContinuous: (on) => {
      continuous = !!on;
      if (continuous) requestRender();
    },
    getStats: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      budget: triangleBudget(scene, { lowDetail, sampleStride:detailStride, surroundStride }),
      displayStride:detailStride,
      lowDetail,
    }),
    loseContextForTest: () => renderer.forceContextLoss(),
  };
}
