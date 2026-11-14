// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The plan camera fit: the box of the base, the stations and the planned route plus a margin, shown inside the part of
// the scene that the story chrome and the Details drawer leave free. Pure helpers plus one DOM reader.

export const FIT_PAD_M = 60;
// The story fits the route closer: the caption already takes a band of the screen.
export const STORY_PAD_M = 25;
// Screen padding between the fitted walk and the edge of the free area, in CSS px.
export const FIT_PAD_PX = 24;

// North-up fit of the box b = {x0, y0, x1, y1} (metres) into the free part of a w x h screen. insets {top, right,
// bottom, left} in CSS px; pad: extra px on every side of the free part. gx, gy: world units per metre (the 3D view's
// ground scale; 1 in 2D). extent: the image square in metres; the scale never goes below the one where the image
// covers the screen, and the centre stays where the screen shows image only (no page background beside it). cover:
// insets of the screen part that must show image (default the whole screen); a strip that opaque chrome covers edge
// to edge (the caption sheet and the credit on a phone) may show what it likes.
// Returns {cx, cy} in metres (the point at the screen centre) and scale in px per world unit.
export function fitInFree(b, insets, w, h, { pad = 0, gx = 1, gy = 1, extent = null, cover = null, minScale = 0, maxScale = Infinity } = {}) {
  const ins = { top: 0, right: 0, bottom: 0, left: 0, ...(insets || {}) };
  const l = ins.left + pad;
  const t = ins.top + pad;
  const fw = Math.max(40, w - l - ins.right - pad);
  const fh = Math.max(40, h - t - ins.bottom - pad);
  const bw = Math.max(1, b.x1 - b.x0);
  const bh = Math.max(1, b.y1 - b.y0);
  const cv = { top: 0, right: 0, bottom: 0, left: 0, ...(cover || {}) };
  const cl = Math.max(0, cv.left);
  const cr = Math.max(cl + 1, w - Math.max(0, cv.right));
  const ct = Math.max(0, cv.top);
  const cb = Math.max(ct + 1, h - Math.max(0, cv.bottom));
  let scale = Math.min(fw / (bw * gx), fh / (bh * gy));
  if (extent) scale = Math.max(scale, (cr - cl) / ((extent.x1 - extent.x0) * gx), (cb - ct) / ((extent.y1 - extent.y0) * gy));
  scale = Math.min(maxScale, Math.max(minScale, scale));
  const dx = l + fw / 2 - w / 2;
  const dy = t + fh / 2 - h / 2;
  let cx = (b.x0 + b.x1) / 2 - dx / (scale * gx);
  let cy = (b.y0 + b.y1) / 2 + dy / (scale * gy);
  if (extent) {
    // The screen edges cl, cr (x) and ct, cb (y, down) must land on the image.
    const kx = scale * gx;
    const ky = scale * gy;
    const xlo = extent.x0 - (cl - w / 2) / kx;
    const xhi = extent.x1 - (cr - w / 2) / kx;
    const ylo = extent.y0 + (cb - h / 2) / ky;
    const yhi = extent.y1 + (ct - h / 2) / ky;
    cx = xlo > xhi ? (xlo + xhi) / 2 : Math.min(xhi, Math.max(xlo, cx));
    cy = ylo > yhi ? (ylo + yhi) / 2 : Math.min(yhi, Math.max(ylo, cy));
  }
  return { cx, cy, scale };
}

// The strip at the bottom of the frame that opaque chrome covers edge to edge (rectangles as wide as the frame,
// stacked from the bottom edge without a gap), in CSS px.
export function opaqueBottom(frame, rects) {
  const full = rects.filter((r) => r && r.left <= frame.left + 1 && r.right >= frame.right - 1 && r.bottom > r.top);
  let edge = frame.bottom;
  for (let moved = true; moved;) {
    moved = false;
    for (const r of full) {
      if (r.top < edge && r.bottom >= edge - 1) {
        edge = r.top;
        moved = true;
      }
    }
  }
  return Math.max(0, frame.bottom - edge);
}

// Where the middle of the free area sits, from the screen centre, in CSS px (right and down positive).
export function freeCentreOffset(insets, w, h) {
  const ins = { top: 0, right: 0, bottom: 0, left: 0, ...(insets || {}) };
  const fw = Math.max(0, w - ins.left - ins.right);
  const fh = Math.max(0, h - ins.top - ins.bottom);
  return { dx: ins.left + fw / 2 - w / 2, dy: ins.top + fh / 2 - h / 2 };
}

// {x0, y0, x1, y1} in local metres, or null without a base or a station.
export function routeBounds(inputs, route = null, pad = FIT_PAD_M) {
  const pts = [];
  if (inputs && inputs.base && Number.isFinite(inputs.base.x) && Number.isFinite(inputs.base.y)) pts.push([inputs.base.x, inputs.base.y]);
  for (const s of (inputs && inputs.stations) || []) if (Number.isFinite(s.x) && Number.isFinite(s.y)) pts.push([s.x, s.y]);
  for (const leg of (route && route.ok !== false && route.legs) || []) for (const p of leg.path || []) pts.push(p);
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

// Insets in CSS px of the free scene area. frame and rects are {left, top, right, bottom} in the same space.
// Each block that covers part of the frame takes the side that loses the least area: a wide band at the top or the
// bottom (the caption, the title row), a tall column at the left or the right (the drawer, the map controls).
// Hidden or empty rectangles are skipped.
export function freeInsets(frame, rects) {
  const out = { top: 0, right: 0, bottom: 0, left: 0 };
  const fw = frame.right - frame.left;
  const fh = frame.bottom - frame.top;
  for (const r of rects) {
    if (!r) continue;
    const w = Math.min(r.right, frame.right) - Math.max(r.left, frame.left);
    const h = Math.min(r.bottom, frame.bottom) - Math.max(r.top, frame.top);
    if (!(w > 0 && h > 0)) continue;
    const upper = (r.top + r.bottom) / 2 < frame.top + fh / 2;
    const leftSide = (r.left + r.right) / 2 < frame.left + fw / 2;
    const band = upper ? r.bottom - frame.top : frame.bottom - r.top;
    const column = leftSide ? r.right - frame.left : frame.right - r.left;
    if (band * fw <= column * fh) {
      if (upper) out.top = Math.max(out.top, band);
      else out.bottom = Math.max(out.bottom, band);
    } else if (leftSide) out.left = Math.max(out.left, column);
    else out.right = Math.max(out.right, column);
  }
  // Never leave less than a quarter of the frame: a fit into nothing helps no one.
  if (fw - out.left - out.right < fw / 4) out.left = out.right = 0;
  if (fh - out.top - out.bottom < fh / 4) out.top = out.bottom = 0;
  return out;
}

const rectOf = (el) => {
  if (!el || typeof el.getBoundingClientRect !== "function") return null;
  if (el.offsetParent === null && el.getClientRects && el.getClientRects().length === 0) return null;
  return el.getBoundingClientRect();
};

// The elements that cover the scene in the plan view: every element marked data-fit-avoid (the title, the stepper,
// the two top-right controls, the caption plate, the map controls, the first-time hint, the credit line) and the
// Details drawer when it is open.
export function sceneFree(regions, doc = globalThis.document) {
  const frame = rectOf(regions && regions.labels);
  if (!frame || !(frame.right - frame.left > 0)) return { insets: { top: 0, right: 0, bottom: 0, left: 0 }, cover: null, w: 0, h: 0 };
  const marked = doc && typeof doc.querySelectorAll === "function" ? [...doc.querySelectorAll("[data-fit-avoid]")] : [];
  const drawer = regions.drawer && regions.drawer.isConnected !== false ? regions.drawer : null;
  const rects = [...marked, drawer].map(rectOf);
  return {
    insets: freeInsets(frame, rects),
    cover: { top: 0, right: 0, bottom: opaqueBottom(frame, rects), left: 0 },
    w: frame.right - frame.left,
    h: frame.bottom - frame.top,
  };
}

export const sceneInsets = (regions, doc = globalThis.document) => sceneFree(regions, doc).insets;

// Fits the plan camera to the walk. Returns false when there is nothing to fit or the renderer cannot do it.
export function fitRoute({ host, store, regions }, doc = globalThis.document, pad = FIT_PAD_M) {
  if (!host || typeof host.fitBounds !== "function") return false;
  const s = store.getState();
  if (s.view !== "plan") return false;
  const b = routeBounds(s.inputs, s.plan && s.plan.status === "ok" ? s.plan.route : null, pad);
  if (!b) return false;
  const area = sceneFree(regions, doc);
  host.fitBounds(b, area.insets, { pad: FIT_PAD_PX, cover: area.cover });
  return true;
}
