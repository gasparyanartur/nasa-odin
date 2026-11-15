import raw from '../../public/marswalk/hazards.json';
import type { Exclusion, Point } from '../mission/data';
import type { FrameLink } from './frame';
import type { Origin } from './stops';

export type HazardKind = 'scarp_edge' | 'loose_ground';
export type HatchId = 'hatch-scarp' | 'hatch-loose' | 'hatch-caution' | 'hatch-blocked';

export interface HazardZone {
  id: string;
  label: string;
  kind: HazardKind;
  hatch: HatchId;
  polygon: [number, number][];
  marswalkPolygon: [number, number][];
  origin: Origin;
  originNote: string;
}

export interface HazardPackage { schema: 'marswalk-hazards'; version: 1; frame: FrameLink; source: string; zones: HazardZone[] }

export interface LegendEntry { hatch: HatchId; danger: string; appliesTo: 'zone' | 'slope'; pattern: string; origin: Origin; note: string }

export const LEGEND: Record<HatchId, LegendEntry> = {
  'hatch-scarp': {
    hatch: 'hatch-scarp', danger: 'Scarp edge: steep drop, no entry', appliesTo: 'zone',
    pattern: 'Cased 0 and 90 degree grid on a 35 percent ink tint, 7 m period, dashed outline (Marswalk hatch-nogo)',
    origin: 'assumption', note: 'Zone drawn by the Marswalk team. The pattern is the Marswalk no-go hatch.',
  },
  'hatch-loose': {
    hatch: 'hatch-loose', danger: 'Dark loose material: footing unknown, no entry', appliesTo: 'zone',
    pattern: 'Cased 45 degree single lines on a 35 percent ink tint, 7 m period, dashed outline',
    origin: 'assumption', note: 'Zone drawn by the Marswalk team. A second pattern so the two dangers differ (team review call, 2026-11-15); a design choice.',
  },
  'hatch-caution': {
    hatch: 'hatch-caution', danger: 'Slope 10 to 15 degrees: walkable, steep', appliesTo: 'slope',
    pattern: 'Sparse ink dots, 12 m period, ink at 55 percent (Marswalk hatch-caution)',
    origin: 'assumption', note: 'The 10 degree step is a Marswalk design choice with no source; 15 degrees is the slope cap after Pena-Asensio et al. 2024 (Moon).',
  },
  'hatch-blocked': {
    hatch: 'hatch-blocked', danger: 'Slope above 15 degrees: blocked for the planner', appliesTo: 'slope',
    pattern: 'Single 45 degree ink lines, 12 m period, 1.9 m wide, ink at 55 percent (Marswalk hatch-blocked)',
    origin: 'source', note: 'Slope cap 15 degrees after Pena-Asensio et al. 2024, a Moon value; only the abstract was read.',
  },
};

export function parseHazards(input: unknown): HazardPackage {
  const p = input as HazardPackage;
  if (!p || p.schema !== 'marswalk-hazards' || p.version !== 1) throw new Error('Not a Marswalk hazards package (schema marswalk-hazards, version 1).');
  if (p.frame?.datasetId !== 'gale-boxwork-v1') throw new Error('Marswalk hazards must be in the gale-boxwork-v1 frame.');
  for (const z of p.zones) {
    if (!Object.hasOwn(LEGEND, z.hatch) || LEGEND[z.hatch].appliesTo !== 'zone') throw new Error(`Zone ${z.id} has an unknown hatch.`);
    if (z.polygon.length < 3 || z.polygon.some(v => v.length !== 2 || !v.every(Number.isFinite))) throw new Error(`Zone ${z.id} needs three or more finite corners.`);
  }
  return p;
}

export const MARSWALK_HAZARDS: HazardPackage = parseHazards(raw);
export const HAZARD_ZONES: HazardZone[] = MARSWALK_HAZARDS.zones;

export function insidePolygon(p: Point, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > p.y) !== (by > p.y) && p.x < (bx - ax) * (p.y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export const zonesAt = (p: Point, zones: HazardZone[] = HAZARD_ZONES) => zones.filter(z => insidePolygon(p, z.polygon));

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const cr = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: Point, q: Point, r: Point) => cr(p, q, r) === 0 && r.x >= Math.min(p.x, q.x) && r.x <= Math.max(p.x, q.x) && r.y >= Math.min(p.y, q.y) && r.y <= Math.max(p.y, q.y);
  return on(c, d, a) || on(c, d, b) || on(a, b, c) || on(a, b, d);
}

export function polygonTouchesRect(polygon: [number, number][], x0: number, y0: number, x1: number, y1: number): boolean {
  const corners: Point[] = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  if (polygon.some(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return true;
  if (corners.some(c => insidePolygon(c, polygon))) return true;
  for (let i = 0; i < polygon.length; i++) {
    const a = { x: polygon[i][0], y: polygon[i][1] }, b = { x: polygon[(i + 1) % polygon.length][0], y: polygon[(i + 1) % polygon.length][1] };
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b, corners[k], corners[(k + 1) % 4])) return true;
  }
  return false;
}

export const MAX_EXCLUSIONS = 30;
export const EXCLUSION_RADIUS_M = { min: 5, max: 500 };

export interface ZoneRestriction { exclusions: (Exclusion & { zoneId: string })[]; spacingM: number; radiusM: number }

function cover(zone: HazardZone, s: number): (Exclusion & { zoneId: string })[] {
  const xs = zone.polygon.map(v => v[0]), ys = zone.polygon.map(v => v[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const radius = Math.ceil(s * Math.SQRT1_2 * 100) / 100;
  const out: (Exclusion & { zoneId: string })[] = [];
  for (let x0 = minX; x0 < maxX || x0 === minX; x0 += s)
    for (let y0 = minY; y0 < maxY || y0 === minY; y0 += s)
      if (polygonTouchesRect(zone.polygon, x0, y0, x0 + s, y0 + s)) out.push({ x: x0 + s / 2, y: y0 + s / 2, radius, zoneId: zone.id });
  return out;
}

// The team planner takes circles only (server/app.py Exclusion: radius 5 to 500 m, at most 30 per request).
// Each kept grid cell is covered by its circumscribed circle, so the union covers every zone completely.
export function toRestrictions(zones: HazardZone[] = HAZARD_ZONES, budget = MAX_EXCLUSIONS): ZoneRestriction {
  if (!zones.length) return { exclusions: [], spacingM: 0, radiusM: 0 };
  if (!Number.isInteger(budget) || budget < zones.length) throw new Error(`At least ${zones.length} free restriction slots are needed; ${budget} given.`);
  const minSpacing = Math.ceil(EXCLUSION_RADIUS_M.min / Math.SQRT1_2);
  const maxSpacing = Math.floor(EXCLUSION_RADIUS_M.max / Math.SQRT1_2);
  for (let s = minSpacing; s <= maxSpacing; s++) {
    const exclusions = zones.flatMap(z => cover(z, s));
    if (exclusions.length <= budget) return { exclusions, spacingM: s, radiusM: exclusions[0].radius };
  }
  throw new Error('The zones are too large to cover with planner restrictions of at most 500 m radius.');
}

export const plannerExclusions = (r: ZoneRestriction): Exclusion[] => r.exclusions.map(({ x, y, radius }) => ({ x, y, radius }));
