// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Height profile along a planned route. Distances are ground metres.
import { groundDistance } from "./geo.js";

// opts.scene supplies ground_scale. Null heights stay null (no interpolation across no-data).
export function routeProfile(route, terrain, { sample_m = 2, scene = null } = {}) {
  const points = [];
  const stations = [];
  let d0 = 0;
  const legs = (route && route.legs) || [];
  legs.forEach((leg, leg_index) => {
    const path = leg.path;
    const at = (x, y, d) => ({ d_m: d, h_m: terrain.heightAt(x, y), leg_index });
    if (leg_index === 0) {
      const h = terrain.heightAt(path[0][0], path[0][1]);
      stations.push({ id: leg.from && leg.from.id, d_m: 0, h_m: h });
    }
    let d = d0;
    for (let k = 1; k < path.length; k++) {
      const [x0, y0] = path[k - 1];
      const [x1, y1] = path[k];
      const len = groundDistance({ x: x0, y: y0 }, { x: x1, y: y1 }, scene);
      const steps = Math.max(1, Math.ceil(len / sample_m));
      const first = k === 1 ? 0 : 1;
      for (let s = first; s <= steps; s++) {
        const t = s / steps;
        points.push(at(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, d + len * t));
      }
      d += len;
    }
    const end = path[path.length - 1];
    stations.push({ id: leg.to && leg.to.id, d_m: d, h_m: terrain.heightAt(end[0], end[1]) });
    d0 = d;
  });
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.h_m === null) continue;
    if (p.h_m < min) min = p.h_m;
    if (p.h_m > max) max = p.h_m;
  }
  return {
    points,
    stations,
    min_m: Number.isFinite(min) ? min : null,
    max_m: Number.isFinite(max) ? max : null,
    total_m: d0,
  };
}

// SVG path "d" for the profile; null heights split it into separate subpaths.
export function profilePath(profile, { width = 320, height = 120, pad = 8 } = {}) {
  const total = profile.total_m || 1;
  const x = (d) => pad + (d / total) * (width - 2 * pad);
  const range = profile.max_m !== null ? profile.max_m - profile.min_m : 0;
  const y = (h) => (range > 0 ? height - pad - ((h - profile.min_m) / range) * (height - 2 * pad) : height / 2);
  const f = (v) => Math.round(v * 100) / 100;
  let d = "";
  let open = false;
  for (const p of profile.points) {
    if (p.h_m === null) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${f(x(p.d_m))} ${f(y(p.h_m))}`;
    open = true;
  }
  return { d, stations: profile.stations.map((s) => ({ id: s.id, x: f(x(s.d_m)) })), y_of: y, x_of: x };
}
