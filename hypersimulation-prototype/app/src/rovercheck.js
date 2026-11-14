// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Compares the terrain slope grid with the tilt the rover measured at each campaign waypoint.

export const SCATTER_NOTE_TAIL = "A terrain slope over 5 m and a rover body tilt are not the same quantity.";

function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// opts.baseline_m only changes the wording of the note (default 5, the slope grid baseline in scene.json).
export function roverCheck(waypoints, terrain, cap_deg, opts = {}) {
  const baseline = Number.isFinite(opts.baseline_m) ? opts.baseline_m : 5;
  const pairs = [];
  let skipped = 0;
  let considered = 0;
  for (const w of waypoints || []) {
    if (!w || w.in_campaign !== true) continue;
    considered++;
    const slope = terrain.slopeAt(w.x, w.y);
    const tilt = w.tilt_deg;
    if (slope === null || slope === undefined || !Number.isFinite(slope) || typeof tilt !== "number" || !Number.isFinite(tilt)) {
      skipped++;
      continue;
    }
    pairs.push({ sol: w.sol, x: w.x, y: w.y, dem_slope_deg: slope, rover_tilt_deg: tilt });
  }
  const n = pairs.length;
  const under = pairs.filter((p) => p.dem_slope_deg <= cap_deg).length;
  const tiltUnder = pairs.filter((p) => p.rover_tilt_deg <= cap_deg).length;
  return {
    n,
    considered,
    skipped,
    cap_deg,
    share_under_cap: n ? under / n : null,
    share_tilt_under_cap: n ? tiltUnder / n : null,
    pairs,
    median_abs_diff_deg: median(pairs.map((p) => Math.abs(p.dem_slope_deg - p.rover_tilt_deg))),
    note: `The terrain slope grid uses a ${baseline} m baseline. ${SCATTER_NOTE_TAIL}`,
  };
}

// Pixel geometry for a scatter of rover tilt (x) against terrain slope (y). Equal axes 0..max_deg, y grows upward.
export function scatterGeometry(pairs, { width = 320, height = 320, pad = 32, max_deg } = {}) {
  let max = max_deg;
  if (!Number.isFinite(max)) {
    max = 0;
    for (const p of pairs) max = Math.max(max, p.dem_slope_deg, p.rover_tilt_deg);
    max = Math.max(5, Math.ceil(max / 5) * 5);
  }
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  const px = (d) => pad + (d / max) * w;
  const py = (d) => height - pad - (d / max) * h;
  const points = pairs.map((p) => ({ cx: px(p.rover_tilt_deg), cy: py(p.dem_slope_deg), sol: p.sol }));
  const step = max <= 10 ? 2 : 5;
  const ticks = [];
  for (let d = 0; d <= max + 1e-9; d += step) ticks.push({ deg: d, px: px(d) });
  return { points, diag: [px(0), py(0), px(max), py(max)], ticks, max_deg: max };
}
