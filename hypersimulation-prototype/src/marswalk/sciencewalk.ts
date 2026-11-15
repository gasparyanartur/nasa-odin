import type { Alternative, ConditionEvaluation, Exclusion, Point, Route, RouteDiagnostics, Settings, TerrainData } from '../mission/data';
import { HAZARD_ZONES, MAX_EXCLUSIONS, plannerExclusions, toRestrictions, type ZoneRestriction } from './hazards';
import { STOPS, type ScienceStop } from './stops';

/** The stops in walking order: Stop 1 to Stop 8, then back to the habitat. */
export const WALK_STOPS: ScienceStop[] = [...STOPS].sort((a, b) => a.id - b.id);

// Mirrors server/planner.py: cell rounding, `permitted` (bilinear right/down footprint) and the exclusion cell margin.
export function cellOf(data: Pick<TerrainData, 'meta'>, p: Point): { row: number; col: number } | null {
  const { size, stepM } = data.meta, half = (size - 1) * stepM / 2;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > half || Math.abs(p.y) > half) return null;
  return { row: Math.round((half - p.y) / stepM), col: Math.round((p.x + half) / stepM) };
}

export function cellPoint(data: Pick<TerrainData, 'meta'>, row: number, col: number): Point {
  const { size, stepM } = data.meta, half = (size - 1) * stepM / 2;
  return { x: col * stepM - half, y: half - row * stepM };
}

export function permittedMask(data: Pick<TerrainData, 'meta' | 'heights' | 'slopes' | 'valid'>, slopeLimit: number, exclusions: Exclusion[]): Uint8Array {
  const n = data.meta.size, step = data.meta.stepM, base = new Uint8Array(n * n), mask = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) base[i] = data.valid[i] && Number.isFinite(data.heights[i]) && Number.isFinite(data.slopes[i]) && data.slopes[i] <= slopeLimit ? 1 : 0;
  const right = (r: number, c: number) => base[r * n + Math.min(n - 1, c + 1)];
  const row1 = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) row1[r * n + c] = base[r * n + c] & right(r, c);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) mask[r * n + c] = row1[r * n + c] & row1[Math.min(n - 1, r + 1) * n + c];
  if (exclusions.length) {
    const margin = step / Math.SQRT2;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!mask[r * n + c]) continue;
      const p = cellPoint(data, r, c);
      if (exclusions.some(e => (p.x - e.x) ** 2 + (p.y - e.y) ** 2 <= (e.radius + margin) ** 2)) mask[r * n + c] = 0;
    }
  }
  return mask;
}

/** Cells joined to `start` through permitted cells (four neighbours, as the planner's connectivity check). */
export function reachable(mask: Uint8Array, n: number, start: number): Uint8Array {
  const seen = new Uint8Array(n * n);
  if (!mask[start]) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!, r = Math.floor(i / n), c = i % n;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
      const j = nr * n + nc;
      if (mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  return seen;
}

/** The team app counts "Destination reached" within 8 m (App.tsx); a stop uses the same radius. */
export const ARRIVAL_M = 8;

export interface Approach { stop: ScienceStop; point: Point; gapM: number; planned: boolean }

/**
 * The planner refuses an endpoint whose walking footprint is steeper than the slope limit, and several stops sit on
 * ridge walls. A leg may therefore end on the nearest planning cell within ARRIVAL_M of the stop that the planner
 * accepts, preferring cells joined to the habitat. Without such a cell the leg goes to the stop itself
 * (`planned: false`) and the planner states why it refuses.
 */
export function approachPoints(data: Pick<TerrainData, 'meta' | 'heights' | 'slopes' | 'valid'>, habitat: Point, slopeLimit: number, exclusions: Exclusion[], stops: ScienceStop[] = WALK_STOPS): Approach[] {
  const n = data.meta.size, step = data.meta.stepM, mask = permittedMask(data, slopeLimit, exclusions), home = cellOf(data, habitat);
  const joined = home && mask[home.row * n + home.col] ? reachable(mask, n, home.row * n + home.col) : null;
  const reach = Math.ceil(ARRIVAL_M / step) + 1;
  return stops.map(stop => {
    const c = cellOf(data, stop);
    let best: { p: Point; d: number; joined: boolean } | null = null;
    if (c) for (let r = Math.max(0, c.row - reach); r <= Math.min(n - 1, c.row + reach); r++) for (let k = Math.max(0, c.col - reach); k <= Math.min(n - 1, c.col + reach); k++) {
      const i = r * n + k;
      if (!mask[i]) continue;
      const p = cellPoint(data, r, k), d = Math.hypot(p.x - stop.x, p.y - stop.y), j = !joined || !!joined[i];
      if (d > ARRIVAL_M) continue;
      if (!best || (j && !best.joined) || (j === best.joined && d < best.d)) best = { p, d, joined: j };
    }
    return best ? { stop, point: best.p, gapM: best.d, planned: true } : { stop, point: { x: stop.x, y: stop.y }, gapM: 0, planned: false };
  });
}

export interface Leg { from: string; to: string; start: Point; goal: Point }

export function legsFor(habitat: Point, approaches: Approach[]): Leg[] {
  const stops = approaches.map(a => ({ label: `Stop ${a.stop.id}`, point: a.point }));
  const chain = [{ label: 'Habitat', point: habitat }, ...stops, { label: 'Habitat', point: habitat }];
  return chain.slice(1).map((to, i) => ({ from: chain[i].label, to: to.label, start: chain[i].point, goal: to.point }));
}

export interface LegResult { route: Route | null; warnings: string[]; conditions?: ConditionEvaluation }

const EMPTY_METRICS = { distanceM: 0, durationS: 0, ascentM: 0, descentM: 0, maxSlopeDeg: 0, doseMicroGy: 0, terrainCost: 0 };

/** One route drawn from the legs the planner returned; nothing is added between them. */
export function combineLegs(legs: LegResult[]): Alternative {
  const points: Route['points'] = [], geographic: Route['geographic'] = [];
  const metrics = { ...EMPTY_METRICS };
  for (const leg of legs) {
    const r = leg.route;
    if (!r) continue;
    r.points.forEach((p, i) => { const last = points.at(-1); if (i === 0 && last && last[0] === p[0] && last[1] === p[1]) return; points.push(p); geographic.push(r.geographic[i]); });
    metrics.distanceM += r.metrics.distanceM; metrics.durationS += r.metrics.durationS; metrics.ascentM += r.metrics.ascentM;
    metrics.descentM += r.metrics.descentM; metrics.doseMicroGy += r.metrics.doseMicroGy; metrics.terrainCost += r.metrics.terrainCost;
    metrics.maxSlopeDeg = Math.max(metrics.maxSlopeDeg, r.metrics.maxSlopeDeg);
  }
  const last = legs.at(-1);
  const conditions: ConditionEvaluation = last?.conditions ?? { departureHour: 0, arrivalHour: 0, minTemperatureK: null, coldSeconds: 0, unknownSeconds: 0, doseMicroGy: metrics.doseMicroGy, warnings: [], status: 'unknown' };
  const home: Route = last?.route ?? { mode: 'shortest', points: [], geographic: [], metrics: { ...EMPTY_METRICS } };
  return {
    mode: 'shortest', points, geographic, metrics, returnRoute: home,
    roundTripS: metrics.durationS, roundTripDoseMicroGy: conditions.doseMicroGy,
    warnings: last?.warnings ?? [], conditions, departures: [],
  };
}

export interface ScienceWalkPlan {
  route: Alternative;
  approaches: Approach[];
  legs: (Leg & { distanceM: number; durationS: number })[];
  restriction: ZoneRestriction;
}

export interface ScienceWalkFailure { leg?: Leg & { index: number }; message: string; diagnostics?: RouteDiagnostics }

/** Planner slots left for the hazard circles once the user's own restrictions are counted. */
export const zoneBudget = (userExclusions: number) => MAX_EXCLUSIONS - userExclusions;

export function zoneRestriction(userExclusions: number): ZoneRestriction | ScienceWalkFailure {
  const budget = zoneBudget(userExclusions);
  try { return toRestrictions(HAZARD_ZONES, budget); }
  catch { return { message: `The hazard areas need at least ${HAZARD_ZONES.length} free planner restrictions; ${Math.max(0, budget)} are free. Clear manual exclusions or switch off a field restriction, then plan again.` }; }
}

export const isFailure = (v: unknown): v is ScienceWalkFailure => !!v && typeof v === 'object' && 'message' in v && !('exclusions' in v);

type Call = (start: Point, goal: Point, settings: Settings, elapsedS: number) => Promise<LegResult>;

/**
 * Plans Habitat - Stop 1 - ... - Stop 8 - Habitat leg by leg with the team planner (shortest mode), the hazard
 * areas passed as restriction circles. The last leg carries the elapsed time of the earlier legs, so its
 * conditions cover the whole walk. Throws a ScienceWalkFailure for the first leg the planner refuses.
 */
export async function planScienceWalk(data: TerrainData, habitat: Point, settings: Settings, call: Call, onLeg?: (index: number, total: number) => void): Promise<ScienceWalkPlan> {
  const restriction = zoneRestriction(settings.exclusions.length);
  if (isFailure(restriction)) throw restriction;
  const planSettings: Settings = { ...settings, exclusions: [...settings.exclusions, ...plannerExclusions(restriction)] };
  const approaches = approachPoints(data, habitat, settings.maxSlopeDeg, planSettings.exclusions);
  const legs = legsFor(habitat, approaches), results: LegResult[] = [], done: ScienceWalkPlan['legs'] = [];
  let elapsed = 0;
  for (let i = 0; i < legs.length; i++) {
    onLeg?.(i, legs.length);
    const leg = legs[i];
    let result: LegResult;
    try { result = await call(leg.start, leg.goal, planSettings, elapsed); }
    catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      const diagnostics = (e as { diagnostics?: RouteDiagnostics }).diagnostics;
      const relabelled = diagnostics ? { ...diagnostics, endpoints: diagnostics.endpoints.map((p, k) => ({ ...p, label: k === 0 ? leg.from : leg.to })) } : undefined;
      // The return endpoint names its ends "Current position" and "Habitat"; here they are the two ends of this leg.
      const message = String((e as Error).message ?? '').replace(/^Current position is blocked/, `${leg.from} is blocked`).replace(/(^|\. )Habitat is blocked/, `$1${leg.to} is blocked`);
      throw { leg: { ...leg, index: i }, message, diagnostics: relabelled } satisfies ScienceWalkFailure;
    }
    results.push(result);
    const m = result.route?.metrics;
    done.push({ ...leg, distanceM: m?.distanceM ?? 0, durationS: m?.durationS ?? 0 });
    elapsed += m?.durationS ?? 0;
  }
  return { route: combineLegs(results), approaches, legs: done, restriction };
}
