// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Raster builders for the height tint and the slope classes. No DOM; every result feeds scene3d.setRasterLayer.

// 10 degrees is a design choice for the "caution" band; the 15 degree cap comes from the limits.
export const CAUTION_SLOPE_DEG = 10;
export const CAP_SLOPE_DEG = 15;

// Single hue, neutral blue-grey, light to dark.
export const DEFAULT_RAMP = ["#e6eaee", "#ccd4dc", "#b1bdc9", "#96a5b5", "#7a8da1", "#5f7389", "#455a70"];

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

// Mean of the valid corners of cell (i, j); null when none is valid (A4: area means skip no-data).
function cellHeight(core, n, nodata, offset, scale, i, j) {
  let sum = 0;
  let k = 0;
  for (const idx of [j * n + i, j * n + i + 1, (j + 1) * n + i, (j + 1) * n + i + 1]) {
    if (core[idx] !== nodata) {
      sum += core[idx];
      k++;
    }
  }
  return k ? offset + (sum / k) * scale : null;
}

export function heightTint(core, { offset_m, scale_m, nodata }, { step_m = 5, ramp = DEFAULT_RAMP, alpha = 150 } = {}) {
  const n = Math.round(Math.sqrt(core.length));
  const w = n - 1;
  const h = new Float64Array(w * w);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const v = cellHeight(core, n, nodata, offset_m, scale_m, i, j);
      h[j * w + i] = v === null ? NaN : v;
      if (v !== null) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  const rgba = new Uint8ClampedArray(w * w * 4);
  if (!Number.isFinite(min)) return { rgba, width: w, height: w, legend: [], min_m: null, max_m: null, step_m };
  const rgb = ramp.map(hex);
  const bins = ramp.length;
  const span = max - min || 1;
  const binOf = (v) => Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
  const band = (v) => Math.floor(v / step_m);
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const v = h[j * w + i];
      if (Number.isNaN(v)) continue;
      const east = i + 1 < w ? h[j * w + i + 1] : NaN;
      const south = j + 1 < w ? h[(j + 1) * w + i] : NaN;
      const contour = (!Number.isNaN(east) && band(east) !== band(v)) || (!Number.isNaN(south) && band(south) !== band(v));
      const c = rgb[binOf(v)];
      const o = (j * w + i) * 4;
      if (contour) {
        rgba[o] = c[0] * 0.45;
        rgba[o + 1] = c[1] * 0.45;
        rgba[o + 2] = c[2] * 0.45;
        rgba[o + 3] = 235;
      } else {
        rgba[o] = c[0];
        rgba[o + 1] = c[1];
        rgba[o + 2] = c[2];
        rgba[o + 3] = alpha;
      }
    }
  }
  const legend = ramp.map((color, k) => ({ from_m: min + (span * k) / bins, to_m: min + (span * (k + 1)) / bins, color }));
  return { rgba, width: w, height: w, legend, min_m: min, max_m: max, step_m };
}

export function slopeClasses(slope, { scale_deg, nodata }, { caution_deg = CAUTION_SLOPE_DEG, cap_deg = CAP_SLOPE_DEG } = {}) {
  const w = Math.round(Math.sqrt(slope.length));
  const rgba = new Uint8ClampedArray(w * w * 4);
  const hatch = new Uint8Array(w * w);
  let ok = 0;
  let caution = 0;
  let blocked = 0;
  for (let k = 0; k < slope.length; k++) {
    if (slope[k] === nodata) continue;
    const deg = slope[k] * scale_deg;
    const o = k * 4;
    if (deg > cap_deg) {
      blocked++;
      hatch[k] = 200;
      rgba[o] = 195; rgba[o + 1] = 52; rgba[o + 2] = 26; rgba[o + 3] = 60;
    } else if (deg >= caution_deg) {
      caution++;
      hatch[k] = 64;
      rgba[o] = 227; rgba[o + 1] = 154; rgba[o + 2] = 18; rgba[o + 3] = 45;
    } else {
      ok++;
    }
  }
  const total = ok + caution + blocked;
  const shares = total ? { ok: ok / total, caution: caution / total, blocked: blocked / total } : { ok: 0, caution: 0, blocked: 0 };
  const legend = [
    { id: "ok", label: "Under caution", from_deg: 0, to_deg: caution_deg, pattern: null },
    { id: "caution", label: "Caution", from_deg: caution_deg, to_deg: cap_deg, pattern: "hatch-caution" },
    { id: "blocked", label: "Blocked", from_deg: cap_deg, to_deg: null, pattern: "hatch-blocked" },
  ];
  return { rgba, width: w, height: w, hatch, legend, shares };
}
