import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { LegResult } from './sciencewalk';
import { ARRIVAL_M, WALK_STOPS, approachPoints, cellOf, cellPoint, combineLegs, isFailure, legsFor, permittedMask, planScienceWalk, reachable, zoneRestriction } from './sciencewalk';
import { plannerExclusions } from './hazards';
import type { Meta, Point, Route, Settings, TerrainData } from '../mission/data';

const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
const bin = (name: string) => { const b = readFileSync(`public/boxwork/${name}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const data = { meta, heights: new Float32Array(bin('height.f32')), slopes: new Float32Array(bin('slope.f32')), valid: new Uint8Array(bin('valid.u8')) } as TerrainData;
const habitat = meta.defaultStart!;
const settings = { speedMps: .8, maxSlopeDeg: 20, maxDurationMin: 90, doseRateMicroGyH: 10, maxDoseMicroGy: 50, temperatureK: 220, minTemperatureK: 180, windMps: 0, maxWindMps: 25, exclusions: [] } as Settings;
const leg = (a: Point, b: Point, d: number): Route => ({ mode: 'shortest', points: [[a.x, a.y, 0], [b.x, b.y, 0]], geographic: [[0, 0, 0], [1, 1, 0]], metrics: { distanceM: d, durationS: d, ascentM: 1, descentM: 1, maxSlopeDeg: d / 10, doseMicroGy: .1, terrainCost: d } });

describe('science walk on Boxwork', () => {
  it('rounds points to planner cells and back', () => {
    const c = cellOf(data, { x: 2.4, y: -2.6 })!;
    expect(cellPoint(data, c.row, c.col)).toEqual({ x: 0, y: -5 });
    expect(cellOf(data, { x: 600, y: 0 })).toBeNull();
  });

  it('ends a leg on a permitted cell within the arrival radius, joined to the habitat when one is, else at the stop', () => {
    const r = zoneRestriction(0);
    if (isFailure(r)) throw new Error(r.message);
    const ex = plannerExclusions(r), n = meta.size;
    for (const limit of [20, 30, 45]) {
      const mask = permittedMask(data, limit, ex), home = cellOf(data, habitat)!, joined = reachable(mask, n, home.row * n + home.col);
      const found = approachPoints(data, habitat, limit, ex);
      expect(found.map(a => a.stop.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (const a of found) {
        if (!a.planned) { expect(a.point).toEqual({ x: a.stop.x, y: a.stop.y }); continue; }
        const c = cellOf(data, a.point)!;
        expect(mask[c.row * n + c.col]).toBe(1);
        expect(a.gapM).toBeLessThanOrEqual(ARRIVAL_M);
        expect(a.gapM).toBeCloseTo(Math.hypot(a.point.x - a.stop.x, a.point.y - a.stop.y), 9);
        const near = (i: number) => { const p = cellPoint(data, Math.floor(i / n), i % n); return Math.hypot(p.x - a.stop.x, p.y - a.stop.y); };
        const joinedNear = Array.from(joined.keys()).filter(i => joined[i] && near(i) <= ARRIVAL_M);
        if (joinedNear.length) { expect(joined[c.row * n + c.col]).toBe(1); expect(Math.min(...joinedNear.map(near))).toBeCloseTo(a.gapM, 9); }
      }
    }
    // A stop on a ridge wall steeper than the limit everywhere within the radius goes to the planner unchanged.
    expect(approachPoints(data, habitat, 20, ex).some(a => !a.planned)).toBe(true);
  });

  it('chains habitat, the eight stops and the habitat into nine legs', () => {
    const legs = legsFor(habitat, approachPoints(data, habitat, 20, []));
    expect(legs).toHaveLength(9);
    expect(legs[0].from).toBe('Habitat'); expect(legs[0].to).toBe('Stop 1');
    expect(legs[8].from).toBe('Stop 8'); expect(legs[8].to).toBe('Habitat');
    for (let i = 1; i < legs.length; i++) expect(legs[i].start).toEqual(legs[i - 1].goal);
  });

  it('sums the legs and keeps the last conditions', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, c = { x: 10, y: 10 };
    const legs: LegResult[] = [{ route: leg(a, b, 10), warnings: [] }, { route: null, warnings: [] }, { route: leg(b, c, 20), warnings: ['late'], conditions: { departureHour: 12, arrivalHour: 12.1, minTemperatureK: 200, coldSeconds: 0, unknownSeconds: 0, doseMicroGy: 3, warnings: ['late'], status: 'exceeds' } }];
    const r = combineLegs(legs);
    expect(r.points).toEqual([[0, 0, 0], [10, 0, 0], [10, 10, 0]]);
    expect(r.metrics.distanceM).toBe(30); expect(r.metrics.maxSlopeDeg).toBe(2);
    expect(r.roundTripS).toBe(30); expect(r.roundTripDoseMicroGy).toBe(3);
    expect(r.warnings).toEqual(['late']); expect(r.conditions.status).toBe('exceeds');
  });

  it('refuses when the user restrictions leave too few planner slots', () => {
    expect(isFailure(zoneRestriction(29))).toBe(true);
    expect(isFailure(zoneRestriction(0))).toBe(false);
  });

  it('plans every leg with the hazard circles and passes the elapsed time on', async () => {
    const calls: { start: Point; goal: Point; n: number; elapsed: number }[] = [];
    const plan = await planScienceWalk(data, habitat, settings, async (start, goal, s, elapsed) => { calls.push({ start, goal, n: s.exclusions.length, elapsed }); return { route: leg(start, goal, 10), warnings: [] }; });
    expect(calls).toHaveLength(9);
    expect(calls.every(c => c.n === plan.restriction.exclusions.length && c.n <= 30)).toBe(true);
    expect(calls.map(c => c.elapsed)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect(plan.route.metrics.distanceM).toBe(90);
  });

  it('names the failing leg and relabels the planner endpoints', async () => {
    const fail = Object.assign(new Error('Destination is blocked'), { diagnostics: { code: 'blocked_endpoints', slopeLimitDeg: 20, stepM: 5, activeExclusionCount: 0, notes: [], endpoints: [{ label: 'Current position', x: 0, y: 0, reasons: [], exclusionIndices: [] }, { label: 'Habitat', x: 1, y: 1, reasons: ['steep'], exclusionIndices: [] }] } });
    let n = 0;
    await expect(planScienceWalk(data, habitat, settings, async (s, g) => { if (n++ === 2) throw fail; return { route: leg(s, g, 1), warnings: [] }; }))
      .rejects.toMatchObject({ message: 'Destination is blocked', leg: { index: 2, from: 'Stop 2', to: 'Stop 3' }, diagnostics: { endpoints: [{ label: 'Stop 2' }, { label: 'Stop 3' }] } });
  });

  it('keeps the stop order 1 to 8', () => expect(WALK_STOPS.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]));
});
