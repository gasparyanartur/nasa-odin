import type { Alternative, Exclusion, Point, RouteDiagnostics, RouteResult, Settings, StopReason } from './data';
import { TerrainPlanner, type PlannerData } from './planner/core';

/* The Routes flow in plain rules: when a plan runs by itself, which result still belongs to the screen, why a plan
   failed and what fixes it, why a step was refused, and why a control is blocked. Pure, so every rule is testable. */

export const distanceText = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
export const durationText = (s: number) => { const m = Math.ceil(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; };
export const MAX_SLOPE_SETTING = 45;

// ---------- Auto-plan and the stale rule ----------

export interface PlanInputs { dataId?: string; start: Point; goal?: Point; settings: Settings; hazards: boolean }

/** Everything a plan depends on, as one string. No key means nothing to plan yet (no terrain or no destination). */
export function planKey(i: PlanInputs): string | undefined {
  if (!i.dataId || !i.goal) return undefined;
  return JSON.stringify([i.dataId, i.start.x, i.start.y, i.goal.x, i.goal.y, i.hazards, i.settings]);
}

export type PlanOutcome =
  | { key: string; status: 'busy' }
  | { key: string; status: 'done'; result: RouteResult }
  | { key: string; status: 'failed'; failure: FailureView; details?: RouteDiagnostics };

/** A plan outcome is shown only while it belongs to the current start, destination and limits; an older one is never shown. */
export function currentOutcome(outcome: PlanOutcome | undefined, key: string | undefined): PlanOutcome | undefined {
  return outcome && key && outcome.key === key ? outcome : undefined;
}

/** Plan by itself once start and destination are set and something changed since the last plan; the Routes tool must be open. */
export function shouldAutoPlan(key: string | undefined, active: boolean, outcome: PlanOutcome | undefined): boolean {
  return !!key && active && (!outcome || outcome.key !== key);
}

// ---------- Failure: plain reason and a one-click fix ----------

export type Fix =
  | { kind: 'raise-slope'; to: number }
  | { kind: 'remove-last-nogo' }
  | { kind: 'clear-nogo' }
  | { kind: 'hazards-off' }
  | { kind: 'change-destination' }
  | { kind: 'change-start' }
  | { kind: 'open-limits' }
  | { kind: 'open-field'; id: string; title: string };

export interface FailureView { title: string; reason: string; fixes: Fix[] }

export interface FailureInput {
  diagnostics?: RouteDiagnostics; message?: string; slopeLimit: number;
  /** The planner's restriction list is your no-go areas, then saved field restrictions, then the hazard area circles. */
  manual: number; fields: { id: string; title: string }[]; hazardCircles: number;
  /** Smallest whole-degree slope limit that connects the endpoints with the same restrictions; null when none up to 45 degrees. */
  slopeNeeded?: number | null;
  names?: [string, string];
}

export function fixLabel(f: Fix): string {
  switch (f.kind) {
    case 'raise-slope': return `Raise slope limit to ${f.to}°`;
    case 'remove-last-nogo': return 'Remove last no-go area';
    case 'clear-nogo': return 'Clear no-go areas';
    case 'hazards-off': return 'Stop avoiding hazard areas';
    case 'change-destination': return 'Change destination';
    case 'change-start': return 'Change start';
    case 'open-limits': return 'Open limits';
    case 'open-field': return `Edit ${f.title}`;
  }
}

type Owner = 'nogo' | 'field' | 'hazard';
const ownerOf = (i: number, input: FailureInput): Owner => i < input.manual ? 'nogo' : i < input.manual + input.fields.length ? 'field' : 'hazard';

function nogoFixes(input: FailureInput, owners: Set<Owner>): Fix[] {
  const fixes: Fix[] = [];
  if (owners.has('nogo') && input.manual > 0) { fixes.push({ kind: 'remove-last-nogo' }); if (input.manual > 1) fixes.push({ kind: 'clear-nogo' }); }
  if (owners.has('field') && input.fields.length) fixes.push({ kind: 'open-field', ...input.fields[0] });
  if (owners.has('hazard') && input.hazardCircles > 0) fixes.push({ kind: 'hazards-off' });
  return fixes;
}

function raise(input: FailureInput, to: number | null | undefined): Fix[] {
  return to != null && to > input.slopeLimit && to <= MAX_SLOPE_SETTING ? [{ kind: 'raise-slope', to }] : [];
}

const UNKNOWN = (input: FailureInput): FailureView => ({ title: 'No route found.', reason: input.message && !input.diagnostics ? plainMessage(input.message) : 'The planner found no way under the current limits.', fixes: [{ kind: 'change-destination' }, { kind: 'open-limits' }] });

function plainMessage(message: string): string {
  if (/browser planner/i.test(message)) return 'The route planner stopped. Try Plan route again.';
  if (/does not match the active terrain/i.test(message)) return 'The map changed while planning. Try Plan route again.';
  return message;
}

export function explainFailure(input: FailureInput): FailureView {
  const d = input.diagnostics, limit = input.slopeLimit;
  if (!d) {
    if (input.message && /hazard areas need at least/.test(input.message)) return {
      title: 'Too many no-go areas.',
      reason: 'Routes can avoid at most 30 areas. With yours, the marked hazard areas no longer fit.',
      fixes: [...(input.manual ? [{ kind: 'remove-last-nogo' } as Fix] : []), ...(input.manual > 1 ? [{ kind: 'clear-nogo' } as Fix] : []), { kind: 'hazards-off' }],
    };
    return UNKNOWN(input);
  }
  const names = input.names ?? ['Start', 'Destination'];
  if (d.code === 'same_cell') return { title: 'Start and destination are the same spot.', reason: 'Pick a destination further away.', fixes: [{ kind: 'change-destination' }] };
  if (d.code === 'blocked_endpoints') {
    for (const index of [1, 0]) {
      const e = d.endpoints[index];
      if (!e || !e.reasons.length) continue;
      const who = names[index], change: Fix = index === 1 ? { kind: 'change-destination' } : { kind: 'change-start' };
      if (e.reasons.some(r => r.startsWith('Outside the prepared footprint'))) return { title: `${who} is outside the mapped area.`, reason: 'Pick a point inside the map.', fixes: [change] };
      if (e.reasons.some(r => r.startsWith('Missing or invalid terrain'))) return { title: `${who} has no terrain data.`, reason: 'The map has a gap there. Pick a point nearby.', fixes: [change] };
      const owners = new Set(e.exclusionIndices.map(i => ownerOf(i, input)));
      if (owners.has('hazard') && !owners.has('nogo') && !owners.has('field')) return { title: `${who} is inside a hazard area.`, reason: 'Routes keep out of the marked hazard areas.', fixes: [change, { kind: 'hazards-off' }] };
      if (owners.has('nogo')) return { title: `${who} is inside one of your no-go areas.`, reason: 'Routes keep out of your no-go areas.', fixes: [change, ...nogoFixes(input, new Set<Owner>(['nogo']))] };
      if (owners.has('field')) {
        const field = input.fields[Math.min(...e.exclusionIndices.filter(i => ownerOf(i, input) === 'field')) - input.manual];
        return { title: `${who} is inside a saved field restriction.`, reason: 'Routes keep out of saved field restrictions.', fixes: [change, ...(field ? [{ kind: 'open-field', ...field } as Fix] : [])] };
      }
      if (e.slopeDeg !== undefined && e.slopeDeg > limit) return { title: `${who} is too steep.`, reason: `The ground there is ${e.slopeDeg.toFixed(1)}°, above your ${limit}° limit.`, fixes: [change, ...raise(input, Math.ceil(e.slopeDeg))] };
    }
    return UNKNOWN(input);
  }
  // disconnected: the planner's notes say what separates the endpoints.
  const notes = d.notes.join(' ');
  if (notes.includes('Missing or invalid terrain separates')) return { title: 'No mapped ground connects start and destination.', reason: 'A gap in the terrain data lies between them.', fixes: [{ kind: 'change-destination' }] };
  const slopeEnough = notes.includes('Removing the slope limit restores');
  const exclusionsEnough = notes.includes('when active exclusions are removed');
  const owners = new Set<Owner>([...(input.manual ? ['nogo' as const] : []), ...(input.fields.length ? ['field' as const] : []), ...(input.hazardCircles ? ['hazard' as const] : [])]);
  const who = input.manual || input.fields.length ? (input.hazardCircles ? 'Your no-go areas and the marked hazard areas' : 'Your no-go areas') : 'The marked hazard areas';
  const needed = input.slopeNeeded;
  if (slopeEnough && !exclusionsEnough) return {
    title: 'Too steep.',
    reason: `Every way crosses slopes above your ${limit}° limit.${needed === null ? ` Even ${MAX_SLOPE_SETTING}° is not enough with the current no-go areas.` : ''}`,
    fixes: [...raise(input, needed), { kind: 'open-limits' }, { kind: 'change-destination' }],
  };
  if (exclusionsEnough && !slopeEnough) return { title: 'Blocked.', reason: `${who} close every way.`, fixes: [...nogoFixes(input, owners), { kind: 'change-destination' }] };
  if (notes.includes('Terrain above the') || notes.includes('Active exclusions separate') || (slopeEnough && exclusionsEnough)) return {
    title: 'Too steep and blocked.',
    reason: `Slopes above your ${limit}° limit and ${who.charAt(0).toLowerCase()}${who.slice(1)} close every way.`,
    fixes: [...raise(input, needed), ...nogoFixes(input, owners), { kind: 'open-limits' }],
  };
  return UNKNOWN(input);
}

/** The smallest whole-degree slope limit that connects start and goal with the same restrictions, using the planner's own grid. */
export function slopeNeeded(data: PlannerData, start: Point, goal: Point, exclusions: Exclusion[], current: number): number | null {
  let planner: TerrainPlanner, a: number, b: number;
  try { planner = new TerrainPlanner(data); a = planner.cell(start); b = planner.cell(goal); for (const e of exclusions) planner.cell(e); }
  catch { return null; }
  const ok = (limit: number) => planner.connected(planner.permitted(limit, exclusions), a, b);
  let lo = Math.floor(current) + 1, hi = MAX_SLOPE_SETTING;
  if (lo > hi || !ok(hi)) return null;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid + 1; }
  return lo;
}

// ---------- Result: one line, plus the limit it breaks ----------

export function resultLine(r: Pick<Alternative, 'metrics'>): string {
  return `${distanceText(r.metrics.distanceM)} · ${durationText(r.metrics.durationS)} · steepest ${r.metrics.maxSlopeDeg.toFixed(1)}°`;
}

export const OPTION_LABEL: Record<Alternative['mode'], string> = { shortest: 'Shortest', gentler: 'Easiest' };

/** The one warning a result card carries, in plain words, with its fix. */
export function resultWarning(r: Pick<Alternative, 'roundTripS' | 'conditions'>, s: Pick<Settings, 'maxDurationMin'>): { text: string; fix?: Fix } | undefined {
  if (r.roundTripS > s.maxDurationMin * 60) return { text: `Too long for the suit time limit: ${durationText(r.roundTripS)} there and back, limit ${s.maxDurationMin} min.`, fix: { kind: 'open-limits' } };
  if (r.conditions.status === 'exceeds') return { text: 'Over a mission limit (cold, wind or dose). Check the limits.', fix: { kind: 'open-limits' } };
  if (r.conditions.status === 'unknown') return { text: 'Some weather along the way is unknown.' };
  return undefined;
}

// ---------- Movement stops ----------

export function stopText(reason: StopReason, slopeLimit: number): string {
  switch (reason) {
    case 'slope': return `Stopped: slope ahead is above your ${slopeLimit}° limit. Turn, or raise the limit on the tablet.`;
    case 'edge': return 'Stopped: edge of the mapped area. Turn back.';
    case 'gap': return 'Stopped: no terrain data ahead. Turn and go around.';
    case 'nogo': return 'Stopped: no-go area ahead. Turn, or remove it on the tablet.';
  }
}
export const PAUSED_TABLET = 'Paused: the tablet is open.';

// ---------- Blocked controls: reason and the fix that removes the blocker ----------

export type BlockFix = 'choose-suggested' | 'show-regions' | 'retry-terrain' | 'pick-destination' | 'show-first-path' | 'go-surface' | 'retry-return';
export interface Block { reason: string; fix?: BlockFix; more?: BlockFix }

export const BLOCK_FIX_LABEL: Record<BlockFix, string> = {
  'choose-suggested': 'Choose Gale Boxwork (suggested)', 'show-regions': 'Show regions', 'retry-terrain': 'Retry loading',
  'pick-destination': 'Pick on map', 'show-first-path': 'Show the first path', 'go-surface': 'Go to the surface', 'retry-return': 'Retry the estimate',
};

interface PlaceState { region: boolean; plannable: boolean; data: boolean; dataError?: boolean }

export function tabletTabBlock(s: PlaceState): Block | undefined {
  if (!s.region) return { reason: 'Choose a region first.', fix: 'choose-suggested', more: 'show-regions' };
  return undefined;
}
export function surfaceTabBlock(s: PlaceState): Block | undefined {
  if (!s.region) return { reason: 'Choose a region first.', fix: 'choose-suggested', more: 'show-regions' };
  if (!s.plannable) return { reason: 'This region has no walkable terrain. Choose a Gale region.', fix: 'choose-suggested', more: 'show-regions' };
  if (s.dataError) return { reason: 'The terrain did not load.', fix: 'retry-terrain' };
  if (!s.data) return { reason: 'The terrain is still loading.' };
  return undefined;
}
export function toolTabBlock(s: PlaceState): Block | undefined {
  if (!s.plannable) return { reason: 'Not available in this region.', fix: 'choose-suggested' };
  return undefined;
}

interface RouteState { data: boolean; goal: boolean; busy: boolean; previewable: boolean; workflow: 'new' | 'saved'; hasPaths: boolean }

export function planBlock(s: RouteState): Block | undefined {
  if (!s.data) return { reason: 'The terrain is still loading.' };
  if (!s.goal) return { reason: 'Pick a destination on the map first.', fix: 'pick-destination' };
  if (s.busy) return { reason: 'Planning the route now.' };
  return undefined;
}
export function previewBlock(s: RouteState): Block | undefined {
  if (!s.data) return { reason: 'The terrain is still loading.' };
  if (s.previewable) return undefined;
  if (s.workflow === 'saved') return { reason: 'Show a path from the list first.', fix: s.hasPaths ? 'show-first-path' : undefined };
  return { reason: 'Plan or load a route first.', fix: 'pick-destination' };
}
export function walkBlock(s: Pick<RouteState, 'data'>): Block | undefined {
  return s.data ? undefined : { reason: 'The terrain is still loading.' };
}
export function returnBlock(s: { route: boolean; error: boolean; onSurface: boolean }): Block | undefined {
  if (s.route) return undefined;
  if (s.error) return { reason: 'The way back could not be computed.', fix: 'retry-return' };
  return { reason: 'No way back is known yet. It is computed while you are on the surface.', fix: s.onSurface ? undefined : 'go-surface' };
}
