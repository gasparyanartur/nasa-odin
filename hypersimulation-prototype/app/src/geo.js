// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Local x, y are PROJECTED metres (equirectangular, standard parallel 0): x = (lon - origin.lon) * metres_per_degree.lon.
// True ground metres = projected metres * ground_scale. ground_scale is {x, y}; a bare number n means {x: n, y: 1}, the same as scene3d.

export function groundScale(scene) {
  const g = scene && scene.ground_scale;
  if (typeof g === "number" && Number.isFinite(g) && g > 0) return { x: g, y: 1 };
  if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) return { x: g.x, y: g.y };
  return { x: 1, y: 1 };
}

export function toLocal(lon, lat, scene) {
  return {
    x: (lon - scene.origin.lon) * scene.metres_per_degree.lon,
    y: (lat - scene.origin.lat) * scene.metres_per_degree.lat,
  };
}

export function toLonLat(x, y, scene) {
  return {
    lon: scene.origin.lon + x / scene.metres_per_degree.lon,
    lat: scene.origin.lat + y / scene.metres_per_degree.lat,
  };
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function bearingDeg(a, b) {
  const deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function groundDistance(a, b, scene) {
  const k = groundScale(scene);
  return Math.hypot((b.x - a.x) * k.x, (b.y - a.y) * k.y);
}

export function groundBearingDeg(a, b, scene) {
  const k = groundScale(scene);
  const deg = (Math.atan2((b.x - a.x) * k.x, (b.y - a.y) * k.y) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
