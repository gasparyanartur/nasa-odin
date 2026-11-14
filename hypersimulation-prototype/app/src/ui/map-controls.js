// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The map controls: one compact cluster at the bottom right of the scene (plan view), 48 px buttons: zoom in, zoom
// out, tilt, turn left, turn right, north up (the arrow turns with the view), fit route. Zoom and turn repeat while
// held. A one-line hint shows once per browser, until the first input or for HINT_MS. Every map key has a button here,
// for touch. Under 600 px only zoom in, zoom out and fit route show; "More" opens the other four. The cluster is out
// of the page in the walk view. Labels and the route fit keep clear of it.
import { fitRoute, STORY_PAD_M } from "../fit.js";

const SVG = "http://www.w3.org/2000/svg";
const TILT_UP_DEG = 55;
const TURN_STEP_DEG = 15;
const ZOOM_STEP = 1.25;
const REPEAT_DELAY_MS = 380;
const REPEAT_EVERY_MS = 110;
export const HINT = "Drag to move. Scroll or pinch to zoom.";
export const HINT_MS = 8000;
const HINT_KEY = "marswalk.hint.seen";

// Storage can be missing or refuse (private mode, a sandboxed frame): the page works without it.
export function hintSeen(storage) {
  try {
    return !!storage && storage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}
export function markHintSeen(storage) {
  try {
    if (storage) storage.setItem(HINT_KEY, "1");
  } catch {
    // nothing kept: the hint may show once more next time
  }
}

const ICONS = {
  north: [["icon__fill", "M12 2 18 21 12 17 6 21z"]],
  plus: [["", "M12 5v14M5 12h14"]],
  minus: [["", "M5 12h14"]],
  tilt: [["", "M3 18h18M6 18l4-12h4l4 12"]],
  left: [["", "M9 7H4V2"], ["", "M4 7a9 9 0 1 1-1 7"]],
  right: [["", "M15 7h5V2"], ["", "M20 7a9 9 0 1 0 1 7"]],
  fit: [["", "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"], ["", "M8 15l3-6 2 4 3-3"]],
  more: [["icon__fill", "M5 10.5h3v3H5zM10.5 10.5h3v3h-3zM16 10.5h3v3h-3z"]],
};

function icon(doc, name) {
  const s = doc.createElementNS ? doc.createElementNS(SVG, "svg") : doc.createElement("svg");
  s.setAttribute("class", "icon");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  for (const [cls, d] of ICONS[name]) {
    const p = doc.createElementNS ? doc.createElementNS(SVG, "path") : doc.createElement("path");
    if (cls) p.setAttribute("class", cls);
    p.setAttribute("d", d);
    s.appendChild(p);
  }
  return s;
}

// The arrow turns against the view heading so it always points to north on screen.
export function northRotation(camera) {
  const h = camera && Number.isFinite(camera.heading_deg) ? camera.heading_deg : 0;
  return -h;
}

// A press that repeats while it is held (pointer), once per click otherwise (keyboard; a held key repeats by itself).
export function holdToRepeat(button, fn, { delay = REPEAT_DELAY_MS, every = REPEAT_EVERY_MS, timers = globalThis } = {}) {
  let wait = null;
  let tick = null;
  let pressed = false;
  const stop = () => {
    if (wait !== null) timers.clearTimeout(wait);
    if (tick !== null) timers.clearInterval(tick);
    wait = null;
    tick = null;
  };
  button.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pressed = true;
    fn();
    stop();
    wait = timers.setTimeout(() => {
      tick = timers.setInterval(fn, every);
    }, delay);
  });
  for (const t of ["pointerup", "pointerleave", "pointercancel", "blur"]) button.addEventListener(t, stop);
  button.addEventListener("click", (e) => {
    // A pointer press already acted; a keyboard click (detail 0) acts here.
    if (pressed && e.detail !== 0) {
      pressed = false;
      return;
    }
    pressed = false;
    fn();
  });
  return stop;
}

function button(doc, cls, label, kids, key) {
  const b = doc.createElement("button");
  b.setAttribute("type", "button");
  b.setAttribute("class", `btn map-tools__btn ${cls}`.trim());
  b.setAttribute("aria-label", label);
  b.setAttribute("title", label);
  if (key) b.setAttribute("aria-keyshortcuts", key);
  for (const k of kids) b.append(k);
  return b;
}

export function mount(ctx) {
  const labels = ctx.regions && ctx.regions.labels;
  const frame = labels && labels.parentNode;
  if (!frame) return () => {};
  const doc = frame.ownerDocument || globalThis.document;
  const { host, store } = ctx;
  if (!host) return () => {};
  const stops = [];
  const act = (b, fn, repeat = false) => {
    if (repeat) stops.push(holdToRepeat(b, fn));
    else b.addEventListener("click", fn);
    return b;
  };

  const arrow = icon(doc, "north");
  const zoomIn = act(button(doc, "", "Zoom in", [icon(doc, "plus")], "+"), () => host.zoomBy(ZOOM_STEP), true);
  const zoomOut = act(button(doc, "", "Zoom out", [icon(doc, "minus")], "-"), () => host.zoomBy(1 / ZOOM_STEP), true);
  const tilt = act(button(doc, "map-tools__tilt", "Tilt the view", [icon(doc, "tilt")], "T"), () => {
    const cam = host.getCamera();
    const now = cam && Number.isFinite(cam.tilt_deg) ? cam.tilt_deg : 0;
    host.tiltBy(now > 5 ? -now : TILT_UP_DEG);
  });
  // Turning left lowers the view heading. The 3D view's rotateBy raises the heading, the 2D view's turns the map.
  const turnBy = (deg) => host.rotateBy(host.kind === "2d" ? -deg : deg);
  const left = act(button(doc, "", "Turn left", [icon(doc, "left")]), () => turnBy(-TURN_STEP_DEG), true);
  const right = act(button(doc, "", "Turn right", [icon(doc, "right")]), () => turnBy(TURN_STEP_DEG), true);
  const north = act(button(doc, "map-tools__north", "North up", [arrow], "0"), () => host.resetNorth());
  const fitAction = () => (ctx.actions && typeof ctx.actions.fitRoute === "function" ? ctx.actions.fitRoute() : fitRoute(ctx, doc, STORY_PAD_M));
  const fit = act(button(doc, "map-tools__fit", "Fit the route in view", [icon(doc, "fit")]), fitAction);
  // Narrow screens: tilt, the two turns and north up wait behind this button (touch gestures turn the map too).
  const more = button(doc, "map-tools__more", "More map controls", [icon(doc, "more")]);
  more.setAttribute("aria-expanded", "false");
  for (const b of [tilt, left, right, north]) b.classList.add("map-tools__extra");

  const group = doc.createElement("div");
  group.setAttribute("class", "map-tools");
  group.setAttribute("role", "toolbar");
  group.setAttribute("aria-label", "Map view");
  group.append(zoomIn, zoomOut, tilt, left, right, north, fit, more);
  more.addEventListener("click", () => {
    const open = more.getAttribute("aria-expanded") !== "true";
    more.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) group.setAttribute("data-more", "");
    else group.removeAttribute("data-more");
  });
  const root = doc.createElement("div");
  root.setAttribute("class", "map-cluster");
  root.setAttribute("data-label-avoid", "");
  root.setAttribute("data-nonmetric", "");
  group.setAttribute("data-fit-avoid", "");
  root.append(group);

  // The first-time hint: once per browser, gone on the first input on the scene or after HINT_MS. The route fit and
  // the labels keep clear of it.
  let storage = null;
  try {
    storage = ctx.storage !== undefined ? ctx.storage : globalThis.localStorage;
  } catch {
    storage = null;
  }
  let hint = null;
  let hintTimer = null;
  const timers = ctx.timers || globalThis;
  const dropHint = () => {
    if (hintTimer !== null) timers.clearTimeout(hintTimer);
    hintTimer = null;
    if (hint) hint.remove();
    hint = null;
  };
  let hintDone = hintSeen(storage);
  const showHint = () => {
    if (hintDone) return;
    hintDone = true;
    markHintSeen(storage);
    hint = doc.createElement("p");
    hint.setAttribute("class", "map-tools__hint");
    hint.setAttribute("data-fit-avoid", "");
    hint.setAttribute("data-label-avoid", "");
    hint.textContent = HINT;
    root.insertBefore(hint, group);
    hintTimer = timers.setTimeout(dropHint, HINT_MS);
  };
  const inputTypes = ["pointerdown", "wheel", "touchstart", "keydown"];
  for (const t of inputTypes) frame.addEventListener(t, dropHint, { passive: true });
  if (typeof doc.addEventListener === "function") doc.addEventListener("keydown", dropHint);
  group.addEventListener("click", dropHint);

  let last = null;
  const turn = () => {
    const cam = typeof host.getCamera === "function" ? host.getCamera() : null;
    const r = Math.round(northRotation(cam) * 10) / 10;
    if (r === last) return;
    last = r;
    arrow.style.transform = r ? `rotate(${r}deg)` : "";
    tilt.setAttribute("aria-pressed", cam && cam.tilt_deg > 5 ? "true" : "false");
  };
  turn();
  const off = typeof host.onChange === "function" ? host.onChange(turn) : null;
  // In the walk view the cluster leaves the page; a 2D view has no tilt, so that button leaves too.
  const sync = (s) => {
    const plan = s.view === "plan";
    if (plan && !root.parentNode) frame.appendChild(root);
    else if (!plan && root.parentNode) root.remove();
    // Never in the walk and hazard steps, also while they wait for the route with the plan view still on.
    if (plan && (s.explore || (s.step !== 3 && s.step !== 4))) showHint();
    else dropHint();
    if (s.renderer === "2d" && tilt.parentNode) tilt.remove();
    else if (s.renderer !== "2d" && !tilt.parentNode) group.insertBefore(tilt, left);
  };
  sync(store.getState());
  const offStore = store.subscribe(sync);
  return () => {
    if (typeof off === "function") off();
    offStore();
    for (const s of stops) s();
    dropHint();
    for (const t of inputTypes) frame.removeEventListener?.(t, dropHint);
    if (typeof doc.removeEventListener === "function") doc.removeEventListener("keydown", dropHint);
    root.remove();
  };
}
