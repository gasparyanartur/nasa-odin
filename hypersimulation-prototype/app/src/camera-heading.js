// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The helmet camera's look direction: a stable target some metres ahead along the route, and a wall-clock ease toward it.
// The route is an A* path on a 1 m grid, so its raw heading changes at almost every vertex; none of this touches
// the numbers on the helmet display, only where the eye looks.
export const LOOK_AHEAD_M = 8;
export const MIN_RUN_M = 1; // inside this distance of the leg end the look point stops moving, so the heading cannot spin
export const TURN_RATE_DEG_S = 150; // cap, real seconds: a 90 degree corner takes about 1 s at any replay speed
export const TURN_TAU_S = 0.15;
export const SETTLED_DEG = 0.1;

const DEG = 180 / Math.PI;

function bearing(a, b) {
  return ((Math.atan2(b[0] - a[0], b[1] - a[1]) * DEG) + 360) % 360;
}

function cumulative(path) {
  const cum = [0];
  for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  return cum;
}

function pointAt(path, cum, d) {
  let k = 1;
  while (k < path.length - 1 && cum[k] < d) k++;
  const seg = cum[k] - cum[k - 1];
  const f = seg === 0 ? 1 : (d - cum[k - 1]) / seg;
  const a = path[k - 1];
  const b = path[k];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// Compass heading (0 north, clockwise) from the point s metres along path to the point `ahead` metres further on,
// clamped at the path end. null for a path with no length. cum is the optional cumulative length per vertex.
export function lookHeading(path, s, { cum = null, ahead = LOOK_AHEAD_M, minRun = MIN_RUN_M } = {}) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const c = cum || cumulative(path);
  const total = c[c.length - 1];
  if (!(total > 0)) return null;
  const s0 = Math.min(Math.max(s, 0), Math.max(0, total - Math.min(minRun, total)));
  const p0 = pointAt(path, c, s0);
  const p1 = pointAt(path, c, Math.min(s0 + ahead, total));
  if (p0[0] === p1[0] && p0[1] === p1[1]) return null;
  return bearing(p0, p1);
}

// Signed shortest turn from a to b in degrees, in [-180, 180).
export function angleDiff(a, b) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

// One easing step of the camera heading toward target, dt in real seconds. Never overshoots, never turns faster
// than maxRate, takes the short way across 0/360.
export function stepHeading(current, target, dt, { maxRate = TURN_RATE_DEG_S, tau = TURN_TAU_S } = {}) {
  if (!Number.isFinite(target)) return current;
  if (!Number.isFinite(current)) return ((target % 360) + 360) % 360;
  const diff = angleDiff(current, target);
  if (!(dt > 0)) return ((current % 360) + 360) % 360;
  if (Math.abs(diff) < SETTLED_DEG) return ((target % 360) + 360) % 360;
  const want = diff * (1 - Math.exp(-dt / tau));
  const cap = maxRate * dt;
  const step = Math.abs(want) > cap ? Math.sign(want) * cap : want;
  return (((current + step) % 360) + 360) % 360;
}
