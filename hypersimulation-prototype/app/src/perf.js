// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Frame rate only; no DOM. Frame callbacks receive a timestamp in ms like requestAnimationFrame.

function defaultFrame(cb) {
  return requestAnimationFrame(cb);
}

// Resolves to frames per second over ms after a warm-up (plan A6: the first 500 ms are skipped).
export function measureFps(ms, { warmupMs = 500, requestFrame = defaultFrame, now = null } = {}) {
  if (!(Number.isFinite(ms) && ms > 0)) return Promise.reject(new Error("measureFps: ms must be a positive number"));
  const clock = now || (() => performance.now());
  return new Promise((resolve) => {
    let first = null;
    let start = null;
    let frames = 0;
    const step = (ts) => {
      const t = Number.isFinite(ts) ? ts : clock();
      if (first === null) first = t;
      if (t - first < warmupMs) {
        requestFrame(step);
        return;
      }
      if (start === null) {
        start = t;
        requestFrame(step);
        return;
      }
      frames++;
      const elapsed = t - start;
      if (elapsed >= ms) {
        resolve((frames * 1000) / elapsed);
        return;
      }
      requestFrame(step);
    };
    requestFrame(step);
  });
}

// The start-up speed test with a wall-clock watchdog, so a paused or slow frame source never holds anything up.
// Resolves to {status: "measured", fps}, {status: "skipped", frames} (fewer than minFrames frames by watchdogMs:
// the caller keeps 3D untested) or {status: "hidden"} (the page was hidden: not a slow device, try again later).
export function speedTest({
  ms = 2000,
  warmupMs = 500,
  minFrames = 10,
  watchdogMs = 4000,
  requestFrame = defaultFrame,
  cancelFrame = (id) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : undefined),
  setTimer = (fn, t) => setTimeout(fn, t),
  clearTimer = (id) => clearTimeout(id),
  now = null,
  isHidden = () => false,
  onFrame = null,
} = {}) {
  const clock = now || (() => performance.now());
  return new Promise((resolve) => {
    let done = false;
    let total = 0;
    let counted = 0;
    let first = null;
    let start = null;
    let last = null;
    let frameId = null;
    let timer = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      if (timer !== null) clearTimer(timer);
      if (frameId !== null) cancelFrame(frameId);
      resolve(result);
    };
    const step = (ts) => {
      frameId = null;
      if (done) return;
      if (isHidden()) return finish({ status: "hidden" });
      const t = Number.isFinite(ts) ? ts : clock();
      total++;
      last = t;
      if (onFrame) {
        try {
          onFrame(t);
        } catch {
          // the test only counts frames
        }
      }
      if (first === null) first = t;
      if (t - first >= warmupMs) {
        if (start === null) start = t;
        else {
          counted++;
          if (t - start >= ms && total >= minFrames) return finish({ status: "measured", fps: (counted * 1000) / (t - start) });
        }
      }
      frameId = requestFrame(step);
    };
    timer = setTimer(() => {
      timer = null;
      if (done) return;
      if (isHidden()) return finish({ status: "hidden" });
      if (total < minFrames) return finish({ status: "skipped", frames: total });
      if (start !== null && counted > 0 && last > start) return finish({ status: "measured", fps: (counted * 1000) / (last - start) });
      return finish({ status: "skipped", frames: total });
    }, watchdogMs);
    frameId = requestFrame(step);
  });
}

// Resolves at once when the document is visible, else on the first visibilitychange to visible.
export function whenVisible(doc = globalThis.document) {
  if (!doc || doc.visibilityState !== "hidden") return Promise.resolve();
  return new Promise((resolve) => {
    const on = () => {
      if (doc.visibilityState === "hidden") return;
      doc.removeEventListener("visibilitychange", on);
      resolve();
    };
    doc.addEventListener("visibilitychange", on);
  });
}

// Rolling frame rate for the ?fps=1 readout. Call tick(ts) once per rendered frame.
export class FpsMeter {
  constructor({ windowMs = 1000 } = {}) {
    this.windowMs = windowMs;
    this.times = [];
  }

  tick(ts) {
    this.times.push(ts);
    const cut = ts - this.windowMs;
    let k = 0;
    while (k < this.times.length - 1 && this.times[k] < cut) k++;
    if (k) this.times.splice(0, k);
  }

  // null until two frames sit in the window.
  fps() {
    const n = this.times.length;
    if (n < 2) return null;
    const span = this.times[n - 1] - this.times[0];
    return span > 0 ? ((n - 1) * 1000) / span : null;
  }

  reset() {
    this.times = [];
  }
}
