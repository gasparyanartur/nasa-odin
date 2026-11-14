// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { planRoute, planReturn } from "../src/planner.js";
import { handleMessage } from "../src/planner.worker.js";

const LIMITS = { slope_cap_deg: 15, rover_range_m: 2000 };

// slopeFn(i, j) -> degrees, or null for a no-data cell. heightFn(x, y) -> metres.
function makeGrid(n, slopeFn = () => 0, heightFn = () => 0) {
  const slope = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const s = slopeFn(i, j);
      slope[j * n + i] = s === null ? 255 : Math.round(s / 0.25);
    }
  }
  const samples = n + 1;
  const height = new Uint16Array(samples * samples);
  for (let j = 0; j < samples; j++) {
    for (let i = 0; i < samples; i++) height[j * samples + i] = Math.round((heightFn(-n / 2 + i, n / 2 - j) + 100) / 0.01);
  }
  return { slope, cells: n, scale_deg: 0.25, nodata: 255, height, samples, offset_m: -100, scale_m: 0.01, height_nodata: 65535 };
}

function cellSlope(grid, x, y) {
  const half = grid.cells / 2;
  const i = Math.floor(x + half);
  const j = Math.floor(half - y);
  return grid.slope[j * grid.cells + i] * grid.scale_deg;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a];
    const [xb, yb] = poly[b];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

function* sampled(path, step = 0.25) {
  for (let k = 1; k < path.length; k++) {
    const [x0, y0] = path[k - 1];
    const [x1, y1] = path[k];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s <= m; s++) yield [x0 + ((x1 - x0) * s) / m, y0 + ((y1 - y0) * s) / m];
  }
}

// 40 x 40 grid, steep wall on column 20 (x from 0 to 1), gap rows given as [from, to].
const wall = (gap) => (i, j) => (i === 20 && !(gap && j >= gap[0] && j <= gap[1]) ? 20 : 0);
const base = { x: -15.5, y: 0.5 };
const station = { id: 1, x: 15.5, y: 0.5 };

test("a wall of 20 degree cells with one gap: the path goes through the gap", () => {
  const grid = makeGrid(40, wall([8, 10]));
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.equal(r.ok, true);
  assert.equal(r.legs.length, 2);
  const crossing = [];
  for (const leg of r.legs) {
    for (const [x, y] of sampled(leg.path)) {
      assert.ok(cellSlope(grid, x, y) <= 15, "no path point on a cell above the cap");
      if (x >= 0 && x <= 1) crossing.push(y);
    }
  }
  assert.ok(crossing.length > 0);
  for (const y of crossing) assert.ok(y >= 9 && y <= 12, `crossed the wall at y=${y}`);
  assert.ok(r.total_m > 31, "detour is longer than the straight line");
});

test("route ends at base and legs link up", () => {
  const grid = makeGrid(40);
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.equal(r.ok, true);
  const last = r.legs[r.legs.length - 1];
  assert.deepEqual(last.path[last.path.length - 1], [base.x, base.y]);
  assert.equal(last.to.id, "base");
  assert.equal(r.legs[0].to.id, 1);
  assert.ok(Math.abs(r.legs[0].distance_m - 31) < 1e-9);
  assert.ok(Math.abs(r.legs[0].bearing_deg - 90) < 1e-9);
  assert.ok(Math.abs(r.legs[1].bearing_deg - 270) < 1e-9);
  assert.ok(Math.abs(r.total_m - 62) < 1e-9);
});

test("a closed wall: no route, limit slope_cap, station named", () => {
  const grid = makeGrid(40, wall(null));
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "slope_cap");
  assert.equal(r.blocking.station_id, 1);
});

test("a no-go polygon over the only gap: limit no_go", () => {
  const grid = makeGrid(40, wall([8, 10]));
  const zone = { id: "z", polygon: [[-1, 8], [2, 8], [2, 13], [-1, 13]] };
  const r = planRoute({ grid, base, stations: [station], noGo: [zone], limits: LIMITS });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "no_go");
  assert.equal(r.blocking.station_id, 1);
});

test("no path cell lies in a no-go polygon", () => {
  const grid = makeGrid(40);
  const poly = [[-5, -6], [5, -6], [5, 6], [-5, 6]];
  const r = planRoute({ grid, base, stations: [station], noGo: [{ polygon: poly }], limits: LIMITS });
  assert.equal(r.ok, true);
  for (const leg of r.legs) for (const [x, y] of sampled(leg.path)) assert.ok(!pointInPoly(x, y, poly), `(${x}, ${y}) is in the zone`);
});

test("a station 2,100 m from base: rover_range", () => {
  const grid = makeGrid(40);
  const r = planRoute({ grid, base: { x: 0.5, y: 0.5 }, stations: [{ id: 7, x: 2100.5, y: 0.5 }], noGo: [], limits: LIMITS });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "rover_range");
  assert.equal(r.blocking.station_id, 7);
});

test("a station beyond a small range inside the grid: rover_range", () => {
  const grid = makeGrid(40);
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: { ...LIMITS, rover_range_m: 20 } });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "rover_range");
});

test("a station on a no-data cell, and one outside the grid: no_data", () => {
  const grid = makeGrid(40, (i, j) => (i === 35 && j === 19 ? null : 0));
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "no_data");
  assert.equal(r.blocking.station_id, 1);
  const out = planRoute({ grid: makeGrid(40), base, stations: [{ id: 2, x: 400, y: 0 }], noGo: [], limits: LIMITS });
  assert.equal(out.blocking.limit, "no_data");
  assert.equal(out.blocking.station_id, 2);
});

test("a station inside a no-go polygon: no_go with that station id", () => {
  const grid = makeGrid(40);
  const zone = { polygon: [[14, -2], [17, -2], [17, 3], [14, 3]] };
  const r = planRoute({ grid, base, stations: [station], noGo: [zone], limits: LIMITS });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "no_go");
  assert.equal(r.blocking.station_id, 1);
});

test("a station on a cell above the slope cap: slope_cap, not snapped", () => {
  const grid = makeGrid(40, (i, j) => (i === 35 && j === 19 ? 20 : 0));
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "slope_cap");
  assert.equal(r.blocking.station_id, 1);
});

test("a route that must leave the rover range is named rover_range", () => {
  // No-data wall on column 20 with its only gap on row 0 (y = 19.5), about 20 m from the base.
  const grid = makeGrid(40, (i, j) => (i === 20 && j > 0 ? null : 0));
  const near = { x: -5.5, y: 0.5 };
  const far = { id: 1, x: 5.5, y: 0.5 };
  const open = planRoute({ grid, base: near, stations: [far], noGo: [], limits: { ...LIMITS, rover_range_m: 60 } });
  assert.equal(open.ok, true);
  const r = planRoute({ grid, base: near, stations: [far], noGo: [], limits: { ...LIMITS, rover_range_m: 15 } });
  assert.equal(r.ok, false);
  assert.equal(r.blocking.limit, "rover_range");
  assert.equal(r.blocking.station_id, 1);
});

test("climb and descent come from the DEM along the path", () => {
  const grid = makeGrid(40, () => 0, (x) => 0.5 * x);
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.legs[0].climb_m - 15.5) < 0.1, `climb ${r.legs[0].climb_m}`);
  assert.ok(Math.abs(r.legs[0].descent_m) < 0.1);
  assert.ok(Math.abs(r.legs[1].descent_m - 15.5) < 0.1);
});

test("max_slope_deg is the steepest cell crossed", () => {
  const grid = makeGrid(40, (i, j) => (i === 20 && j === 19 ? 12 : 0));
  const r = planRoute({ grid, base, stations: [station], noGo: [], limits: LIMITS });
  assert.ok(r.legs[0].max_slope_deg <= 15);
  assert.ok(r.legs[0].max_slope_deg >= 0);
});

test("planReturn gives one leg from the current position to base", () => {
  const grid = makeGrid(40, wall([8, 10]));
  const r = planReturn({ grid, from: { x: 10.5, y: 0.5 }, base, noGo: [], limits: LIMITS });
  assert.equal(r.ok, true);
  assert.equal(r.legs.length, 1);
  assert.deepEqual(r.legs[0].path[0], [10.5, 0.5]);
  assert.deepEqual(r.legs[0].path[r.legs[0].path.length - 1], [base.x, base.y]);
  const closed = planReturn({ grid: makeGrid(40, wall(null)), from: { x: 10.5, y: 0.5 }, base, noGo: [], limits: LIMITS });
  assert.equal(closed.ok, false);
  assert.equal(closed.blocking.limit, "slope_cap");
});

test("missing limits throw instead of planning without a cap", () => {
  assert.throws(() => planRoute({ grid: makeGrid(40), base, stations: [station], noGo: [], limits: {} }));
});

test("worker message handler answers with the id and the result", () => {
  const grid = makeGrid(40);
  const plan = handleMessage({ type: "plan", id: 5, payload: { grid, base, stations: [station], noGo: [], limits: LIMITS } });
  assert.equal(plan.id, 5);
  assert.equal(plan.result.ok, true);
  const ret = handleMessage({ type: "return", id: 6, payload: { grid, from: { x: 10.5, y: 0.5 }, base, noGo: [], limits: LIMITS } });
  assert.equal(ret.id, 6);
  assert.equal(ret.result.ok, true);
  assert.ok(handleMessage({ type: "nope", id: 7, payload: {} }).error);
  assert.ok(handleMessage({ type: "plan", id: 8, payload: { grid, base, stations: [], noGo: [], limits: {} } }).error);
});

test("ground_scale: leg distance, total, bearing and rover range use ground metres", () => {
  const flat = makeGrid(40);
  const scaled = { ...makeGrid(40), ground_scale: { x: 0.5, y: 1 } };
  const b = { x: -15.5, y: 0.5 };
  const st = { id: 1, x: 15.5, y: 0.5 };
  const plain = planRoute({ grid: flat, base: b, stations: [st], noGo: [], limits: LIMITS });
  const half = planRoute({ grid: scaled, base: b, stations: [st], noGo: [], limits: LIMITS });
  assert.equal(plain.ok && half.ok, true);
  assert.ok(Math.abs(plain.legs[0].distance_m - 31) < 1e-9);
  assert.ok(Math.abs(half.legs[0].distance_m - 15.5) < 1e-9);
  assert.ok(Math.abs(half.total_m - 31) < 1e-9);
  assert.equal(half.legs[0].bearing_deg, 90);
  const diag = planRoute({ grid: scaled, base: { x: 0.5, y: 0.5 }, stations: [{ id: 1, x: 10.5, y: 10.5 }], noGo: [], limits: LIMITS });
  assert.ok(Math.abs(diag.legs[0].bearing_deg - (Math.atan2(5, 10) * 180) / Math.PI) < 1e-9);
  const far = { grid: { ...makeGrid(40), ground_scale: { x: 1, y: 1 } }, base: b, stations: [st], noGo: [], limits: { slope_cap_deg: 15, rover_range_m: 20 } };
  assert.equal(planRoute(far).ok, false);
  assert.equal(planRoute({ ...far, grid: scaled }).ok, true);
});

test("ground_scale defaults to {x: 1, y: 1} and a bare number scales both axes", () => {
  const b = { x: -15.5, y: 0.5 };
  const st = { id: 1, x: 15.5, y: 0.5 };
  const num = planRoute({ grid: { ...makeGrid(40), ground_scale: 2 }, base: b, stations: [st], noGo: [], limits: { slope_cap_deg: 15, rover_range_m: 100 } });
  assert.ok(Math.abs(num.legs[0].distance_m - 62) < 1e-9);
});

test("performance: 1,024 x 1,024 grid, worst case per leg under 2 s", () => {
  const n = 1024;
  const timings = [];
  const run = (name, slopeFn, from, to) => {
    const grid = makeGrid(n, slopeFn, () => 0);
    const t0 = performance.now();
    const r = planRoute({ grid, base: from, stations: [{ id: 1, ...to }], noGo: [], limits: LIMITS });
    const ms = (performance.now() - t0) / 2; // two legs, there and back
    timings.push(`${name}: ${ms.toFixed(0)} ms per leg`);
    return { r, ms };
  };
  // Open ground, corner to corner.
  const open = run("open", () => 0, { x: -500.5, y: 500.5 }, { x: 500.5, y: -500.5 });
  // Steep rolling ground: every cell costly, forces wide exploration.
  const rough = run("rough", (i, j) => ((i >> 4) + (j >> 4)) % 2 === 0 ? 14 : 3, { x: -500.5, y: 500.5 }, { x: 500.5, y: -500.5 });
  // A wall across the whole grid with a gap at the far end: the search floods half the grid.
  const maze = run("wall", (i, j) => (i === 512 && j < 1000 ? 20 : 0), { x: -400.5, y: 0.5 }, { x: 400.5, y: 0.5 });
  console.log(timings.join("; "));
  for (const { r, ms } of [open, rough, maze]) {
    assert.equal(r.ok, true);
    assert.ok(ms < 2000, `leg took ${ms.toFixed(0)} ms`);
  }
});
