// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

// Grid contract (data contract + amendment A4): slope cell (i, j) centre is x = -half + 0.5 + i,
// y = half - 0.5 - j with half = cells / 2; DEM sample (i, j) is at x = -half + i, y = half - j.

const COST_REF_DEG = 15; // algorithm internal: step cost = distance * (1 + (slope / ref)^2)
const NEIGHBOURS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
// Order in which limits are lifted (cumulatively) to name the one that blocks a leg.
const LIFT_ORDER = ["no_go", "slope_cap", "rover_range", "no_data"];

// Local x, y are projected metres; grid.ground_scale {x, y} converts a projected offset to true ground metres.
function groundScaleOf(grid) {
  const g = grid.ground_scale;
  if (typeof g === "number" && Number.isFinite(g)) return { x: g, y: g };
  if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) return { x: g.x, y: g.y };
  return { x: 1, y: 1 };
}

function bearingDeg(a, b, k) {
  const deg = (Math.atan2((b.x - a.x) * k.x, (b.y - a.y) * k.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a];
    const [xb, yb] = poly[b];
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

function polygonsOf(noGo) {
  return (noGo || []).map((z) => (Array.isArray(z) ? z : z.polygon)).filter((p) => Array.isArray(p) && p.length >= 3);
}

function requireLimits(limits) {
  if (!limits || !Number.isFinite(limits.slope_cap_deg) || !Number.isFinite(limits.rover_range_m)) {
    throw new Error("limits needs slope_cap_deg and rover_range_m");
  }
}

function makeContext(grid) {
  const n = grid.cells;
  const half = n / 2;
  const slopeDegAt = (idx, liftNoData) => {
    const v = grid.slope[idx];
    if (v === grid.nodata) return liftNoData ? 0 : null;
    return v * grid.scale_deg;
  };
  const cellOf = (x, y) => {
    const i = Math.floor(x + half);
    const j = Math.floor(half - y);
    if (i < 0 || j < 0 || i >= n || j >= n) return -1;
    return j * n + i;
  };
  const centre = (idx) => {
    const i = idx % n;
    const j = (idx - i) / n;
    return [-half + 0.5 + i, half - 0.5 - j];
  };
  let heightAt = null;
  if (grid.height) {
    const s = grid.samples;
    const hh = (s - 1) / 2;
    heightAt = (x, y) => {
      const fx = x + hh;
      const fy = hh - y;
      if (fx < 0 || fy < 0 || fx > s - 1 || fy > s - 1) return null;
      const i0 = Math.min(Math.floor(fx), s - 2);
      const j0 = Math.min(Math.floor(fy), s - 2);
      const tx = fx - i0;
      const ty = fy - j0;
      const v00 = grid.height[j0 * s + i0];
      const v10 = grid.height[j0 * s + i0 + 1];
      const v01 = grid.height[(j0 + 1) * s + i0];
      const v11 = grid.height[(j0 + 1) * s + i0 + 1];
      if (v00 === grid.height_nodata || v10 === grid.height_nodata || v01 === grid.height_nodata || v11 === grid.height_nodata) return null;
      const v = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
      return grid.offset_m + v * grid.scale_m;
    };
  }
  const k = groundScaleOf(grid);
  const steps = NEIGHBOURS.map(([di, dj]) => Math.hypot(di * k.x, dj * k.y));
  return { grid, n, half, slopeDegAt, cellOf, centre, heightAt, k, steps, kMin: Math.min(k.x, k.y) };
}

function buildMask(ctx, { cap, polygons, range, base, liftNoData }) {
  const { n, grid } = ctx;
  const mask = new Uint8Array(n * n);
  for (let idx = 0; idx < mask.length; idx++) {
    const v = grid.slope[idx];
    if (v === grid.nodata) {
      if (!liftNoData) mask[idx] = 1;
    } else if (v * grid.scale_deg > cap) {
      mask[idx] = 1;
    }
  }
  for (const poly of polygons) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const i0 = Math.max(0, Math.floor(minX + ctx.half));
    const i1 = Math.min(n - 1, Math.floor(maxX + ctx.half));
    const j0 = Math.max(0, Math.floor(ctx.half - maxY));
    const j1 = Math.min(n - 1, Math.floor(ctx.half - minY));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (pointInPolygon(-ctx.half + 0.5 + i, ctx.half - 0.5 - j, poly)) mask[j * n + i] = 1;
      }
    }
  }
  if (Number.isFinite(range)) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const dx = -ctx.half + 0.5 + i - base.x;
        const dy = ctx.half - 0.5 - j - base.y;
        if (Math.hypot(dx * ctx.k.x, dy * ctx.k.y) > range) mask[j * n + i] = 1;
      }
    }
  }
  return mask;
}

function makeHeap() {
  let keys = new Float64Array(1024);
  let nodes = new Int32Array(1024);
  let size = 0;
  return {
    get size() { return size; },
    push(key, node) {
      if (size === keys.length) {
        const k2 = new Float64Array(size * 2);
        k2.set(keys);
        keys = k2;
        const n2 = new Int32Array(size * 2);
        n2.set(nodes);
        nodes = n2;
      }
      let i = size++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] <= key) break;
        keys[i] = keys[p];
        nodes[i] = nodes[p];
        i = p;
      }
      keys[i] = key;
      nodes[i] = node;
    },
    pop() {
      const top = nodes[0];
      size--;
      if (size > 0) {
        const key = keys[size];
        const node = nodes[size];
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= size) break;
          if (c + 1 < size && keys[c + 1] < keys[c]) c++;
          if (keys[c] >= key) break;
          keys[i] = keys[c];
          nodes[i] = nodes[c];
          i = c;
        }
        keys[i] = key;
        nodes[i] = node;
      }
      return top;
    },
  };
}

// Returns the list of cell indices from start to goal, or null when no path exists.
function search(ctx, mask, liftNoData, start, goal) {
  const { n } = ctx;
  const total = n * n;
  const g = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const gi = goal % n;
  const gj = (goal - gi) / n;
  const h = (idx) => {
    const i = idx % n;
    const dx = Math.abs(i - gi);
    const dy = Math.abs((idx - i) / n - gj);
    return ctx.kMin * (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy));
  };
  const heap = makeHeap();
  g[start] = 0;
  heap.push(h(start), start);
  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === goal) break;
    closed[cur] = 1;
    const ci = cur % n;
    const cj = (cur - ci) / n;
    const curSlope = ctx.slopeDegAt(cur, liftNoData) ?? 0;
    for (let k = 0; k < NEIGHBOURS.length; k++) {
      const [di, dj] = NEIGHBOURS[k];
      const len = ctx.steps[k];
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nb = nj * n + ni;
      if (closed[nb] || mask[nb]) continue;
      if (di !== 0 && dj !== 0 && (mask[cj * n + ni] || mask[nj * n + ci])) continue;
      const mean = (curSlope + (ctx.slopeDegAt(nb, liftNoData) ?? 0)) / 2;
      const ratio = mean / COST_REF_DEG;
      const cost = g[cur] + len * (1 + ratio * ratio);
      if (cost < g[nb]) {
        g[nb] = cost;
        parent[nb] = cur;
        heap.push(cost + h(nb), nb);
      }
    }
  }
  if (!closed[goal] && parent[goal] === -1 && start !== goal) return null;
  const cells = [];
  for (let c = goal; c !== -1; c = parent[c]) {
    cells.push(c);
    if (c === start) break;
  }
  cells.reverse();
  return cells[0] === start ? cells : null;
}

function buildLeg(ctx, from, to, cells) {
  const full = [[from.x, from.y]];
  for (let k = 1; k < cells.length - 1; k++) full.push(ctx.centre(cells[k]));
  full.push([to.x, to.y]);
  let distance = 0;
  let climb = ctx.heightAt ? 0 : null;
  let descent = ctx.heightAt ? 0 : null;
  let prevH = ctx.heightAt ? ctx.heightAt(full[0][0], full[0][1]) : null;
  for (let k = 1; k < full.length; k++) {
    distance += Math.hypot((full[k][0] - full[k - 1][0]) * ctx.k.x, (full[k][1] - full[k - 1][1]) * ctx.k.y);
    if (ctx.heightAt) {
      const hk = ctx.heightAt(full[k][0], full[k][1]);
      if (hk !== null && prevH !== null) {
        if (hk > prevH) climb += hk - prevH;
        else descent += prevH - hk;
      }
      if (hk !== null) prevH = hk;
    }
  }
  let maxSlope = 0;
  for (const c of cells) {
    const s = ctx.slopeDegAt(c, true);
    if (s > maxSlope) maxSlope = s;
  }
  const path = [full[0]];
  for (let k = 1; k < full.length - 1; k++) {
    const dx1 = full[k][0] - full[k - 1][0];
    const dy1 = full[k][1] - full[k - 1][1];
    const dx2 = full[k + 1][0] - full[k][0];
    const dy2 = full[k + 1][1] - full[k][1];
    if (k === 1 || k === full.length - 2 || dx1 !== dx2 || dy1 !== dy2) path.push(full[k]);
  }
  path.push(full[full.length - 1]);
  return {
    from, to, path,
    distance_m: distance, climb_m: climb, descent_m: descent,
    max_slope_deg: maxSlope, bearing_deg: bearingDeg(from, to, ctx.k),
  };
}

function checkPoint(ctx, pt, id, polygons, base, limits) {
  if (Math.hypot((pt.x - base.x) * ctx.k.x, (pt.y - base.y) * ctx.k.y) > limits.rover_range_m) {
    return { limit: "rover_range", station_id: id, detail: `Point ${id} is farther than ${limits.rover_range_m} m from the base.` };
  }
  const idx = ctx.cellOf(pt.x, pt.y);
  if (idx < 0 || ctx.grid.slope[idx] === ctx.grid.nodata) {
    return { limit: "no_data", station_id: id, detail: `Point ${id} lies outside the terrain data or on a no-data cell.` };
  }
  if (polygons.some((p) => pointInPolygon(pt.x, pt.y, p))) {
    return { limit: "no_go", station_id: id, detail: `Point ${id} lies inside a no-go zone.` };
  }
  if (ctx.slopeDegAt(idx, false) > limits.slope_cap_deg) {
    return { limit: "slope_cap", station_id: id, detail: `Point ${id} lies on a cell steeper than ${limits.slope_cap_deg} degrees.` };
  }
  return null;
}

function planLegs(grid, points, noGo, limits, base) {
  requireLimits(limits);
  const ctx = makeContext(grid);
  const polygons = polygonsOf(noGo);
  for (const p of points) {
    const blocking = checkPoint(ctx, p, p.id, polygons, base, limits);
    if (blocking) return { ok: false, blocking };
  }
  const strict = buildMask(ctx, { cap: limits.slope_cap_deg, polygons, range: limits.rover_range_m, base, liftNoData: false });
  const legs = [];
  for (let k = 1; k < points.length; k++) {
    const from = points[k - 1];
    const to = points[k];
    const a = ctx.cellOf(from.x, from.y);
    const b = ctx.cellOf(to.x, to.y);
    const cells = a === b ? [a, b] : search(ctx, strict, false, a, b);
    if (!cells) {
      const lifted = { cap: limits.slope_cap_deg, polygons, range: limits.rover_range_m, base, liftNoData: false };
      let named = null;
      for (const limit of LIFT_ORDER) {
        if (limit === "no_go") lifted.polygons = [];
        if (limit === "slope_cap") lifted.cap = Infinity;
        if (limit === "rover_range") lifted.range = Infinity;
        if (limit === "no_data") lifted.liftNoData = true;
        if (search(ctx, buildMask(ctx, lifted), lifted.liftNoData, a, b)) {
          named = limit;
          break;
        }
      }
      return {
        ok: false,
        blocking: {
          limit: named ?? "slope_cap",
          station_id: to.id,
          detail: named
            ? `No path from ${from.id} to ${to.id}; lifting the ${named} limit (with those before it) opens one.`
            : `No path from ${from.id} to ${to.id}, even with every limit lifted.`,
        },
      };
    }
    legs.push(buildLeg(ctx, from, to, cells.length === 2 && a === b ? [a, b] : cells));
  }
  return { ok: true, legs, total_m: legs.reduce((s, l) => s + l.distance_m, 0) };
}

export function planRoute({ grid, base, stations, noGo, limits }) {
  const b = { id: "base", x: base.x, y: base.y };
  const pts = [b, ...stations.map((s) => ({ id: s.id, x: s.x, y: s.y })), { ...b }];
  return planLegs(grid, pts, noGo, limits, b);
}

export function planReturn({ grid, from, base, noGo, limits }) {
  const b = { id: "base", x: base.x, y: base.y };
  const pts = [{ id: "from", x: from.x, y: from.y }, b];
  return planLegs(grid, pts, noGo, limits, b);
}
