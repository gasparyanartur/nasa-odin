// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Chart linework on the scene through host.setOverlay (route, return path, walked part, base, stations, no-go
// zones) and the DOM labels in #labels (base, stations, legs). No number is drawn into the canvas: every label is a
// DOM element placed with host.project() and hidden when it would collide (greedy, in priority order).
// The story step decides what shows (story.js overlayFlags). A station shows by shape: a filled square is a ridge, an
// open square a hollow; its tag carries the id and the same shape. A tag opens the station's small card (story.js).
import { num, fmtBearing, formatValue } from "../provenance.js";
import { onNextFrame } from "../frame.js";
import { overlayFlags } from "../story.js";

// ---- pure helpers (tested in tests/route-overlays.test.js)

export function routeCoords(route) {
  const out = [];
  for (const leg of (route && route.legs) || []) {
    for (const p of leg.path) {
      const last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push([p[0], p[1]]);
    }
  }
  return out;
}

// The point at a share of the path length (0..1).
export function pointAlong(path, frac) {
  if (!path || !path.length) return null;
  const cum = [0];
  for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  const total = cum[cum.length - 1];
  if (total === 0) return { x: path[0][0], y: path[0][1] };
  const d = Math.min(Math.max(frac, 0), 1) * total;
  let k = 1;
  while (k < path.length - 1 && cum[k] < d) k++;
  const seg = cum[k] - cum[k - 1];
  const f = seg === 0 ? 0 : (d - cum[k - 1]) / seg;
  return { x: path[k - 1][0] + (path[k][0] - path[k - 1][0]) * f, y: path[k - 1][1] + (path[k][1] - path[k - 1][1]) * f };
}

// Vertices of a path up to the point pos on it (the nearest segment decides where pos lies).
export function pathUpTo(path, pos) {
  if (!path || !path.length || !pos) return [];
  let best = 0;
  let bd = Infinity;
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = path[k - 1];
    const [bx, by] = path[k];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((pos.x - ax) * dx + (pos.y - ay) * dy) / len2));
    const d = Math.hypot(ax + dx * t - pos.x, ay + dy * t - pos.y);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return [...path.slice(0, best), [pos.x, pos.y]];
}

// The walked part of the route at the current snapshot, including the return leg after a hazard.
export function walkedCoords(route, walk) {
  const snap = walk && walk.snapshot;
  if (!route || !route.legs || !snap || !(walk.t_s > 0)) return [];
  const upTo = (legIndex, pos, includeWhole) => {
    const out = [];
    for (let i = 0; i < legIndex; i++) out.push(...route.legs[i].path);
    const leg = route.legs[legIndex];
    if (leg) out.push(...(includeWhole ? leg.path : pathUpTo(leg.path, pos)));
    return out;
  };
  let coords;
  if (snap.mode === "return" || (snap.mode === "done" && walk.return_leg)) {
    const from = walk.return_from;
    const before = from && Number.isInteger(from.leg_index) ? upTo(from.leg_index, from.pos, from.mode === "work") : [];
    const back = snap.mode === "done" ? walk.return_leg.path : pathUpTo(walk.return_leg ? walk.return_leg.path : [], snap.pos);
    coords = [...before, ...back];
  } else if (snap.mode === "done") coords = routeCoords(route);
  else if (Number.isInteger(snap.leg_index)) coords = upTo(snap.leg_index, snap.pos, snap.mode === "work");
  else coords = [];
  return coords.filter((p, i) => i === 0 || p[0] !== coords[i - 1][0] || p[1] !== coords[i - 1][1]);
}

// The offsets a station or base tag tries, in order: right, left, above, below, then the four diagonals. Each gives
// the top-left corner of the tag from its anchor (w, h: tag size; G: the gap that keeps the mark symbol clear).
const G = 12;
const FAR = 2.5; // the wider ring: the gap times this
// Rings tried after the near places, in order: [gap factor, may cover another station's mark symbol]. A tag next to its
// own point over a neighbour's symbol reads better than a tag far away; the widest ring is the last try.
const LATE_RINGS = [[FAR, false], [1, true], [FAR, true], [2 * FAR, true]];
export const TAG_PLACES = [
  ["right", (w, h) => [G, -h / 2]],
  ["left", (w, h) => [-G - w, -h / 2]],
  ["above", (w, h) => [-w / 2, -G - h]],
  ["below", (w) => [-w / 2, G]],
  ["above-right", (w, h) => [G - 4, -G + 4 - h]],
  ["below-right", () => [G - 4, G - 4]],
  ["above-left", (w, h) => [-G + 4 - w, -G + 4 - h]],
  ["below-left", (w) => [-G + 4 - w, G - 4]],
];

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// items: [{id, kind: "tag" | "leg" | "zone", x, y, w, h, wc?}] in priority order (screen px); wc is the width of the
// compact form of a tag (id only, "S4"). Returns Map id -> {place, cls, rect, dx, dy, compact} or null when the label
// is hidden. A station or base tag is never hidden: it tries the eight offsets in full, then in the compact form, and
// when every place collides it still shows the compact form on the right (forced: true). Leg labels hide when they
// collide; zone labels try the centre, below and above. Tags also keep clear of every mark symbol. reserved: screen
// rectangles {x, y, w, h} no label may cover (the image credit line, the map tools).
export function placeLabels(items, bounds = null, reserved = []) {
  const marks = items.filter((i) => i.kind === "tag").map((i) => ({ x: i.x - 9, y: i.y - 9, w: 18, h: 18, id: i.id, mark: true }));
  const taken = [...reserved, ...marks];
  const inside = (r) => !bounds || (r.x >= 0 && r.y >= 0 && r.x + r.w <= bounds.w && r.y + r.h <= bounds.h);
  const out = new Map();
  for (const it of items) {
    const free = (r, marksOk = false) => inside(r) && !taken.some((t) => t.id !== it.id && !(marksOk && t.mark) && overlaps(r, t));
    let chosen = null;
    if (it.kind === "tag") {
      const forms = [[false, it.w, 1, false]];
      const hasCompact = Number.isFinite(it.wc) && it.wc > 0 && it.wc < it.w;
      if (hasCompact) forms.push([true, it.wc, 1, false]);
      // Last rings before forcing: the same eight places at wider gaps from the mark (a dense cluster on a phone).
      for (const [k, marksOk] of LATE_RINGS) forms.push([hasCompact, hasCompact ? it.wc : it.w, k, marksOk]);
      for (const [compact, w, k, marksOk] of forms) {
        for (const [place, off] of TAG_PLACES) {
          const [ox, oy] = off(w, it.h);
          const dx = ox + (ox >= 0 ? 1 : ox + w <= 0 ? -1 : 0) * (k - 1) * G;
          const dy = oy + (oy >= 0 ? 1 : oy + it.h <= 0 ? -1 : 0) * (k - 1) * G;
          const r = { x: it.x + dx, y: it.y + dy, w, h: it.h };
          if (free(r, marksOk)) {
            chosen = { place, cls: "", rect: r, dx, dy, compact };
            break;
          }
        }
        if (chosen) break;
      }
      if (!chosen) {
        const w = hasCompact ? it.wc : it.w;
        const [dx, dy] = TAG_PLACES[0][1](w, it.h);
        chosen = { place: "right", cls: "", rect: { x: it.x + dx, y: it.y + dy, w, h: it.h }, dx, dy, compact: hasCompact, forced: true };
      }
    } else {
      const centre = ["centre", { x: it.x - it.w / 2, y: it.y - it.h / 2, w: it.w, h: it.h }, ""];
      const tries = it.kind === "leg"
        ? [centre]
        : [centre, ["below", { x: it.x - it.w / 2, y: it.y + 14, w: it.w, h: it.h }, "zone-tag--below"], ["above", { x: it.x - it.w / 2, y: it.y - 14 - it.h, w: it.w, h: it.h }, "zone-tag--above"]];
      for (const [place, r, cls] of tries) {
        if (free(r)) {
          chosen = { place, cls, rect: r };
          break;
        }
      }
    }
    out.set(it.id, chosen);
    if (chosen) taken.push(chosen.rect);
  }
  return out;
}

// ---- styles of the linework (tokens.css values, read live when a document is there)

function palette(doc) {
  const read = (name, fallback) => {
    try {
      const v = globalThis.getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch {
      return fallback;
    }
  };
  return {
    ink: read("--ink", "#14161a"),
    paper: read("--paper", "#f4f1ea"),
    magenta: read("--magenta", "#b8156f"),
    red: read("--red", "#c3341a"),
  };
}

// z: drawing order among the lines (route 0 < walked part 1 < return path 2), so the return always sits on top.
function lineStyle(pal, color, { width = 3, dash = null, z = 0 } = {}) {
  return { color, casing: pal.ink, width_px: width, casing_px: 2, width, dash, z };
}

// The centre of a polygon's area (vertex mean when the area is zero).
export function polygonCentre(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return { x: poly.reduce((t, p) => t + p[0], 0) / n, y: poly.reduce((t, p) => t + p[1], 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

// In the walk view only the base and the station the walker heads for keep a label.
export function walkLabelIds(snapshot) {
  const ids = new Set(["base"]);
  if (snapshot && snapshot.next_station !== null && snapshot.next_station !== undefined) ids.add(`s${snapshot.next_station}`);
  return ids;
}

// Screen rectangles (relative to the labels layer) of the elements marked data-label-avoid (the credit line, the map
// controls, the story chrome, the drawer).
export function reservedRects(frame, labels) {
  if (!frame || typeof frame.querySelectorAll !== "function" || typeof labels.getBoundingClientRect !== "function") return [];
  const o = labels.getBoundingClientRect();
  const out = [];
  for (const el of frame.querySelectorAll("[data-label-avoid]")) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    out.push({ x: r.left - o.left - 4, y: r.top - o.top - 4, w: r.width + 8, h: r.height + 8 });
  }
  return out;
}

// The helmet's bearing and distance block (.hud__nav), as a rectangle in the labels layer, padded by 12 px.
export function navRect(doc, labels) {
  const nav = doc && typeof doc.querySelector === "function" ? doc.querySelector(".hud__nav") : null;
  if (!nav || typeof nav.getBoundingClientRect !== "function" || typeof labels.getBoundingClientRect !== "function") return null;
  const r = nav.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return null;
  const o = labels.getBoundingClientRect();
  return { x: r.left - o.left - 12, y: r.top - o.top - 12, w: r.width + 24, h: r.height + 24 };
}

// ---- mount

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

export function mount(ctx) {
  const root = ctx.regions.labels;
  const doc = root.ownerDocument || globalThis.document;
  // Own group inside #labels: other modules (drill sites) place their labels there too.
  const labels = el(doc, "div", "label-group");
  root.appendChild(labels);
  const { store, host } = ctx;
  const pal = palette(doc);
  const ids = new Set();
  const put = (id, spec) => {
    if (spec) ids.add(id);
    else ids.delete(id);
    host.setOverlay(id, spec);
  };

  // ---- linework
  // Stations whose point would sit under the helmet's bearing and distance text are left out of the point overlay in
  // the walk view, so no square ever draws on that text (the label layer does the same for their tags).
  let navHidden = new Set();
  let seen = {};
  let trailKey = null;
  const drawLines = (s) => {
    const inputs = s.inputs;
    const flags = overlayFlags(s);
    const route = s.plan.status === "ok" && flags.route ? s.plan.route : null;
    const layers = s.layers || [];
    const showStations = layers.includes("stations") && flags.marks;
    const showNoGo = layers.includes("no_go");
    const showBase = flags.marks;
    if (route !== seen.route) put("route", route ? { kind: "line", coords: routeCoords(route), style: lineStyle(pal, pal.magenta, { width: 3 }) } : null);
    if (inputs !== seen.inputs || showStations !== seen.showStations || showNoGo !== seen.showNoGo || showBase !== seen.showBase) {
      put("base", inputs && inputs.base && showBase ? { kind: "points", coords: [[inputs.base.x, inputs.base.y]], style: { shape: "square", color: pal.ink, casing: pal.paper, outline: pal.paper, size_px: 20, casing_px: 3, size: 9 } } : null);
      // Ridge: a filled ink square. Hollow: an open square (paper inside, ink edge).
      const pts = (kind) => (inputs && showStations ? inputs.stations.filter((st) => st.kind === kind && !navHidden.has(st.id)).map((st) => [st.x, st.y]) : []);
      const ridge = pts("ridge");
      const hollow = pts("hollow");
      put("stations-ridge", ridge.length ? { kind: "points", coords: ridge, style: { shape: "square", color: pal.ink, casing: pal.paper, outline: pal.paper, size_px: 14, casing_px: 2, size: 6, layer: "stations" } } : null);
      put("stations-hollow", hollow.length ? { kind: "points", coords: hollow, style: { shape: "square", color: pal.paper, casing: pal.ink, outline: pal.ink, size_px: 14, casing_px: 2, size: 6, layer: "stations" } } : null);
      for (const id of [...ids]) if (id.startsWith("nogo:")) put(id, null);
      if (inputs && showNoGo) {
        for (const z of inputs.no_go) {
          put(`nogo:${z.id}`, {
            kind: "polygon",
            coords: z.polygon,
            style: { pattern: "hatch-nogo", color: pal.paper, hatch_color: pal.ink, hatch_casing: pal.paper, casing: pal.ink, width_px: 1.5, casing_px: 2, width: 1.5, dash: [6, 4] },
          });
        }
      }
    }
    const w = s.walk;
    // The way back and the walked trail belong to the walk view; a plan view never shows a leftover walk.
    const inWalk = s.view === "walk";
    const returnLeg = inWalk ? w.return_leg : null;
    if (returnLeg !== seen.returnLeg) put("route-return", returnLeg ? { kind: "line", coords: returnLeg.path, style: lineStyle(pal, pal.red, { width: 4, dash: [10, 6], z: 2 }) } : null);
    const snap = w.snapshot;
    const key = inWalk && route && snap && w.t_s > 0 ? `${snap.mode}|${snap.leg_index}|${Math.round(snap.pos.x / 3)}|${Math.round(snap.pos.y / 3)}|${w.return_leg ? 1 : 0}` : null;
    if (key !== trailKey || route !== seen.route) {
      trailKey = key;
      const coords = key ? walkedCoords(route, w) : [];
      put("route-walked", coords.length > 1 ? { kind: "line", coords, style: lineStyle(pal, pal.paper, { width: 2, z: 1 }) } : null);
    }
    seen = { route, inputs, showStations, showNoGo, showBase, returnLeg };
  };

  // ---- labels
  let marks = [];
  const openStation = (id) => {
    const st = store.getState();
    if (st.view !== "plan") return;
    if (ctx.actions && typeof ctx.actions.pickStation === "function") ctx.actions.pickStation(st.picked === id ? null : id);
    else store.setState({ picked: st.picked === id ? null : id });
  };
  const buildLabels = (s) => {
    const inputs = s.inputs;
    const flags = overlayFlags(s);
    const route = s.plan.status === "ok" && flags.legs ? s.plan.route : null;
    const out = [];
    if (inputs && inputs.base && flags.marks) {
      const note = inputs.base.assumption ? el(doc, "span", "map-tag__note", "assumption") : null;
      const tag = el(doc, "span", "map-tag", el(doc, "span", "map-tag__id", "BASE"), el(doc, "span", "map-tag__kind", "crew rover", note));
      tag.setAttribute("data-nonmetric", "");
      out.push({ id: "base", kind: "tag", x: inputs.base.x, y: inputs.base.y, node: el(doc, "div", "mark mark--base", tag), tag });
    }
    if (inputs && flags.marks && (s.layers || []).includes("stations")) {
      for (const st of inputs.stations) {
        const shape = el(doc, "span", `map-tag__shape map-tag__shape--${st.kind === "hollow" ? "hollow" : "ridge"}`);
        shape.setAttribute("aria-hidden", "true");
        const tag = el(doc, "button", "map-tag map-tag--station", shape, el(doc, "span", "map-tag__id", `S${st.id}`));
        tag.setAttribute("type", "button");
        tag.setAttribute("data-nonmetric", "");
        tag.setAttribute("data-station", String(st.id));
        tag.setAttribute("aria-label", `Station ${st.id}, ${st.kind}. Open its card.`);
        tag.setAttribute("aria-haspopup", "dialog");
        tag.addEventListener("click", () => openStation(st.id));
        out.push({ id: `s${st.id}`, station: st.id, kind: "tag", x: st.x, y: st.y, node: el(doc, "div", "mark", tag), tag });
      }
    }
    if (inputs && flags.marks && (s.layers || []).includes("no_go")) {
      for (const z of inputs.no_go || []) {
        if (!Array.isArray(z.polygon) || z.polygon.length < 3) continue;
        const c = polygonCentre(z.polygon);
        const tag = el(doc, "span", "zone-tag", el(doc, "span", "zone-tag__id", "No-go"), el(doc, "span", "zone-tag__label", z.label || "No-go zone"));
        tag.setAttribute("data-nonmetric", "");
        out.push({ id: `zone:${z.id}`, kind: "zone", x: c.x, y: c.y, node: el(doc, "div", "mark mark--zone", tag), tag });
      }
    }
    if (route) {
      route.legs.forEach((leg, i) => {
        const mid = pointAlong(leg.path, 0.5);
        if (!mid || !(leg.distance_m > 0)) return;
        const n = num([{ value: fmtBearing(leg.bearing_deg), unit: "°" }, { value: formatValue(leg.distance_m, { digits: 0 }), unit: "m" }], null, "derived",
          { method: "bearing from true north and length of the leg, from the planned path on the 1 m terrain", sources: ["dem_1m"], compact: true }, doc);
        const tag = el(doc, "span", "leg-tag", n);
        out.push({ id: `leg${i}`, kind: "leg", x: mid.x, y: mid.y, node: el(doc, "span", "mark", tag), tag });
      });
    }
    // Keep the keyboard focus on the same station label when the labels are rebuilt (a replan, a layer switch).
    const active = doc.activeElement;
    const focused = active && labels.contains(active) && active.getAttribute ? active.getAttribute("data-station") : null;
    labels.replaceChildren(...out.map((m) => m.node));
    if (focused !== null) {
      const again = out.find((m) => m.station !== undefined && String(m.station) === focused);
      if (again && typeof again.tag.focus === "function") again.tag.focus({ preventScroll: true });
    }
    for (const m of out) {
      m.w = m.tag.offsetWidth || 60;
      m.h = m.tag.offsetHeight || 22;
      // The compact form drops the kind cell ("crew rover" of the base tag); a station tag (shape mark and id) has no
      // shorter form, so it never claims a narrower box than it draws.
      const kindCell = m.kind === "tag" && m.tag.querySelector ? m.tag.querySelector(".map-tag__kind") : null;
      m.wc = kindCell && kindCell.offsetWidth ? Math.max(1, m.w - kindCell.offsetWidth) : null;
    }
    marks = out;
  };

  const position = () => {
    const s = store.getState();
    const walking = s.view === "walk";
    if (walking) labels.setAttribute("data-walk", "");
    else labels.removeAttribute("data-walk");
    const keep = walking ? walkLabelIds(s.walk.snapshot) : null;
    const bounds = { w: labels.clientWidth, h: labels.clientHeight };
    const items = [];
    for (const m of marks) {
      const wanted = !walking || keep.has(m.id);
      const p = wanted ? host.project(m.x, m.y) : { sx: 0, sy: 0, visible: false };
      m.sx = p.sx;
      m.sy = p.sy;
      m.visible = !!p.visible;
      m.node.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy)}px)`;
      if (m.visible) items.push({ id: m.id, kind: m.kind, x: p.sx, y: p.sy, w: m.w, h: m.h, wc: walking ? null : m.wc });
    }
    const placed = placeLabels(items, bounds, walking ? [] : reservedRects(doc, labels));
    // Walk view: no station point or tag under the helmet's navigation text.
    const nav = walking ? navRect(doc, labels) : null;
    const under = new Set();
    if (nav && s.inputs) {
      for (const st of s.inputs.stations || []) {
        const p = host.project(st.x, st.y);
        if (p && p.visible && p.sx >= nav.x && p.sx <= nav.x + nav.w && p.sy >= nav.y && p.sy <= nav.y + nav.h) under.add(st.id);
      }
    }
    if ([...under].join() !== [...navHidden].join()) {
      navHidden = under;
      seen = { ...seen, inputs: null };
      drawLines(s);
    }
    for (const m of marks) {
      const pl = m.visible ? placed.get(m.id) : null;
      const underNav = m.station !== undefined && navHidden.has(m.station);
      if (!m.visible || underNav || (m.kind !== "tag" && !pl)) m.node.setAttribute("data-hidden", "");
      else m.node.removeAttribute("data-hidden");
      if (m.kind === "zone") {
        m.tag.classList.remove("zone-tag--below", "zone-tag--above");
        if (pl && pl.cls) m.tag.classList.add(pl.cls);
      }
      if (m.kind === "tag") {
        m.tag.classList.toggle("map-tag--return", walking && m.id === "base" && !!s.walk.return_leg);
        // A station or base tag always shows (placeLabels never drops one): full, or compact as its id alone.
        m.node.classList.remove("mark--tagless");
        m.tag.classList.remove("map-tag--left", "map-tag--below", "map-tag--above");
        m.tag.classList.toggle("map-tag--compact", !walking && !!(pl && pl.compact));
        if (pl && !walking) {
          m.tag.style.left = `${Math.round(pl.dx)}px`;
          m.tag.style.top = `${Math.round(pl.dy)}px`;
        } else {
          // The helmet view keeps the label right of its point (the base pin has its own place in app.css).
          m.tag.style.left = "";
          m.tag.style.top = "";
        }
        if (m.station !== undefined) {
          m.tag.classList.toggle("map-tag--selected", s.picked === m.station);
          m.tag.setAttribute("aria-expanded", s.picked === m.station ? "true" : "false");
        }
      }
    }
  };

  let frame = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = true;
    onNextFrame(() => {
      frame = null;
      position();
    });
  };

  let seenLabels = {};
  let seenCard = null;
  let seenNext = null;
  let seenReturn = false;
  const render = (s) => {
    drawLines(s);
    const f = overlayFlags(s);
    const lk = { inputs: s.inputs, route: s.plan.route, status: s.plan.status, layers: s.layers, flags: `${f.route}${f.marks}${f.legs}` };
    if (Object.keys(lk).some((k) => lk[k] !== seenLabels[k])) {
      seenLabels = lk;
      buildLabels(s);
      schedule();
    } else if (s.picked !== seenCard || s.view !== seenLabels.view || s.drawer !== seenLabels.drawer) schedule();
    else if (s.view === "walk") {
      const next = s.walk.snapshot ? s.walk.snapshot.next_station : null;
      if (next !== seenNext || !!s.walk.return_leg !== seenReturn) schedule();
    }
    seenCard = s.picked;
    seenLabels.drawer = s.drawer;
    seenNext = s.walk.snapshot ? s.walk.snapshot.next_station : null;
    seenReturn = !!s.walk.return_leg;
    seenLabels.view = s.view;
  };
  render(store.getState());
  const offStore = store.subscribe(render);
  const offHost = host.onChange(schedule);
  const onResize = () => schedule();
  globalThis.addEventListener?.("resize", onResize);
  return () => {
    offStore();
    if (typeof offHost === "function") offHost();
    globalThis.removeEventListener?.("resize", onResize);
    for (const id of [...ids]) host.setOverlay(id, null);
    labels.remove();
  };
}
