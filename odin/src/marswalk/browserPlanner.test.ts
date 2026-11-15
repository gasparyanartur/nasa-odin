import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculate, settingsFor, TerrainPlanner, type PlannerData } from '../mission/planner/core';
import type { ReturnResult, Settings, TerrainData } from '../mission/data';
import { HAZARD_ZONES, plannerExclusions } from './hazards';
import { isFailure, planScienceWalk, zoneRestriction, type LegResult } from './sciencewalk';
import { PREPARED_NAME, preparedAlternative } from './preparedRoute';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
function boxwork(): PlannerData {
  const bytes = (name: string) => readFileSync(`public/boxwork/${name}`);
  const floats = (name: string) => { const b = bytes(name); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  return { meta: read('public/boxwork/manifest.json'), environment: read('public/boxwork/environment.json'), heights: floats('height.f32'), slopes: floats('slope.f32'), valid: Uint8Array.from(bytes('valid.u8')) };
}
const settings: Settings = { conditionsMode: 'historical', departureHour: 12, dwellMin: 0, speedMps: .8, maxSlopeDeg: 20, maxDurationMin: 90, doseRateMicroGyH: 10, maxDoseMicroGy: 50, temperatureK: 220, minTemperatureK: 180, windMps: 0, maxWindMps: 25, exclusions: [] };

describe('Marswalk with the browser planner', () => {
  it('hands the hazard circles over in the form the browser planner validates', () => {
    const restriction = zoneRestriction(0);
    if (isFailure(restriction)) throw new Error(restriction.message);
    const exclusions = plannerExclusions(restriction);
    expect(exclusions.length).toBe(29);
    expect(HAZARD_ZONES.length).toBeGreaterThan(0);
    expect(settingsFor({ ...settings, exclusions }).exclusions).toHaveLength(29);
  });

  it('plans the science walk legs through the browser planner return calculation', async () => {
    const data = boxwork(), planner = new TerrainPlanner(data);
    const habitat = data.meta.defaultStart ?? { x: 0, y: 0 };
    const calls: number[] = [];
    const call = async (start: { x: number; y: number }, goal: { x: number; y: number }, s: Settings, elapsedS: number) => {
      calls.push(s.exclusions.length);
      return calculate(planner, 'return', { start, goal, settings: s, mode: 'shortest', elapsedS }) as ReturnResult as LegResult;
    };
    try {
      const plan = await planScienceWalk(data as TerrainData, habitat, settings, call);
      expect(plan.route.points.length).toBeGreaterThan(1);
    } catch (e) {
      // The 5 m planner may refuse a leg on the steep stops; the refusal must come from routing, never from request validation.
      expect(isFailure(e), String(e)).toBe(true);
      expect((e as { message: string }).message).not.toMatch(/Unknown route setting|At most 30|must be a finite number/);
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(n => n === 29)).toBe(true);
  });

  it('plans all nine legs around the hazard circles when the slope limit allows it', async () => {
    const data = boxwork(), planner = new TerrainPlanner(data);
    const habitat = data.meta.defaultStart ?? { x: 0, y: 0 };
    const call = async (start: { x: number; y: number }, goal: { x: number; y: number }, s: Settings, elapsedS: number) =>
      calculate(planner, 'return', { start, goal, settings: s, mode: 'shortest', elapsedS }) as ReturnResult as LegResult;
    const plan = await planScienceWalk(data as TerrainData, habitat, { ...settings, maxSlopeDeg: 45 }, call);
    expect(plan.legs).toHaveLength(9);
    expect(plan.restriction.exclusions).toHaveLength(29);
    expect(plan.route.metrics.distanceM).toBeGreaterThan(0);
  });

  it('keeps the prepared route totals', () => {
    const r = preparedAlternative(read('public/boxwork/manifest.json'), settings);
    expect(PREPARED_NAME).toBe('Science walk, 8 stops');
    expect(r.metrics.distanceM.toFixed(1)).toBe('1677.1');
    expect((r.metrics.durationS / 60).toFixed(1)).toBe('239.9');
    expect(r.metrics.maxSlopeDeg.toFixed(2)).toBe('15.00');
  });
});
