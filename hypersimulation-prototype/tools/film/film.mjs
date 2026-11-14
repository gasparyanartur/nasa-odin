// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Films a narrated tour of the Marswalk app from storyboard.json: its own headless Chrome drives the real app with
// real mouse and key input (CDP), a drawn overlay shows the cursor, a highlight frame and a speech bubble, the
// screencast frames become a 30 fps 1920 x 1080 H.264 film with a caption band and the narration audio.
// usage: node film.mjs [--url http://localhost:8644/] [--only 05-plan,06-marks] [--no-build] [--silent] [--scratch <dir>]
// --silent leaves the audio files out (estimated durations, a silent film).
// Node 22+, no npm: built-in fetch and WebSocket only.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = dirname(dirname(HERE));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const FFPROBE = "/opt/homebrew/bin/ffprobe";
const PORT = 9344;
const VW = 1920;
const VH = 970;
const BAND_H = 110;
const FPS = 30;
const PAPER = "#f4f1ea";
const INK = "#14161a";
const MAGENTA = "#b8156f";
const FONT_TTF = join(PROJECT, "app", "public", "fonts", "B612-Regular.ttf");
// Speech rate for a segment without its audio file.
const WORDS_PER_S = 2.5;
const TAIL_S = 0.6;
const CHUNK_MAX = 90;

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const a = { url: "http://localhost:8644/", only: null, build: true, silent: false, scratch: join(tmpdir(), "marswalk-film") };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--url") a.url = argv[++i];
    else if (k === "--only") a.only = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "--no-build") a.build = false;
    else if (k === "--silent") a.silent = true;
    else if (k === "--scratch") a.scratch = argv[++i];
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const now = () => Date.now() / 1000;
const log = (...m) => console.log(`[film ${new Date().toISOString().slice(11, 19)}]`, ...m);

// ---------------------------------------------------------------- CDP
class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.addEventListener("message", (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else if (msg.method && this.handlers.has(msg.method)) for (const fn of this.handlers.get(msg.method)) fn(msg.params);
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const i = ++this.id;
      this.pending.set(i, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id: i, method, params }));
    });
  }
  async ev(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  }
  close() {
    try {
      this.ws.close();
    } catch {
      // already closed
    }
  }
}

// ---------------------------------------------------------------- Chrome (only this process, by its PID)
async function startChrome(scratch) {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/version`);
    throw new Error(`port ${PORT} already answers: another browser is on it, not driving that one`);
  } catch (e) {
    if (String(e.message).startsWith("port")) throw e;
  }
  const profile = join(scratch, `chrome-profile-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const args = [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
    "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    `--window-size=${VW},${VH}`, "about:blank",
  ];
  const proc = spawn(CHROME, args, { stdio: "ignore" });
  log(`chrome started, pid ${proc.pid}`);
  for (let i = 0; i < 150; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return proc;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("chrome did not answer on its debugging port");
}

async function stopChrome(proc) {
  if (!proc || proc.exitCode !== null) return;
  const gone = new Promise((r) => proc.once("exit", r));
  try {
    process.kill(proc.pid, "SIGTERM");
  } catch {
    return;
  }
  await Promise.race([gone, sleep(5000)]);
  if (proc.exitCode === null && proc.signalCode === null) {
    try {
      process.kill(proc.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  log(`chrome pid ${proc.pid} stopped`);
}

async function newTarget() {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const c = new Cdp(t.webSocketDebuggerUrl);
  await c.open();
  c.targetId = t.id;
  return c;
}

// ---------------------------------------------------------------- overlay (in the page, recording only)
const OVERLAY = `(() => {
  if (window.__film) return true;
  const P = ${JSON.stringify(PAPER)}, I = ${JSON.stringify(INK)}, M = ${JSON.stringify(MAGENTA)};
  const css = document.createElement("style");
  css.textContent = \`
  #film-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; contain: layout; }
  #film-overlay * { pointer-events: none; box-sizing: border-box; }
  .film-cursor { position: absolute; left: 0; top: 0; width: 30px; height: 38px; will-change: transform; }
  .film-cursor[hidden] { display: none; }
  .film-ripple { position: absolute; width: 20px; height: 20px; border: 2px solid \${I}; outline: 2px solid \${P}; opacity: 1;
    transition: width 450ms cubic-bezier(0.16,1,0.3,1), height 450ms cubic-bezier(0.16,1,0.3,1), margin 450ms cubic-bezier(0.16,1,0.3,1), opacity 450ms linear; }
  .film-frame { position: absolute; border: 3px solid \${M}; outline: 2px solid \${P}; opacity: 0;
    transition: left 300ms cubic-bezier(0.16,1,0.3,1), top 300ms cubic-bezier(0.16,1,0.3,1), width 300ms cubic-bezier(0.16,1,0.3,1), height 300ms cubic-bezier(0.16,1,0.3,1), opacity 200ms linear; }
  .film-bubble { position: absolute; left: 0; top: 0; max-width: 560px; padding: 12px 18px; background: \${P}; color: \${I};
    border: 2px solid \${I}; border-radius: 0; box-shadow: none; font: 400 22px/1.3 "B612", sans-serif; opacity: 0;
    transition: left 300ms cubic-bezier(0.16,1,0.3,1), top 300ms cubic-bezier(0.16,1,0.3,1), opacity 200ms linear; }
  .film-tail, .film-tail::after { position: absolute; width: 0; height: 0; border: 0 solid transparent; }
  .film-tail::after { content: ""; }
  \`;
  const root = document.createElement("div");
  root.id = "film-overlay";
  root.setAttribute("aria-hidden", "true");
  const frame = document.createElement("div");
  frame.className = "film-frame";
  const bubble = document.createElement("div");
  bubble.className = "film-bubble";
  const btext = document.createElement("span");
  const tail = document.createElement("span");
  tail.className = "film-tail";
  bubble.append(btext, tail);
  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cursor.setAttribute("class", "film-cursor");
  cursor.setAttribute("viewBox", "0 0 30 38");
  cursor.innerHTML = '<path d="M3 3 L3 31 L10 24 L15.5 35 L20.5 32.5 L15 21.5 L25 21.5 Z" fill="' + I + '" stroke="' + P + '" stroke-width="2.2" stroke-linejoin="miter"/>';
  root.append(frame, bubble, cursor);
  document.documentElement.append(css, root);

  const cur = { x: -100, y: -100, anim: null };
  const place = () => { cursor.style.transform = "translate(" + (cur.x - 3) + "px," + (cur.y - 3) + "px)"; };
  place();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const visible = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== "hidden" && s.display !== "none"; };
  const rectOf = (spec) => {
    if (!spec) return null;
    if (typeof spec === "object") return { x: spec.x, y: spec.y, w: spec.w, h: spec.h };
    const e = [...document.querySelectorAll(spec)].find(visible);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const inflate = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const gap = (a, b) => Math.hypot(Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)));
  const SOFT = ".story-head > *, .caption, .walkbar, .map-cluster, .drawer, .station-pop, .map-tag, .scene-credit, .hud__sim-row, .hud__warning, .hud__nav, .hud__margins, .hud__science, .hud__bottom, .minimap, .sheet .page__head, .route-card__head";

  function placeBubble(target, text) {
    if (!text) { bubble.style.opacity = "0"; return null; }
    if (btext.textContent !== text) btext.textContent = text;
    const W = innerWidth, H = innerHeight, m = 14;
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const hard = [];
    if (target) hard.push(inflate(target, 10));
    const next = document.getElementById("story-next");
    if (visible(next)) { const r = next.getBoundingClientRect(); hard.push(inflate({ x: r.left, y: r.top, w: r.width, h: r.height }, 10)); }
    const soft = [...document.querySelectorAll(SOFT)].filter(visible).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const cands = [];
    const clamp = (x, y) => ({ x: Math.max(m, Math.min(W - w - m, x)), y: Math.max(m, Math.min(H - h - m, y)), w, h });
    if (target) {
      const G = 26, cx = target.x + target.w / 2, cy = target.y + target.h / 2;
      for (const f of [0, -0.5, 0.5, -1, 1]) {
        cands.push(clamp(target.x + target.w + G, cy - h / 2 + f * h));
        cands.push(clamp(target.x - G - w, cy - h / 2 + f * h));
        cands.push(clamp(cx - w / 2 + f * w * 0.6, target.y + target.h + G));
        cands.push(clamp(cx - w / 2 + f * w * 0.6, target.y - G - h));
      }
    }
    for (let y = m; y <= H - h - m; y += 30) for (let x = m; x <= W - w - m; x += 40) cands.push({ x, y, w, h });
    const tc = target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : { x: W / 2, y: H * 0.42 };
    let best = null, bestS = Infinity;
    for (const c of cands) {
      let s = 0;
      for (const r of hard) s += overlap(c, r) * 1000;
      for (const r of soft) s += overlap(c, r) * 0.6;
      s += target ? gap(c, target) * 2 : Math.hypot(c.x + w / 2 - tc.x, c.y + h / 2 - tc.y);
      if (s < bestS) { bestS = s; best = c; }
    }
    bubble.style.left = best.x + "px";
    bubble.style.top = best.y + "px";
    bubble.style.opacity = "1";
    drawTail(best, target);
    return { x: best.x, y: best.y, w, h, overlapHard: hard.reduce((a, r) => a + overlap(best, r), 0) };
  }

  function drawTail(b, t) {
    if (!t) { tail.style.display = "none"; return; }
    let side;
    if (t.x >= b.x + b.w) side = "right";
    else if (t.x + t.w <= b.x) side = "left";
    else if (t.y >= b.y + b.h) side = "bottom";
    else if (t.y + t.h <= b.y) side = "top";
    else { tail.style.display = "none"; return; }
    tail.style.display = "block";
    const O = 14, In = 11;
    const s = tail.style;
    tail.removeAttribute("style");
    tail.style.display = "block";
    const inner = document.getElementById("film-tail-inner") || (() => { const st = document.createElement("style"); st.id = "film-tail-inner"; document.documentElement.append(st); return st; })();
    if (side === "left" || side === "right") {
      const cy = Math.max(b.y + 16, Math.min(b.y + b.h - 16, t.y + t.h / 2)) - b.y;
      s.top = (cy - O) + "px";
      s.borderTopWidth = O + "px"; s.borderBottomWidth = O + "px";
      if (side === "right") { s.left = "100%"; s.borderLeftWidth = O + "px"; s.borderLeftColor = I; s.marginLeft = "2px"; }
      else { s.right = "100%"; s.borderRightWidth = O + "px"; s.borderRightColor = I; s.marginRight = "2px"; }
      inner.textContent = side === "right"
        ? ".film-tail::after { left: -" + (O + 3) + "px; top: -" + In + "px; border-top-width: " + In + "px; border-bottom-width: " + In + "px; border-left-width: " + In + "px; border-left-color: " + P + "; }"
        : ".film-tail::after { right: -" + (O + 3) + "px; top: -" + In + "px; border-top-width: " + In + "px; border-bottom-width: " + In + "px; border-right-width: " + In + "px; border-right-color: " + P + "; }";
    } else {
      const cx = Math.max(b.x + 16, Math.min(b.x + b.w - 16, t.x + t.w / 2)) - b.x;
      s.left = (cx - O) + "px";
      s.borderLeftWidth = O + "px"; s.borderRightWidth = O + "px";
      if (side === "bottom") { s.top = "100%"; s.borderTopWidth = O + "px"; s.borderTopColor = I; s.marginTop = "2px"; }
      else { s.bottom = "100%"; s.borderBottomWidth = O + "px"; s.borderBottomColor = I; s.marginBottom = "2px"; }
      inner.textContent = side === "bottom"
        ? ".film-tail::after { top: -" + (O + 3) + "px; left: -" + In + "px; border-left-width: " + In + "px; border-right-width: " + In + "px; border-top-width: " + In + "px; border-top-color: " + P + "; }"
        : ".film-tail::after { bottom: -" + (O + 3) + "px; left: -" + In + "px; border-left-width: " + In + "px; border-right-width: " + In + "px; border-bottom-width: " + In + "px; border-bottom-color: " + P + "; }";
    }
  }

  let lastPoint = { spec: null, text: null };
  window.__film = {
    rectOf,
    move(x, y, ms) {
      if (cur.anim) cancelAnimationFrame(cur.anim);
      const x0 = cur.x, y0 = cur.y, t0 = performance.now();
      return new Promise((done) => {
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
          const e = ease(k);
          cur.x = x0 + (x - x0) * e; cur.y = y0 + (y - y0) * e;
          place();
          if (k < 1) cur.anim = requestAnimationFrame(tick); else { cur.anim = null; done(true); }
        };
        tick();
      });
    },
    set(x, y) { if (cur.anim) cancelAnimationFrame(cur.anim); cur.anim = null; cur.x = x; cur.y = y; place(); },
    showCursor(on) { cursor.toggleAttribute("hidden", !on); },
    ripple(x, y) {
      const r = document.createElement("div");
      r.className = "film-ripple";
      r.style.left = x - 10 + "px"; r.style.top = y - 10 + "px";
      root.insertBefore(r, cursor);
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.width = "64px"; r.style.height = "64px"; r.style.margin = "-22px 0 0 -22px"; r.style.opacity = "0"; }));
      setTimeout(() => r.remove(), 700);
    },
    point(spec, text) {
      lastPoint = { spec, text };
      const t = rectOf(spec);
      if (t) {
        const f = inflate(t, 6);
        frame.style.left = f.x + "px"; frame.style.top = f.y + "px"; frame.style.width = f.w + "px"; frame.style.height = f.h + "px";
        frame.style.opacity = "1";
      } else frame.style.opacity = "0";
      return { target: t, bubble: placeBubble(t, text) };
    },
    clear() { lastPoint = { spec: null, text: null }; frame.style.opacity = "0"; bubble.style.opacity = "0"; },
    hideFrame() { frame.style.opacity = "0"; },
    // Frame and bubble follow an element that moves or changes size (tags over a turning map, a growing card).
    refresh() { if (lastPoint.spec && typeof lastPoint.spec === "string") window.__film.point(lastPoint.spec, lastPoint.text); },
  };
  return true;
})()`;

// ---------------------------------------------------------------- the driver: real input + the drawn overlay
class Driver {
  constructor(cdp) {
    this.c = cdp;
    this.x = VW * 0.62;
    this.y = VH * 0.45;
    this.real = true;
    this.fast = false;
    this.notes = [];
  }
  ev(e) {
    return this.c.ev(e);
  }
  state() {
    return this.ev("(() => { const M = window.__marswalk; const s = typeof M.state === 'function' ? M.state() : M.state; return JSON.parse(JSON.stringify({ step: s.step, view: s.view, explore: s.explore, drawer: s.drawer, panel: s.panel, sheet: s.sheet, picked: s.picked, plan: { status: s.plan.status }, walk: { active: s.walk.active, playing: s.walk.playing, speed: s.walk.speed, t_s: s.walk.t_s, pending: s.walk.pending, card: s.walk.card, mode: s.walk.snapshot ? s.walk.snapshot.mode : null, hazard: s.walk.hazard ? !!s.walk.hazard.active : false }, camera: M.view.getCamera() })); })()");
  }
  async waitFor(desc, pred, timeoutMs = 30000) {
    const t0 = Date.now();
    for (;;) {
      const s = await this.state().catch(() => null);
      if (s && pred(s)) return s;
      if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${desc}`);
      await sleep(100);
    }
  }
  async rect(spec) {
    const r = await this.ev(`window.__film.rectOf(${JSON.stringify(spec)})`);
    if (!r) throw new Error(`no visible element for ${typeof spec === "string" ? spec : JSON.stringify(spec)}`);
    return r;
  }
  async centre(spec) {
    const r = typeof spec === "object" && "x" in spec && !("w" in spec) ? null : await this.rect(spec);
    return r ? { x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) } : spec;
  }
  // Where the cursor rests to show an element: its lower right part, so the arrow does not cover the words.
  async rest(spec) {
    const r = await this.rect(spec);
    return { x: Math.round(r.x + Math.min(r.w * 0.78, r.w - 10)), y: Math.round(r.y + Math.min(r.h * 0.8, r.h - 6)) };
  }
  async exists(sel) {
    return this.ev(`!!window.__film.rectOf(${JSON.stringify(sel)})`);
  }
  mouse(type, x, y, extra = {}) {
    return this.c.send("Input.dispatchMouseEvent", { type, x, y, button: "none", buttons: 0, ...extra });
  }
  // Moves the drawn cursor with easing; with real input on, the mouse goes along the same eased path.
  async moveTo(p, ms = null, { drag = false } = {}) {
    const to = typeof p === "string" ? await this.rest(p) : p;
    const d = Math.hypot(to.x - this.x, to.y - this.y);
    const dur = ms ?? Math.min(1300, 380 + d * 0.75);
    if (this.fast) {
      this.x = to.x;
      this.y = to.y;
      await this.ev(`window.__film.set(${to.x}, ${to.y})`);
      return;
    }
    await this.ev(`window.__film.move(${to.x}, ${to.y}, ${dur}), true`);
    const x0 = this.x;
    const y0 = this.y;
    const t0 = Date.now();
    if (this.real) {
      const n = Math.max(6, Math.round(dur / 40));
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        await sleep(t0 + dur * k - Date.now());
        const e = ease(k);
        await this.mouse("mouseMoved", Math.round(x0 + (to.x - x0) * e), Math.round(y0 + (to.y - y0) * e), drag ? { button: "left", buttons: 1 } : {});
      }
    }
    await sleep(t0 + dur - Date.now());
    this.x = to.x;
    this.y = to.y;
  }
  async path(points, ms) {
    if (!points.length) return;
    let total = 0;
    let px = this.x;
    let py = this.y;
    const lens = points.map((p) => {
      const l = Math.hypot(p.x - px, p.y - py);
      px = p.x;
      py = p.y;
      total += l;
      return l;
    });
    for (let i = 0; i < points.length; i++) await this.moveTo(points[i], Math.max(60, (ms * lens[i]) / Math.max(1, total)));
  }
  async click(spec, { ms = null } = {}) {
    if (this.fast) throw new Error("click in fast mode");
    const p = await this.centre(spec);
    await this.moveTo(p, ms);
    await this.ev(`window.__film.ripple(${p.x}, ${p.y})`);
    await this.mouse("mousePressed", p.x, p.y, { button: "left", buttons: 1, clickCount: 1 });
    await sleep(90);
    await this.mouse("mouseReleased", p.x, p.y, { button: "left", buttons: 0, clickCount: 1 });
    await sleep(120);
  }
  async drag(from, to, ms = 1400) {
    await this.moveTo(from);
    await this.mouse("mousePressed", from.x, from.y, { button: "left", buttons: 1, clickCount: 1 });
    await sleep(120);
    await this.moveTo(to, ms, { drag: true });
    await sleep(120);
    await this.mouse("mouseReleased", to.x, to.y, { button: "left", buttons: 0, clickCount: 1 });
  }
  async wheel(deltaY, notches = 1, everyMs = 260) {
    for (let i = 0; i < notches; i++) {
      await this.mouse("mouseWheel", this.x, this.y, { deltaX: 0, deltaY });
      await sleep(everyMs);
    }
  }
  async key(k) {
    const map = { n: ["KeyN", 78, "n"], a: ["KeyA", 65, "a"], r: ["KeyR", 82, "r"], Enter: ["Enter", 13, "\r"] };
    const [code, vk, text] = map[k];
    await this.c.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text, unmodifiedText: text });
    await sleep(70);
    await this.c.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  point(spec, text = this.bubble) {
    if (this.fast) return null;
    return this.ev(`window.__film.point(${JSON.stringify(spec)}, ${JSON.stringify(text)})`).then((r) => {
      if (!r.target && spec) this.notes.push(`${this.seg}: point target not found: ${typeof spec === "string" ? spec : "scene point"}`);
      if (r.bubble && r.bubble.overlapHard > 0) this.notes.push(`${this.seg}: bubble touches the target or Next (${Math.round(r.bubble.overlapHard)} px2)`);
      return r;
    });
  }
  clear() {
    return this.fast ? null : this.ev("window.__film.clear()");
  }
  cursor(on) {
    return this.fast ? null : this.ev(`window.__film.showCursor(${on})`);
  }
  // Screen points of scene coordinates (x east, y north, metres), only the ones in view.
  async project(pts) {
    return this.ev(`(() => { const v = window.__marswalk.view; return ${JSON.stringify(pts)}.map(([x, y]) => v.project(x, y)).filter((p) => p && p.visible !== false && p.sx > 20 && p.sx < ${VW - 20} && p.sy > 60 && p.sy < ${VH - 20}).map((p) => ({ x: Math.round(p.sx), y: Math.round(p.sy) })); })()`);
  }
  inputs() {
    return this.ev("(() => { const s = window.__marswalk.state(); return JSON.parse(JSON.stringify({ base: s.inputs.base, stations: s.inputs.stations, no_go: s.inputs.no_go, legs: s.plan.route ? s.plan.route.legs.map((l) => ({ to: l.to.id, path: l.path })) : [] })); })()");
  }
  act(code) {
    return this.ev(`(async () => { const A = window.__marswalk.actions; ${code}; return true; })()`);
  }
}

const box = (p, r = 44) => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r });
const settle = (d, ms = 350) => d.ev(`new Promise((r) => setTimeout(r, ${ms}))`);
const walkReady = (s) => s.view === "walk" && s.walk.active && !s.walk.pending && s.camera && s.camera.view === "walk";

// ---------------------------------------------------------------- the shot table
// One entry per segment id. pre: done (and filmed) before the narration starts, for things that must be waited
// for. steps: [fraction of the segment duration after the narration start, what happens]. fast: the state change
// alone, through the app's own actions and unfilmed, for --only catch-up. real: false sends no input event at all
// (step 1 turns slowly and the app stops that turn for good on any real input).
const SHOTS = {
  "01-hello": {
    real: false,
    steps: [
      [0.0, (d) => d.point(".story-title")],
      [0.04, (d) => d.moveTo(".story-title", 1400)],
    ],
  },
  "02-place": {
    real: false,
    steps: [
      [0.0, (d) => d.moveTo(".caption .caption__headline", 3200)],
      [0.12, (d) => d.point(".caption")],
    ],
  },
  "03-steps": {
    real: false,
    steps: [
      [0.0, (d) => d.point(".story-steps")],
      ...[1, 2, 3, 4, 5].map((n, i) => [0.04 + i * 0.11, (d) => d.moveTo(`.story-step[data-step="${n}"]`, 900)]),
      [0.66, (d) => d.point("#story-next")],
      [0.68, (d) => d.moveTo("#story-next", 1200)],
    ],
  },
  "04-map": {
    fast: (d) => d.act("A.stopTurn()"),
    steps: [
      [0.0, (d) => d.point(".map-cluster .map-tools")],
      [0.03, (d) => d.click('.map-tools__btn[aria-label="Zoom in"]')],
      [0.11, (d) => d.click('.map-tools__btn[aria-label="Zoom in"]', { ms: 300 })],
      [0.24, (d) => d.click('.map-tools__btn[aria-label="Turn right"]')],
      [0.30, (d) => d.click('.map-tools__btn[aria-label="Turn right"]', { ms: 260 })],
      [0.36, (d) => d.click('.map-tools__btn[aria-label="Turn right"]', { ms: 260 })],
      [0.48, (d) => d.drag({ x: 1180, y: 470 }, { x: 1040, y: 540 }, 1500)],
      [0.80, (d) => d.click(".map-tools__fit")],
    ],
  },
  "05-plan": {
    pre: async (d) => {
      await d.clear();
      await d.click("#story-next");
      await d.waitFor("the route on the plan step", (s) => s.step === 2 && s.plan.status === "ok");
      await d.ev("new Promise((r) => { const t0 = performance.now(); const f = () => (document.querySelector('.map-tag--station') || performance.now() - t0 > 8000 ? r() : requestAnimationFrame(f)); f(); })");
      await settle(d, 900);
    },
    fast: async (d) => {
      await d.act("A.gotoStep(2)");
      await d.waitFor("the route", (s) => s.step === 2 && s.plan.status === "ok");
    },
    steps: [
      [0.0, (d) => d.point(".map-tag:not(.map-tag--station)")],
      [0.02, (d) => d.moveTo(".map-tag:not(.map-tag--station)")],
      [0.30, async (d) => {
        const inp = await d.inputs();
        const leg = inp.legs[0];
        const st = inp.stations.find((s) => s.id === leg.to) || inp.stations[0];
        const pts = await d.project(leg.path.filter((_, i) => i % Math.max(1, Math.floor(leg.path.length / 14)) === 0).concat([[st.x, st.y]]));
        const near = pts[Math.max(0, Math.floor(pts.length * 0.6) - 1)] || pts[pts.length - 1];
        if (near) await d.point(box(near, 40));
        await d.path(pts, 3600);
      }],
    ],
  },
  "06-marks": {
    steps: [
      [0.0, (d) => d.point('.map-tag[data-station="1"]')],
      [0.01, (d) => d.moveTo('.map-tag[data-station="1"]')],
      [0.22, (d) => d.point('.map-tag[data-station="2"]')],
      [0.23, (d) => d.moveTo('.map-tag[data-station="2"]')],
      [0.46, async (d) => {
        const inp = await d.inputs();
        const s3 = inp.stations.find((s) => s.id === 3);
        const cen = (z) => z.polygon.reduce((a, p) => [a[0] + p[0] / z.polygon.length, a[1] + p[1] / z.polygon.length], [0, 0]);
        const zone = inp.no_go.slice().sort((a, b) => Math.hypot(cen(a)[0] - s3.x, cen(a)[1] - s3.y) - Math.hypot(cen(b)[0] - s3.x, cen(b)[1] - s3.y))[0];
        // The zone runs off the screen edge: its middle is taken from the corners in view.
        const seen = await d.project([...zone.polygon, cen(zone)]);
        if (!seen.length) return d.notes.push("06-marks: the no-go zone near S3 is out of view");
        const p = { x: Math.round(seen.reduce((a, q) => a + q.x, 0) / seen.length), y: Math.round(seen.reduce((a, q) => a + q.y, 0) / seen.length) };
        await d.point(box(p, 46));
        await d.moveTo(p);
      }],
    ],
  },
  "07-numbers": {
    steps: [
      [0.0, (d) => d.point(".caption .keynums")],
      ...[1, 2, 3, 4].map((n, i) => [0.02 + i * 0.2, (d) => d.moveTo(`.caption .keynum:nth-child(${n}) .keynum__value`, 800)]),
    ],
  },
  "08-station": {
    fast: (d) => d.act("A.pickStation(null)"),
    steps: [
      [0.0, (d) => d.point('.map-tag[data-station="6"]')],
      // The station tags take no mouse hit in this build (their label layer has pointer-events: none), so the
      // drawn cursor clicks the tag and the tag is opened with its keyboard path: focus, then a real Enter key.
      [0.02, async (d) => {
        const p = await d.centre('.map-tag[data-station="6"]');
        await d.moveTo(p);
        await d.ev(`window.__film.ripple(${p.x}, ${p.y})`);
        await d.ev("document.querySelector('.map-tag[data-station=\"6\"]').focus({ preventScroll: true })");
        await d.key("Enter");
        if (!(await d.state()).picked) d.notes.push("08-station: the S6 card did not open");
      }],
      [0.14, async (d) => {
        await settle(d, 250);
        await d.point(".station-pop");
        await d.moveTo(".station-pop .station-pop__task", 900);
      }],
      [0.88, (d) => d.click(".station-pop__close")],
    ],
  },
  "09-layers": {
    steps: [
      [0.0, (d) => d.point(".story-chips")],
      [0.03, (d) => d.click(".story-chip:nth-of-type(1)")],
      [0.18, (d) => d.click(".story-chip:nth-of-type(1)", { ms: 250 })],
      [0.30, (d) => d.click(".story-chip:nth-of-type(2)")],
      [0.45, (d) => d.click(".story-chip:nth-of-type(2)", { ms: 250 })],
      [0.58, (d) => d.click(".story-chip:nth-of-type(3)")],
      [0.73, (d) => d.click(".story-chip:nth-of-type(3)", { ms: 250 })],
    ],
  },
  "10-sources": {
    fast: (d) => d.act("A.setSources(false)"),
    steps: [
      [0.0, (d) => d.point(".story-switch")],
      [0.02, (d) => d.click(".story-switch")],
      [0.24, (d) => d.point(".caption .keynums")],
      ...[1, 2, 3, 4].map((n, i) => [0.26 + i * 0.14, async (d) => {
        if (await d.exists(`.caption .keynum:nth-child(${n})`)) await d.moveTo(`.caption .keynum:nth-child(${n}) .keynum__label`, 800);
      }]),
      [0.80, (d) => d.point(".story-switch")],
      [0.81, (d) => d.click(".story-switch")],
    ],
  },
  "11-details": {
    fast: (d) => d.act("A.setDrawer(true, 'limits')"),
    steps: [
      [0.0, (d) => d.point("#story-details")],
      [0.02, (d) => d.click("#story-details")],
      [0.16, async (d) => {
        await settle(d, 200);
        await d.point("#panel-limits .minimums");
      }],
      ...[1, 2, 3, 4, 5, 6].map((n, i) => [0.2 + i * 0.12, (d) => d.moveTo(`#panel-limits .minimums tbody tr.minimums__r1:nth-of-type(${2 * n - 1}) .minimums__limit`, 700)]),
    ],
  },
  "12-tabs": {
    fast: (d) => d.act("A.setDrawer(false)"),
    steps: [
      ...["timeline", "layers", "stations", "editor", "credits"].flatMap((t, i) => [
        [0.02 + i * 0.185, async (d) => {
          await d.point(`#tab-${t}`);
          await d.click(`#tab-${t}`);
        }],
        [0.02 + i * 0.185 + 0.07, async (d) => {
          const more = await d.ev("(() => { const b = document.querySelector('.drawer__body'); return b ? b.scrollHeight - b.clientHeight : 0; })()");
          if (more > 40) {
            await d.moveTo(await d.centre(".drawer__body"), 700);
            await d.wheel(120, 2, 300);
          }
        }],
      ]),
      [0.95, async (d) => {
        await d.clear();
        await d.click(".drawer__close", { ms: 500 });
      }],
    ],
  },
  "13-walk": {
    pre: async (d) => {
      await d.clear();
      await d.point("#story-next", null);
      await d.click("#story-next");
      await d.clear();
      await d.waitFor("eye height", walkReady);
      await settle(d, 1200);
    },
    fast: async (d) => {
      await d.act("A.gotoStep(3)");
      await d.waitFor("eye height", walkReady);
    },
    steps: [
      [0.0, (d) => d.point(".hud__sim")],
      [0.02, (d) => d.moveTo(".hud__sim", 1100)],
    ],
  },
  "14-hud": {
    steps: [
      [0.0, (d) => d.point(".hud__nav")],
      [0.02, (d) => d.moveTo(".hud__nav .hud__nav-row", 1000)],
      [0.42, (d) => d.point(".hud__margins")],
      [0.44, (d) => d.moveTo(".hud__margins", 1000)],
    ],
  },
  "15-science": {
    steps: [
      [0.0, (d) => d.point(".hud__science")],
      [0.02, (d) => d.moveTo(".hud__science", 1000)],
      [0.55, (d) => d.point(".minimap")],
      [0.57, (d) => d.moveTo(".minimap", 1000)],
    ],
  },
  "16-actions": {
    fast: (d) => d.act("A.setSpeed(240)"),
    steps: [
      [0.0, (d) => d.point(".hud-btn--return")],
      [0.01, (d) => d.moveTo(".hud-btn--return", 900)],
      [0.13, (d) => d.point(".hud-btn--ack")],
      [0.14, (d) => d.moveTo(".hud-btn--ack", 600)],
      [0.25, (d) => d.point(".hud-btn--next")],
      [0.26, (d) => d.moveTo(".hud-btn--next", 600)],
      [0.50, (d) => d.point(".walkbar__controls")],
      [0.52, (d) => d.click(".walkbar__play")],
      [0.63, (d) => d.click(".walkbar__play", { ms: 250 })],
      [0.75, (d) => d.click('.walkbar__speed .segmented__opt[aria-label="Replay 240 times faster"]')],
    ],
  },
  "17-arrive": {
    pre: async (d) => {
      await d.clear();
      // 60x first, then at least one Next: a card already open at 240x would close before the narration ends.
      await d.click('.walkbar__speed .segmented__opt[aria-label="Replay 60 times faster"]');
      await d.point(".hud-btn--next", null);
      await d.moveTo(".hud-btn--next", 700);
      for (let i = 0; i < 12; i++) {
        const s = await d.state();
        if (i > 0 && s.walk.mode === "work" && s.walk.card !== null) break;
        await d.ev(`window.__film.ripple(${d.x}, ${d.y})`);
        await d.key("n");
        await d.waitFor("the walk step", (x) => !x.walk.pending, 10000);
        await settle(d, 500);
      }
      await d.clear();
      await settle(d, 300);
    },
    fast: async (d) => {
      for (let i = 0; i < 12; i++) {
        const s = await d.state();
        if (s.walk.mode === "work" && s.walk.card !== null) break;
        await d.act("await A.next()");
      }
      await d.act("A.setSpeed(60)");
    },
    steps: [
      [0.0, (d) => d.point(".hud-card")],
      [0.02, (d) => d.moveTo(".hud-card .hud-card__task", 1000)],
    ],
  },
  "18-hazard": {
    pre: async (d) => {
      await d.clear();
      await d.point("#story-next", null);
      await d.click("#story-next");
      await d.clear();
      await d.waitFor("RETURN NOW", (s) => s.step === 4 && s.walk.active && s.walk.hazard && !s.walk.pending, 30000);
      await d.ev("new Promise((r) => { const t0 = performance.now(); const f = () => (document.querySelector('.hud__warning[data-level=\"return\"]') || performance.now() - t0 > 8000 ? r() : requestAnimationFrame(f)); f(); })");
      await settle(d, 900);
    },
    fast: async (d) => {
      await d.act("A.gotoStep(4)");
      await d.waitFor("RETURN NOW", (s) => s.step === 4 && s.walk.hazard && !s.walk.pending, 30000);
    },
    steps: [
      [0.0, (d) => d.point(".walkbar__text")],
      [0.02, (d) => d.moveTo(".walkbar__text", 1200)],
    ],
  },
  "19-return": {
    fast: (d) => d.act("A.play(); A.acknowledge()"),
    steps: [
      [0.0, (d) => d.point(".hud__warning")],
      [0.01, (d) => d.moveTo(".hud__warning", 900)],
      [0.24, (d) => d.point(".hud__nav")],
      [0.25, (d) => d.moveTo(".hud__nav .hud__nav-row", 800)],
      [0.44, (d) => d.point(".minimap")],
      [0.45, (d) => d.moveTo(".minimap", 800)],
      [0.62, (d) => d.click(".walkbar__play")],
      [0.88, (d) => d.point(".hud-btn--ack")],
      [0.89, (d) => d.click(".hud-btn--ack")],
    ],
  },
  "20-check": {
    pre: async (d) => {
      await d.clear();
      await d.point("#story-next", null);
      await d.click("#story-next");
      await d.clear();
      await d.waitFor("the check step", (s) => s.step === 5 && s.view === "plan" && s.plan.status === "ok");
      await settle(d, 1500);
    },
    fast: async (d) => {
      await d.act("A.gotoStep(5)");
      await d.waitFor("the check step", (s) => s.step === 5 && s.view === "plan");
    },
    steps: [
      [0.0, async (d) => {
        const wp = await d.ev("fetch('./public/data/waypoints.json').then((r) => r.json()).then((j) => j.waypoints.map((w) => [w.x, w.y]))");
        const pts = await d.project(wp);
        const thin = [];
        for (const p of pts) if (!thin.length || Math.hypot(p.x - thin[thin.length - 1].x, p.y - thin[thin.length - 1].y) > 40) thin.push(p);
        if (!thin.length) return d.notes.push("20-check: no Curiosity waypoint in view");
        const mid = thin[Math.floor(thin.length * 0.15)];
        await d.point(box(mid, 40));
        await d.moveTo(thin[0], 900);
        await d.path(thin.slice(1), 4200);
      }],
      [0.56, (d) => d.point(".caption .keynums")],
      ...[1, 2, 3, 4].map((n, i) => [0.58 + i * 0.09, async (d) => {
        if (await d.exists(`.caption .keynum:nth-child(${n})`)) await d.moveTo(`.caption .keynum:nth-child(${n}) .keynum__value`, 600);
      }]),
    ],
  },
  "21-card": {
    fast: (d) => d.act("A.showSheet(null)"),
    steps: [
      [0.0, (d) => d.point(".story-end__print")],
      [0.02, (d) => d.click(".story-end__print")],
      [0.12, async (d) => {
        await d.waitFor("the route card sheet", (s) => s.sheet === "route-card", 5000);
        await settle(d, 300);
        await d.point("#route-card-sheet .route-card__head");
        await d.moveTo({ x: 960, y: 560 }, 900);
      }],
      [0.30, async (d) => {
        await d.ev("window.__film.hideFrame()");
        await d.wheel(100, 8, 280);
      }],
      [0.60, (d) => d.wheel(-100, 8, 220)],
      [0.86, async (d) => {
        await d.point("#route-card-sheet .page__head .btn-row .btn:not(.btn--primary)");
        await d.click("#route-card-sheet .page__head .btn-row .btn:not(.btn--primary)");
      }],
    ],
  },
  "22-free": {
    fast: async (d) => {
      await d.act("A.setExplore(true)");
      await settle(d, 300);
    },
    steps: [
      [0.0, (d) => d.point(".story-end__explore")],
      [0.02, (d) => d.click(".story-end__explore")],
      [0.18, async (d) => {
        await settle(d, 300);
        await d.point(".walkbar--explore");
      }],
      [0.36, (d) => d.click('.map-tools__btn[aria-label="Zoom in"]')],
      [0.54, async (d) => {
        const free = await d.ev("(() => { const dr = document.querySelector('.drawer'); const r = dr ? dr.getBoundingClientRect() : { left: innerWidth }; return { x: Math.round(r.left / 2), y: Math.round(innerHeight * 0.45) }; })()");
        await d.drag(free, { x: free.x - 120, y: free.y + 60 }, 1100);
      }],
    ],
  },
  "23-end": {
    fast: async (d) => {
      await d.act("A.setDrawer(false); A.setExplore(false); A.gotoStep(1)");
    },
    steps: [
      [0.0, (d) => d.clear()],
      [0.01, (d) => d.click(".drawer__close")],
      [0.12, (d) => d.click(".story-resume")],
      [0.24, (d) => d.click('.story-step[data-step="1"]')],
      [0.36, async (d) => {
        await d.moveTo({ x: VW - 40, y: VH * 0.5 }, 900);
        await d.cursor(false);
        await d.point(null);
      }],
    ],
  },
};

// ---------------------------------------------------------------- timing, audio, captions
function probeSeconds(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  const v = parseFloat(r.stdout);
  if (!Number.isFinite(v)) throw new Error(`ffprobe could not read ${file}`);
  return v;
}

function plan(segments, silent) {
  return segments.map((s) => {
    const audio = join(HERE, "audio", `${s.id}.mp3`);
    const words = s.say.trim().split(/\s+/).length;
    const has = !silent && existsSync(audio);
    const speech = has ? probeSeconds(audio) : words / WORDS_PER_S;
    return { ...s, audio: has ? audio : null, speech, dur: speech + TAIL_S };
  });
}

export function chunks(text, max = CHUNK_MAX) {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  const out = [];
  const split = (s) => {
    if (s.length <= max) return [s];
    const words = s.split(" ");
    const n = Math.ceil(s.length / max);
    const target = s.length / n;
    const parts = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      const commaBreak = cur.endsWith(",") && cur.length >= target * 0.6;
      if (cur && (next.length > max || (cur.length >= target && parts.length < n - 1) || commaBreak)) {
        parts.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) parts.push(cur);
    return parts;
  };
  for (const s of sentences) out.push(...split(s));
  const merged = [];
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && last.length < 45 && last.length + 1 + c.length <= max) merged[merged.length - 1] = `${last} ${c}`;
    else merged.push(c);
  }
  return merged;
}

// ---------------------------------------------------------------- run
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const board = JSON.parse(readFileSync(join(HERE, "storyboard.json"), "utf8"));
  for (const s of board.segments) if (!SHOTS[s.id]) throw new Error(`no shot table entry for ${s.id}`);
  const segs = plan(board.segments, args.silent);
  if (args.only) for (const id of args.only) if (!segs.some((s) => s.id === id)) throw new Error(`--only: unknown segment ${id}`);
  const wanted = (id) => !args.only || args.only.includes(id);
  const lastWanted = Math.max(...segs.map((s, i) => (wanted(s.id) ? i : -1)));
  const runDir = join(args.scratch, `run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const framesDir = join(runDir, "frames");
  mkdirSync(framesDir, { recursive: true });
  const outDir = join(HERE, "out");
  mkdirSync(outDir, { recursive: true });
  log(`run folder ${runDir}`);
  log(`segments ${segs.length}, audio files ${segs.filter((s) => s.audio).length}, planned speech ${segs.reduce((a, s) => a + s.dur, 0).toFixed(1)} s`);

  const app = await fetch(args.url).catch(() => null);
  if (!app || !app.ok) throw new Error(`the app does not answer at ${args.url}`);

  let chrome = null;
  const onSignal = async () => {
    await stopChrome(chrome);
    process.exit(130);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    chrome = await startChrome(args.scratch);
    const c = await newTarget();
    const pageErrors = [];
    c.on("Runtime.exceptionThrown", (p) => pageErrors.push((p.exceptionDetails.exception?.description || p.exceptionDetails.text || "").slice(0, 200)));
    await c.send("Runtime.enable");
    await c.send("Page.enable");
    await c.send("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
    await c.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await c.send("Page.navigate", { url: args.url });
    const d = new Driver(c);
    await d.waitFor("the app and its route", (s) => s.plan.status === "ok", 90000).catch(async (e) => {
      throw new Error(`${e.message} (page errors: ${pageErrors.join(" | ") || "none"})`);
    });
    const gpu = await c.ev("(() => { const g = document.createElement('canvas').getContext('webgl2'); const x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()");
    const renderer = await c.ev("window.__marswalk.renderer");
    log(`app ready, renderer ${renderer}, GPU ${gpu}`);
    await c.ev("document.fonts.ready.then(() => true)");
    await sleep(1200);
    await c.ev(OVERLAY);
    await c.ev(`window.__film.set(${d.x}, ${d.y})`);

    // Screencast: every frame kept with its timestamp, each one acknowledged at once.
    const frames = [];
    let latency = Infinity;
    let writes = Promise.resolve();
    let recording = false;
    c.on("Page.screencastFrame", (p) => {
      c.send("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {});
      const ts = p.metadata.timestamp;
      latency = Math.min(latency, now() - ts);
      if (!recording) return;
      const file = join(framesDir, `${String(frames.length).padStart(6, "0")}.jpg`);
      frames.push({ file, ts });
      const buf = Buffer.from(p.data, "base64");
      writes = writes.then(() => writeFile(file, buf));
    });
    await c.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: VW, maxHeight: VH, everyNthFrame: 1 });
    await sleep(400);
    // Wall clock to screencast clock: the smallest delay seen between a frame's timestamp and its arrival.
    const toTs = (wall) => wall - (Number.isFinite(latency) ? latency : 0);

    const done = [];
    recording = true;
    for (let i = 0; i <= lastWanted; i++) {
      const seg = segs[i];
      const shot = SHOTS[seg.id];
      d.seg = seg.id;
      d.bubble = seg.bubble;
      d.real = shot.real !== false;
      if (!wanted(seg.id)) {
        await c.ev("window.__film.clear()");
        d.fast = true;
        log(`${seg.id}: fast catch-up`);
        if (shot.fast) await shot.fast(d);
        d.fast = false;
        continue;
      }
      const preStart = now();
      if (shot.pre) {
        try {
          await shot.pre(d);
        } catch (e) {
          d.notes.push(`${seg.id} before the narration: ${e.message}`);
          log(`${seg.id}: before the narration failed: ${e.message}`);
        }
      }
      const start = now();
      log(`${seg.id}: narration at +${(start - preStart).toFixed(2)} s, ${seg.dur.toFixed(1)} s`);
      for (const [at, fn] of shot.steps) {
        await sleep((start + at * seg.dur - now()) * 1000);
        try {
          await fn(d);
        } catch (e) {
          d.notes.push(`${seg.id} step at ${at}: ${e.message}`);
          log(`${seg.id}: step at ${at} failed: ${e.message}`);
        }
      }
      const over = now() - (start + seg.dur);
      if (over > 0.05) d.notes.push(`${seg.id}: steps ran ${over.toFixed(2)} s past the segment end`);
      await sleep((start + seg.dur - now()) * 1000);
      const end = now();
      done.push({ seg, preStart, start, end });
    }
    recording = false;
    await c.send("Page.stopScreencast");
    await writes;
    for (const r of done) for (const k of ["preStart", "start", "end"]) r[k] = toTs(r[k]);
    log(`frames ${frames.length}, notes ${d.notes.length}, page errors ${pageErrors.length}`);

    // Film time: the recorded segments one after the other.
    let filmT = 0;
    const timeline = [];
    const list = [];
    for (const r of done) {
      const a = r.preStart;
      const b = r.end;
      const inside = frames.filter((f) => f.ts >= a && f.ts < b);
      const before = frames.filter((f) => f.ts < a).pop();
      const seq = before ? [{ file: before.file, ts: a }, ...inside] : inside.length ? [{ file: inside[0].file, ts: a }, ...inside.slice(1)] : [];
      for (let k = 0; k < seq.length; k++) list.push({ file: seq[k].file, dur: (k + 1 < seq.length ? seq[k + 1].ts : b) - seq[k].ts });
      const off = filmT - a;
      const speechEnd = r.start + r.seg.speech;
      const cs = chunks(r.seg.say);
      const totalChars = cs.reduce((x, s) => x + s.length, 0);
      let t = r.start;
      const capChunks = cs.map((text, k) => {
        const len = (r.seg.speech * text.length) / totalChars;
        const ch = { text, start: +(t + off).toFixed(3), end: +((k === cs.length - 1 ? Math.max(speechEnd, r.end) : t + len) + off).toFixed(3) };
        t += len;
        return ch;
      });
      const walkFps = inside.length / Math.max(0.001, b - a);
      timeline.push({
        id: r.seg.id, pre_start: +(a + off).toFixed(3), start: +(r.start + off).toFixed(3), end: +(b + off).toFixed(3),
        audio: r.seg.audio ? `audio/${r.seg.id}.mp3` : null, speech_s: +r.seg.speech.toFixed(3), frames: inside.length,
        capture_fps: +walkFps.toFixed(1), captions: capChunks,
      });
      filmT += b - a;
    }
    const total = filmT;
    writeFileSync(join(outDir, "timeline.json"), JSON.stringify({
      film: "out/marswalk-tour.mp4", duration_s: +total.toFixed(3), viewport: [VW, VH], gpu, renderer,
      notes: d.notes, page_errors: pageErrors, segments: timeline,
    }, null, 2) + "\n");
    log(`timeline written, film ${total.toFixed(1)} s`);
    if (!args.build) return;

    // Caption strips: one PNG per chunk from a small page in the same Chrome.
    const cap = await newTarget();
    await cap.send("Emulation.setDeviceMetricsOverride", { width: VW, height: BAND_H, deviceScaleFactor: 1, mobile: false });
    const font = readFileSync(FONT_TTF).toString("base64");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "B612"; src: url(data:font/ttf;base64,${font}) format("truetype"); }
html, body { margin: 0; width: ${VW}px; height: ${BAND_H}px; background: ${INK}; overflow: hidden; }
#c { box-sizing: border-box; width: ${VW}px; height: ${BAND_H}px; display: flex; align-items: center; justify-content: center; padding: 0 120px; }
#t { color: ${PAPER}; font: 400 30px/1.25 "B612", sans-serif; text-align: center; max-height: 76px; }
</style></head><body><div id="c"><div id="t"></div></div></body></html>`;
    const capPage = join(runDir, "captions.html");
    writeFileSync(capPage, html);
    await cap.send("Page.enable");
    await cap.send("Page.navigate", { url: `file://${capPage}` });
    await sleep(500);
    await cap.ev("document.fonts.load('30px B612').then(() => document.fonts.ready).then(() => true)");
    const capDir = join(runDir, "captions");
    mkdirSync(capDir, { recursive: true });
    const shot = async (text, file) => {
      const lines = await cap.ev(`(() => { const t = document.getElementById('t'); t.textContent = ${JSON.stringify(text)}; return Math.round(t.scrollHeight / 37.5); })()`);
      if (lines > 2) d.notes.push(`caption over two lines: ${text}`);
      await sleep(30);
      const s = await cap.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(file, Buffer.from(s.data, "base64"));
    };
    const blank = join(capDir, "blank.png");
    await shot("", blank);
    const band = [];
    let bt = 0;
    let n = 0;
    for (const seg of timeline) {
      for (const ch of seg.captions) {
        if (ch.start > bt + 0.001) band.push({ file: blank, dur: ch.start - bt });
        const f = join(capDir, `${String(n++).padStart(3, "0")}.png`);
        await shot(ch.text, f);
        const st = Math.max(ch.start, bt);
        band.push({ file: f, dur: Math.max(0.001, ch.end - st) });
        bt = Math.max(bt, ch.end);
      }
    }
    if (bt < total) band.push({ file: blank, dur: total - bt });
    cap.close();
    log(`caption strips ${n}`);

    const concat = (items, file) => {
      const lines = ["ffconcat version 1.0"];
      for (const it of items) lines.push(`file '${it.file}'`, `duration ${Math.max(0.001, it.dur).toFixed(6)}`);
      lines.push(`file '${items[items.length - 1].file}'`);
      writeFileSync(file, lines.join("\n") + "\n");
    };
    const vList = join(runDir, "video.ffconcat");
    const bList = join(runDir, "band.ffconcat");
    concat(list, vList);
    concat(band, bList);

    const out = join(outDir, "marswalk-tour.mp4");
    const ff = ["-y", "-hide_banner", "-loglevel", "error", "-stats",
      "-f", "concat", "-safe", "0", "-i", vList,
      "-f", "concat", "-safe", "0", "-i", bList];
    const audios = timeline.filter((s) => s.audio);
    let filter = `[0:v]fps=${FPS},scale=${VW}:${VH}:out_range=tv,setsar=1,format=yuv420p[top];[1:v]fps=${FPS},scale=${VW}:${BAND_H}:out_range=tv,setsar=1,format=yuv420p[band];[top][band]vstack=inputs=2,format=yuv420p[v]`;
    if (audios.length) {
      audios.forEach((s) => ff.push("-i", join(HERE, s.audio)));
      const parts = audios.map((s, k) => `[${k + 2}:a]aresample=48000,adelay=${Math.round(s.start * 1000)}:all=1[a${k}]`);
      filter += `;${parts.join(";")};${audios.map((_, k) => `[a${k}]`).join("")}amix=inputs=${audios.length}:normalize=0:dropout_transition=0,apad[a]`;
    } else {
      ff.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
      filter += ";[2:a]anull[a]";
    }
    ff.push("-filter_complex", filter, "-map", "[v]", "-map", "[a]", "-t", total.toFixed(3),
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", out);
    log("ffmpeg: building the film");
    const r = spawnSync(FFMPEG, ff, { stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0) throw new Error(`ffmpeg failed with status ${r.status}`);
    log(`film written: ${out}`);
    if (d.notes.length) for (const nt of d.notes) log(`note: ${nt}`);
    // Notes found while building the captions go into the timeline too.
    const tl = JSON.parse(readFileSync(join(outDir, "timeline.json"), "utf8"));
    tl.notes = d.notes;
    writeFileSync(join(outDir, "timeline.json"), JSON.stringify(tl, null, 2) + "\n");
  } finally {
    await stopChrome(chrome);
  }
}

main().then(() => process.exit(0), (e) => {
  console.error(`[film] error: ${e.message}`);
  process.exit(1);
});
