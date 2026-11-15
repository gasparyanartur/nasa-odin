import type { Point } from '../mission/data';
import { distance, distanceToPolyline } from './frame';
import { HAZARD_ZONES, insidePolygon, type HazardZone } from './hazards';
import { ARRIVAL_M, WALK_STOPS } from './sciencewalk';
import type { ScienceStop } from './stops';

/** The team app raises "more than 25 m off the planned route" (App.tsx); a hazard area counts as near at the same distance. */
export const NEAR_HAZARD_M = 25;

export interface HazardStatus { state: 'clear' | 'near' | 'inside'; zone: HazardZone | null; distanceM: number | null }

export function hazardStatus(p: Point, zones: HazardZone[] = HAZARD_ZONES): HazardStatus {
  let best: HazardStatus = { state: 'clear', zone: null, distanceM: null };
  for (const zone of zones) {
    if (insidePolygon(p, zone.polygon)) return { state: 'inside', zone, distanceM: 0 };
    const ring = [...zone.polygon, zone.polygon[0]].map(([x, y]) => ({ x, y }));
    const d = distanceToPolyline(p, ring);
    if (Number.isFinite(d) && (best.distanceM === null || d < best.distanceM)) best = { state: d <= NEAR_HAZARD_M ? 'near' : 'clear', zone, distanceM: d };
  }
  return best.state === 'near' ? best : { ...best, state: 'clear' };
}

/** Stops the walker stands at now: within ARRIVAL_M of the stop or of the point its planned leg ends on. */
export function stopsAt(p: Point, ends: Map<number, Point> = new Map(), stops: ScienceStop[] = WALK_STOPS): ScienceStop[] {
  return stops.filter(s => distance(p, s) <= ARRIVAL_M || (ends.has(s.id) && distance(p, ends.get(s.id)!) <= ARRIVAL_M));
}

export const nextStop = (visited: ReadonlySet<number>, stops: ScienceStop[] = WALK_STOPS) => stops.find(s => !visited.has(s.id));

export const arrivalText = (stop: ScienceStop) => `Stop ${stop.id}: ${stop.short}`;

/** A walked path keeps one sample per planning cell travelled, so a long walk stays small in storage. */
export const shouldSample = (last: Point | undefined, p: Point, stepM: number) => !last || distance(last, p) >= stepM;
