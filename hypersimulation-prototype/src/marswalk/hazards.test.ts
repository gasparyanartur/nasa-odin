import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Meta } from '../mission/data';
import { insideExtent, marswalkToTeam } from './frame';
import { EXCLUSION_RADIUS_M, HAZARD_ZONES, LEGEND, MARSWALK_HAZARDS, MAX_EXCLUSIONS, insidePolygon, parseHazards, plannerExclusions, polygonTouchesRect, toRestrictions, zonesAt, type HazardZone } from './hazards';
import { CREW_ROVER, STOPS } from './stops';

const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
const PLANNER_MARGIN_M = meta.stepM / Math.SQRT2;

function pointsInside(zone: HazardZone, step = 2) {
  const xs = zone.polygon.map(v => v[0]), ys = zone.polygon.map(v => v[1]), out: { x: number; y: number }[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += step) for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) if (insidePolygon({ x, y }, zone.polygon)) out.push({ x, y });
  return out.concat(zone.polygon.map(([x, y]) => ({ x, y })));
}

describe('Marswalk no-go zones', () => {
  it('converts both zones from the Marswalk frame and keeps them in the prepared area', () => {
    expect(HAZARD_ZONES.map(z => [z.id, z.kind, z.origin])).toEqual([['nogo-1', 'scarp_edge', 'assumption'], ['nogo-2', 'loose_ground', 'assumption']]);
    for (const z of HAZARD_ZONES) z.polygon.forEach((v, i) => {
      const q = marswalkToTeam({ x: z.marswalkPolygon[i][0], y: z.marswalkPolygon[i][1] }, MARSWALK_HAZARDS.frame);
      expect(v[0]).toBeCloseTo(q.x, 5); expect(v[1]).toBeCloseTo(q.y, 5);
      expect(insideExtent({ x: v[0], y: v[1] }, meta.extentM)).toBe(true);
    });
  });

  it('gives each danger its own hatch and a legend entry', () => {
    const hatches = HAZARD_ZONES.map(z => z.hatch);
    expect(new Set(hatches).size).toBe(hatches.length);
    for (const h of hatches) expect(LEGEND[h].appliesTo).toBe('zone');
    expect(Object.values(LEGEND).every(e => e.danger && e.pattern && e.note)).toBe(true);
    expect(() => parseHazards({ ...MARSWALK_HAZARDS, zones: [{ ...HAZARD_ZONES[0], hatch: 'hatch-blocked' }] })).toThrow(/hatch/);
  });

  it('finds the zone under a point and no zone under the stops or the crew rover', () => {
    const inside = pointsInside(HAZARD_ZONES[1])[0];
    expect(zonesAt(inside).map(z => z.id)).toEqual(['nogo-2']);
    for (const p of [CREW_ROVER, ...STOPS]) expect(zonesAt(p)).toEqual([]);
  });

  it('detects cells that touch a polygon by corner, edge or containment', () => {
    const tri: [number, number][] = [[0, 0], [10, 0], [0, 10]];
    expect(polygonTouchesRect(tri, 1, 1, 2, 2)).toBe(true);
    expect(polygonTouchesRect(tri, -5, -5, 20, 20)).toBe(true);
    expect(polygonTouchesRect(tri, 4, -1, 6, 1)).toBe(true);
    expect(polygonTouchesRect(tri, 8, 8, 9, 9)).toBe(false);
  });

  it('turns the zones into planner circles that cover them completely within the request limits', () => {
    const r = toRestrictions();
    expect(r.exclusions.length).toBeLessThanOrEqual(MAX_EXCLUSIONS);
    for (const e of r.exclusions) { expect(e.radius).toBeGreaterThanOrEqual(EXCLUSION_RADIUS_M.min); expect(e.radius).toBeLessThanOrEqual(EXCLUSION_RADIUS_M.max); }
    for (const z of HAZARD_ZONES) for (const p of pointsInside(z))
      expect(r.exclusions.some(e => e.zoneId === z.id && Math.hypot(e.x - p.x, e.y - p.y) <= e.radius)).toBe(true);
    for (const p of [CREW_ROVER, ...STOPS]) for (const e of r.exclusions) expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThan(e.radius + PLANNER_MARGIN_M);
    expect(Object.keys(plannerExclusions(r)[0]).sort()).toEqual(['radius', 'x', 'y']);
  });

  it('uses fewer, larger circles when field restrictions already take slots, and refuses too few slots', () => {
    const wide = toRestrictions(HAZARD_ZONES, MAX_EXCLUSIONS), tight = toRestrictions(HAZARD_ZONES, 6);
    expect(tight.exclusions.length).toBeLessThanOrEqual(6);
    expect(tight.radiusM).toBeGreaterThan(wide.radiusM);
    for (const z of HAZARD_ZONES) for (const p of pointsInside(z, 5)) expect(tight.exclusions.some(e => Math.hypot(e.x - p.x, e.y - p.y) <= e.radius)).toBe(true);
    expect(() => toRestrictions(HAZARD_ZONES, 1)).toThrow(/slots/);
    expect(toRestrictions([], 0).exclusions).toEqual([]);
  });
});
