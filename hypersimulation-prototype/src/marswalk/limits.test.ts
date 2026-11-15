import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sample, type Meta, type TerrainData } from '../mission/data';
import { CAUTION_FRACTION, LIMITS, checkPath } from './limits';
import { CREW_ROVER, STOPS } from './stops';

const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
const bin = (name: string) => { const b = readFileSync(`public/boxwork/${name}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const terrain = { meta, heights: new Float32Array(bin('height.f32')), slopes: new Float32Array(bin('slope.f32')), valid: new Uint8Array(bin('valid.u8')) } as TerrainData;
const byId = (rows: ReturnType<typeof checkPath>) => Object.fromEntries(rows.map(r => [r.id, r]));

describe('sourced suit limits', () => {
  it('keeps the four Marswalk limits with unit and source', () => {
    expect(Object.values(LIMITS).map(l => [l.id, l.value, l.unit, l.sourceId])).toEqual([
      ['rover_range', 2000, 'm', 'drats_2022'], ['suit_time', 14, 'h', 'nasa_std_3001_v2'],
      ['partner_spacing', 100, 'm', 'drats_2022'], ['slope_cap', 15, 'deg', 'pena_asensio_2024'],
    ]);
    for (const l of Object.values(LIMITS)) { expect(l.source.length).toBeGreaterThan(10); expect(l.body).toBeTruthy(); }
  });

  it('checks a timed path against range, time and partner spacing', () => {
    const path = [{ x: 0, y: 0, elapsedS: 0 }, { x: 1500, y: 0, elapsedS: 3600 }, { x: 1900, y: 0, elapsedS: 7200 }];
    const r = byId(checkPath({ path, rover: { x: 0, y: 0 }, partnerM: [10, 20, 120] }));
    expect(r.rover_range).toMatchObject({ value: 1900, margin: 100, status: 'caution' });
    expect(r.suit_time).toMatchObject({ value: 2, status: 'ok' });
    expect(r.partner_spacing).toMatchObject({ value: 120, status: 'over' });
    expect(r.slope_cap).toMatchObject({ value: null, status: 'no data' });
    expect(CAUTION_FRACTION.value).toBe(0.2);
  });

  it('never reports a missing value as passing', () => {
    const r = byId(checkPath({ path: [{ x: 0, y: 0 }], rover: { x: 0, y: 0 }, partnerM: [], slope: { at: () => null, stepM: 2.5 } }));
    expect(r.suit_time.status).toBe('no data');
    expect(r.partner_spacing.status).toBe('no data');
    expect(r.slope_cap.status).toBe('no data');
    expect(byId(checkPath({ path: [], rover: { x: 0, y: 0 } })).rover_range.status).toBe('no data');
    expect(byId(checkPath({ path: [{ x: 0, y: 0 }], rover: { x: 0, y: 0 }, durationH: 15 })).suit_time.status).toBe('over');
  });

  it('samples terrain slope along a real Boxwork leg at the planner half-step', () => {
    const leg = [CREW_ROVER, STOPS[0]];
    const r = byId(checkPath({ path: leg, rover: CREW_ROVER, slope: { at: p => sample(terrain, p)?.slope, stepM: meta.stepM / 2 } }));
    expect(r.slope_cap.value).not.toBeNull();
    expect(r.slope_cap.value!).toBeGreaterThan(0);
    expect(r.rover_range.value).toBeCloseTo(Math.hypot(STOPS[0].x - CREW_ROVER.x, STOPS[0].y - CREW_ROVER.y), 6);
    const outside = byId(checkPath({ path: [CREW_ROVER, { x: 900, y: 0 }], rover: CREW_ROVER, slope: { at: p => sample(terrain, p)?.slope, stepM: 2.5 } }));
    expect(outside.slope_cap.status).toBe('no data');
  });
});
