import type { Point, Pose } from './data';

/**
 * Route preview: the helmet camera runs along a route by itself. It moves the camera only; the walk state (position,
 * elapsed suit time, walked-path log, stop arrivals, saved traverses) never sees a preview position.
 */
export const PREVIEW_SECONDS = 90;
export const PREVIEW_SPEEDS = [1, 2, 4] as const;
export type PreviewSpeed = typeof PREVIEW_SPEEDS[number];
const LOOK_AHEAD_M = 12;
/** Longest frame gap that counts; a slow frame rate must not stretch the preview, a hidden tab must not jump it. */
const MAX_FRAME_S = 0.5;

export interface PreviewPath { points: Point[]; cum: number[]; totalM: number }

/** A walkable polyline with its running distance, or undefined when it is shorter than a metre. */
export function previewPath(input: Point[]): PreviewPath | undefined {
  const points: Point[] = [];
  for (const p of input) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const last = points.at(-1);
    if (!last || last.x !== p.x || last.y !== p.y) points.push({ x: p.x, y: p.y });
  }
  if (points.length < 2) return undefined;
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const totalM = cum[cum.length - 1];
  return totalM >= 1 ? { points, cum, totalM } : undefined;
}

export function pointAt(path: PreviewPath, distanceM: number): Point {
  const d = Math.max(0, Math.min(path.totalM, distanceM));
  let lo = 0, hi = path.cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.cum[mid] <= d) lo = mid; else hi = mid; }
  const a = path.points[lo], b = path.points[hi], span = path.cum[hi] - path.cum[lo];
  const t = span > 0 ? (d - path.cum[lo]) / span : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Heading in the walk convention (atan2 of east over north), towards a point a few metres further on. */
export function headingAt(path: PreviewPath, distanceM: number): number {
  const d = Math.max(0, Math.min(path.totalM, distanceM));
  const from = d + LOOK_AHEAD_M > path.totalM ? Math.max(0, path.totalM - LOOK_AHEAD_M) : d;
  const a = pointAt(path, from), b = pointAt(path, Math.min(path.totalM, from + LOOK_AHEAD_M));
  return Math.atan2(b.x - a.x, b.y - a.y);
}

/** Turns from one heading towards another by the shortest way; share 0 keeps it, 1 reaches it. */
export function turnTowards(from: number, to: number, share: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * Math.max(0, Math.min(1, share));
}

/** Metres per real second at 1x, so a whole route takes about PREVIEW_SECONDS. */
export const previewPace = (totalM: number) => totalM / PREVIEW_SECONDS;

/** The next distance after dtS real seconds; dt is capped so a hidden tab does not jump the camera to the end. */
export function advancePreview(doneM: number, totalM: number, dtS: number, speed: number): number {
  const dt = Math.max(0, Math.min(MAX_FRAME_S, dtS));
  return Math.min(totalM, doneM + dt * previewPace(totalM) * speed);
}

/** The preview camera pose; elapsed and pitch stay those of the walk, which the preview never changes. */
export function previewPose(path: PreviewPath, distanceM: number, walk: Pose): Pose {
  return { ...walk, ...pointAt(path, distanceM), heading: headingAt(path, distanceM) };
}

export interface PreviewState { name: string; path: PreviewPath; phase: 'playing' | 'paused' | 'ended'; speed: PreviewSpeed; doneM: number }
export type PreviewAction =
  | { type: 'toggle' }
  | { type: 'speed'; speed: PreviewSpeed }
  | { type: 'progress'; doneM: number };

export function startPreview(name: string, points: Point[]): PreviewState | undefined {
  const path = previewPath(points);
  return path ? { name, path, phase: 'playing', speed: 1, doneM: 0 } : undefined;
}

export function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (state.phase === 'ended') return state;
  switch (action.type) {
    case 'toggle': return { ...state, phase: state.phase === 'playing' ? 'paused' : 'playing' };
    case 'speed': return PREVIEW_SPEEDS.includes(action.speed) ? { ...state, speed: action.speed } : state;
    case 'progress': {
      const doneM = Math.max(state.doneM, Math.min(state.path.totalM, action.doneM));
      return { ...state, doneM, phase: doneM >= state.path.totalM ? 'ended' : state.phase };
    }
  }
}

/**
 * What a route action acts on. With Load previous path open and a path shown, both Preview route and Walk this route
 * use that path; otherwise the selected planned route, else the prepared science walk.
 */
export function routeSubject(workflow: 'new' | 'saved', shownPath: unknown, route: unknown, prepared: unknown): 'previous' | 'route' | 'prepared' | 'none' {
  if (workflow === 'saved' && shownPath) return 'previous';
  if (route) return 'route';
  return prepared ? 'prepared' : 'none';
}

/** Walking is live only in the helmet view, with no pause menu and no preview; every walk record keys off this. */
export function liveWalk(view: 'globe' | 'plan' | 'walk', pauseMenu: boolean, preview: PreviewState | undefined): boolean {
  return view === 'walk' && !pauseMenu && !preview;
}

const metres = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
export const previewProgressText = (doneM: number, totalM: number) => `${metres(doneM)} of ${metres(totalM)}`;
