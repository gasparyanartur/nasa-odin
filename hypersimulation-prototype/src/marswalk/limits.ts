import type { Point } from '../mission/data';
import { distance } from './frame';

export type LimitId = 'rover_range' | 'suit_time' | 'partner_spacing' | 'slope_cap';

export interface SuitLimit {
  id: LimitId;
  label: string;
  value: number;
  unit: 'm' | 'h' | 'deg';
  body: string;
  sourceId: string;
  source: string;
  note: string;
}

export const LIMITS: Record<LimitId, SuitLimit> = {
  rover_range: {
    id: 'rover_range', label: 'Distance from the crew rover', value: 2000, unit: 'm', body: 'Earth analog for a lunar rover',
    sourceId: 'drats_2022', source: 'NASA D-RATS 2022 Test Report (NTRS 20230017073), https://ntrs.nasa.gov/citations/20230017073',
    note: '2 km from the crew rover. The report was read. The Marswalk planner enforces it.',
  },
  suit_time: {
    id: 'suit_time', label: 'Total time in suit', value: 14, unit: 'h', body: 'Not surface-specific',
    sourceId: 'nasa_std_3001_v2', source: 'NASA-STD-3001 Vol 2 Rev C, approved 2022-04-08, note under Table 35',
    note: '14 hours total time in suit. The standard was read for sections 6.8 and 11.2 to 11.5.',
  },
  partner_spacing: {
    id: 'partner_spacing', label: 'Distance between the two astronauts', value: 100, unit: 'm', body: 'Earth analog for a lunar rover',
    sourceId: 'drats_2022', source: 'NASA D-RATS 2022 Test Report (NTRS 20230017073), https://ntrs.nasa.gov/citations/20230017073',
    note: '100 m between two astronauts. The report was read. The planned spacing of 20 m in Marswalk is an assumption.',
  },
  slope_cap: {
    id: 'slope_cap', label: 'Steepest slope', value: 15, unit: 'deg', body: 'Moon',
    sourceId: 'pena_asensio_2024', source: 'Pena-Asensio et al. (2024), Moon south pole traverse scoring, https://boris.unibe.ch/194784/',
    note: '15 degree slope cap, a Moon value. Only the abstract was read.',
  },
};

export const CAUTION_FRACTION = { value: 0.2, origin: 'assumption', note: 'A margin under 20 percent of its limit shows caution. A Marswalk design choice, not a NASA value.' } as const;

export type CheckStatus = 'ok' | 'caution' | 'over' | 'no data';

export interface LimitCheck { id: LimitId; label: string; value: number | null; unit: SuitLimit['unit']; limit: number; margin: number | null; status: CheckStatus; method: string }

export interface PathSampleLike extends Point { elapsedS?: number }

export interface CheckInput {
  path: PathSampleLike[];
  rover: Point;
  durationH?: number | null;
  partnerM?: number[] | null;
  slope?: { at: (p: Point) => number | null | undefined; stepM: number } | null;
}

function status(value: number | null, limit: number): CheckStatus {
  if (value === null || !Number.isFinite(value)) return 'no data';
  if (value > limit) return 'over';
  return limit - value < limit * CAUTION_FRACTION.value ? 'caution' : 'ok';
}

function row(id: LimitId, value: number | null, method: string): LimitCheck {
  const l = LIMITS[id], v = value !== null && Number.isFinite(value) ? value : null;
  return { id, label: l.label, value: v, unit: l.unit, limit: l.value, margin: v === null ? null : l.value - v, status: status(v, l.value), method };
}

function durationFrom(path: PathSampleLike[]): number | null {
  const t = path.map(p => p.elapsedS).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return t.length >= 2 && t.length === path.length ? (Math.max(...t) - Math.min(...t)) / 3600 : null;
}

function steepest(path: Point[], slope: NonNullable<CheckInput['slope']>): number | null {
  if (!path.length || !(slope.stepM > 0)) return null;
  let max = -Infinity;
  const take = (p: Point) => { const v = slope.at(p); if (v === null || v === undefined || !Number.isFinite(v)) return false; max = Math.max(max, v); return true; };
  if (!take(path[0])) return null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = Math.max(1, Math.ceil(distance(a, b) / slope.stepM));
    for (let k = 1; k <= n; k++) if (!take({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n })) return null;
  }
  return max;
}

// A missing input never counts as passing: its row reads "no data".
export function checkPath(input: CheckInput): LimitCheck[] {
  const path = input.path.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const farthest = path.length ? Math.max(...path.map(p => distance(p, input.rover))) : null;
  const duration = input.durationH ?? durationFrom(path);
  const partner = input.partnerM && input.partnerM.length && input.partnerM.every(Number.isFinite) ? Math.max(...input.partnerM) : null;
  const slope = input.slope ? steepest(path, input.slope) : null;
  return [
    row('rover_range', farthest, 'Largest straight-line ground distance from the crew rover to any path point.'),
    row('suit_time', duration, input.durationH != null ? 'Duration given by the caller.' : 'Last minus first elapsed time of the path samples.'),
    row('partner_spacing', partner, 'Largest measured distance between the two astronauts.'),
    row('slope_cap', slope, 'Maximum terrain slope sampled along the path at the given step.'),
  ];
}
