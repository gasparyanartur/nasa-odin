// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { measureFps, FpsMeter, speedTest, whenVisible } from "../src/perf.js";

// Fake frame source: frame k arrives at times[k] ms (or at k * dt).
function frames(timeAt) {
  let k = 0;
  return (cb) => queueMicrotask(() => cb(timeAt(k++)));
}

test("measureFps reports the frame rate after the warm-up", async () => {
  const fps = await measureFps(1000, { requestFrame: frames((k) => k * (1000 / 60)) });
  assert.ok(Math.abs(fps - 60) < 0.5, `got ${fps}`);
});

test("measureFps ignores slow frames inside the warm-up", async () => {
  // 100 ms frames for the first 500 ms, then 20 ms frames
  const t = (k) => (k <= 5 ? k * 100 : 500 + (k - 5) * 20);
  const fps = await measureFps(1000, { warmupMs: 500, requestFrame: frames(t) });
  assert.ok(Math.abs(fps - 50) < 0.5, `got ${fps}`);
});

test("measureFps uses the clock when the frame source gives no timestamp", async () => {
  let clock = 0;
  const requestFrame = (cb) => queueMicrotask(() => {
    clock += 40;
    cb(undefined);
  });
  const fps = await measureFps(400, { warmupMs: 0, requestFrame, now: () => clock });
  assert.ok(Math.abs(fps - 25) < 0.5, `got ${fps}`);
});

test("measureFps rejects a missing or non-positive duration", async () => {
  await assert.rejects(measureFps(0, { requestFrame: frames((k) => k) }));
  await assert.rejects(measureFps(undefined, { requestFrame: frames((k) => k) }));
});

test("FpsMeter: null before two frames, rolling rate over the window", () => {
  const m = new FpsMeter({ windowMs: 1000 });
  assert.equal(m.fps(), null);
  m.tick(0);
  assert.equal(m.fps(), null);
  for (let k = 1; k <= 120; k++) m.tick(k * 25);
  assert.ok(Math.abs(m.fps() - 40) < 0.01);
  m.reset();
  assert.equal(m.fps(), null);
});

// A hand-driven world: a wall clock with timers and a frame source that fires only when told to.
function world() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const frameQ = new Map();
  return {
    now: () => now,
    setTimer(fn, t) {
      timers.set(++id, { fn, at: now + t });
      return id;
    },
    clearTimer(i) {
      timers.delete(i);
    },
    requestFrame(fn) {
      frameQ.set(++id, fn);
      return id;
    },
    cancelFrame(i) {
      frameQ.delete(i);
    },
    // Moves the wall clock; with frameMs set, one frame fires every frameMs on the way.
    run(ms, frameMs = null) {
      const end = now + ms;
      while (now < end) {
        const step = frameMs ? Math.min(frameMs, end - now) : end - now;
        now += step;
        if (frameMs) {
          const fns = [...frameQ.values()];
          frameQ.clear();
          for (const fn of fns) fn(now);
        }
        for (const [k, t] of [...timers]) if (t.at <= now) {
          timers.delete(k);
          t.fn();
        }
      }
    },
    get frames() {
      return frameQ.size;
    },
  };
}

test("speedTest measures the frame rate when frames arrive", async () => {
  const w = world();
  const p = speedTest({ ms: 2000, warmupMs: 500, requestFrame: w.requestFrame, cancelFrame: w.cancelFrame, setTimer: w.setTimer, clearTimer: w.clearTimer, now: w.now });
  w.run(3000, 1000 / 60);
  const r = await p;
  assert.equal(r.status, "measured");
  assert.ok(Math.abs(r.fps - 60) < 1, `got ${r.fps}`);
});

test("speedTest: a frame source that never fires is skipped by the wall-clock watchdog", async () => {
  const w = world();
  const p = speedTest({ watchdogMs: 4000, requestFrame: w.requestFrame, cancelFrame: w.cancelFrame, setTimer: w.setTimer, clearTimer: w.clearTimer, now: w.now });
  w.run(4000);
  const r = await p;
  assert.deepEqual(r, { status: "skipped", frames: 0 });
  assert.equal(w.frames, 0, "the pending frame request is cancelled");
});

test("speedTest: fewer than ten frames in four seconds is skipped, not slow", async () => {
  const w = world();
  const p = speedTest({ requestFrame: w.requestFrame, cancelFrame: w.cancelFrame, setTimer: w.setTimer, clearTimer: w.clearTimer, now: w.now });
  w.run(4000, 500);
  const r = await p;
  assert.equal(r.status, "skipped");
  assert.ok(r.frames < 10);
});

test("speedTest: a hidden page ends the test as hidden, never as slow", async () => {
  const w = world();
  let hidden = false;
  const p = speedTest({ requestFrame: w.requestFrame, cancelFrame: w.cancelFrame, setTimer: w.setTimer, clearTimer: w.clearTimer, now: w.now, isHidden: () => hidden });
  w.run(300, 16);
  hidden = true;
  w.run(100, 16);
  assert.deepEqual(await p, { status: "hidden" });
});

test("whenVisible waits for visibilitychange while the page is hidden", async () => {
  const fns = new Set();
  const doc = { visibilityState: "hidden", addEventListener: (_, fn) => fns.add(fn), removeEventListener: (_, fn) => fns.delete(fn) };
  let seen = false;
  const p = whenVisible(doc).then(() => (seen = true));
  await new Promise((r) => setImmediate(r));
  assert.equal(seen, false);
  doc.visibilityState = "visible";
  for (const fn of [...fns]) fn();
  await p;
  assert.equal(seen, true);
  assert.equal(fns.size, 0);
  await whenVisible({ visibilityState: "visible" });
});
