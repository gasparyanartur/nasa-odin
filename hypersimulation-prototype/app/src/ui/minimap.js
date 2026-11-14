// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The map inset of the walk and hazard steps: a small north-up 2D map in the bottom right corner with the surround
// image, the route (magenta), the way back (red, dashed) and the walker's position. No number is drawn. A close control
// on its corner hides it; a small "Map" button in the same corner brings it back. Out of the page in the plan view.
import { routeCoords } from "./route-overlays.js";
import { routeBounds } from "../fit.js";
import { onNextFrame } from "../frame.js";

const PAD_M = 40;
const COLOURS = { ink: "#14161a", paper: "#f4f1ea", magenta: "#b8156f", red: "#c3341a" };

// Pure: a square box in metres around the walk (base, stations, route), so the inset keeps one scale.
export function insetBox(inputs, route, pad = PAD_M) {
  const b = routeBounds(inputs, route, pad);
  if (!b) return null;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2;
  return { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half };
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

export function mount(ctx) {
  const labels = ctx.regions && ctx.regions.labels;
  const app = labels && labels.parentNode ? labels.parentNode.parentNode : null;
  const doc = (labels && labels.ownerDocument) || globalThis.document;
  if (!app || !doc) return () => {};
  const { store, host, data } = ctx;
  const scene = (data && data.scene) || ctx.scene;

  const canvas = el(doc, "canvas", "minimap__canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Small map, north up: the route in magenta and your position as a dot");
  const frame = el(doc, "div", "minimap__frame", canvas);
  // A small close control on the corner of the inset; while hidden, one "Map" button in the same corner.
  const SVG = "http://www.w3.org/2000/svg";
  const cross = doc.createElementNS ? doc.createElementNS(SVG, "svg") : doc.createElement("svg");
  cross.setAttribute("class", "icon");
  cross.setAttribute("viewBox", "0 0 24 24");
  cross.setAttribute("aria-hidden", "true");
  const crossPath = doc.createElementNS ? doc.createElementNS(SVG, "path") : doc.createElement("path");
  crossPath.setAttribute("d", "M6 6l12 12M18 6 6 18");
  cross.appendChild(crossPath);
  const close = el(doc, "button", "minimap__close", cross);
  close.setAttribute("type", "button");
  close.setAttribute("aria-label", "Hide map");
  const open = el(doc, "button", "btn minimap__open", "Map");
  open.setAttribute("type", "button");
  open.setAttribute("aria-label", "Show map");
  const root = el(doc, "div", "minimap", frame, close, open);
  root.setAttribute("data-nonmetric", "");
  let hidden = false;
  const paint = () => {
    frame.hidden = hidden;
    close.hidden = hidden;
    open.hidden = !hidden;
    if (hidden) root.setAttribute("data-hidden", "");
    else root.removeAttribute("data-hidden");
  };
  close.addEventListener("click", () => {
    hidden = true;
    paint();
    if (typeof open.focus === "function") open.focus({ preventScroll: true });
  });
  open.addEventListener("click", () => {
    hidden = false;
    paint();
    schedule();
    if (typeof close.focus === "function") close.focus({ preventScroll: true });
  });
  paint();

  function draw() {
    const s = store.getState();
    if (hidden || !root.parentNode) return;
    const g = canvas.getContext ? canvas.getContext("2d") : null;
    if (!g) return;
    const css = canvas.clientWidth || 180;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const px = Math.round(css * dpr);
    if (canvas.width !== px) canvas.width = px;
    if (canvas.height !== px) canvas.height = px;
    const route = s.plan.status === "ok" ? s.plan.route : null;
    const box = insetBox(s.inputs, route);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COLOURS.ink;
    g.fillRect(0, 0, px, px);
    if (!box) return;
    const k = px / (box.x1 - box.x0);
    const sx = (x) => (x - box.x0) * k;
    const sy = (y) => (box.y1 - y) * k;
    const img = host && typeof host.image === "function" ? host.image("surround") || host.image("overview") : null;
    if (img && scene && scene.surround) {
      const S = scene.surround.size_m;
      const iw = img.width || 1;
      const ih = img.height || 1;
      const u = (x) => ((x + S / 2) / S) * iw;
      const v = (y) => ((S / 2 - y) / S) * ih;
      try {
        g.drawImage(img, u(box.x0), v(box.y1), u(box.x1) - u(box.x0), v(box.y0) - v(box.y1), 0, 0, px, px);
      } catch {
        // an image that cannot be drawn leaves the plain ground
      }
    }
    const line = (coords, colour, width, dash = []) => {
      if (!coords || coords.length < 2) return;
      g.lineJoin = "round";
      g.lineCap = "round";
      g.beginPath();
      coords.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
      g.setLineDash([]);
      g.strokeStyle = COLOURS.ink;
      g.lineWidth = (width + 3) * dpr;
      g.stroke();
      g.setLineDash(dash.map((d) => d * dpr));
      g.strokeStyle = colour;
      g.lineWidth = width * dpr;
      g.stroke();
      g.setLineDash([]);
    };
    line(routeCoords(route), COLOURS.magenta, 2.5);
    if (s.walk.return_leg) line(s.walk.return_leg.path, COLOURS.red, 3, [6, 4]);
    const b = s.inputs && s.inputs.base;
    if (b) {
      g.fillStyle = COLOURS.ink;
      g.strokeStyle = COLOURS.paper;
      g.lineWidth = 2 * dpr;
      g.fillRect(sx(b.x) - 5 * dpr, sy(b.y) - 5 * dpr, 10 * dpr, 10 * dpr);
      g.strokeRect(sx(b.x) - 5 * dpr, sy(b.y) - 5 * dpr, 10 * dpr, 10 * dpr);
    }
    const pos = s.walk.snapshot && s.walk.snapshot.pos;
    if (pos) {
      g.beginPath();
      g.arc(sx(pos.x), sy(pos.y), 6 * dpr, 0, Math.PI * 2);
      g.fillStyle = COLOURS.paper;
      g.fill();
      g.lineWidth = 3 * dpr;
      g.strokeStyle = COLOURS.ink;
      g.stroke();
      g.beginPath();
      g.arc(sx(pos.x), sy(pos.y), 2.5 * dpr, 0, Math.PI * 2);
      g.fillStyle = COLOURS.magenta;
      g.fill();
    }
    g.strokeStyle = COLOURS.paper;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, px - 1, px - 1);
  }

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    onNextFrame(() => {
      pending = false;
      draw();
    });
  };

  let key = null;
  const sync = (s) => {
    const walk = s.view === "walk";
    if (walk && !root.parentNode) {
      app.appendChild(root);
      key = null;
    } else if (!walk && root.parentNode) root.remove();
    if (!walk) return;
    const p = s.walk.snapshot && s.walk.snapshot.pos;
    const k = `${p ? Math.round(p.x) : ""}|${p ? Math.round(p.y) : ""}|${s.plan.route ? 1 : 0}|${s.walk.return_leg ? 1 : 0}`;
    if (k === key) return;
    key = k;
    schedule();
  };
  sync(store.getState());
  const off = store.subscribe(sync);
  return () => {
    off();
    root.remove();
  };
}
