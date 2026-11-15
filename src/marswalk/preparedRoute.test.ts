import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Meta, Point, TerrainData } from '../mission/data';
import { canMove } from '../mission/data';
import { distance, marswalkToTeam } from './frame';
import { FULL, heightAt, heightGrid } from './fullData';
import { HAZARD_ZONES, insidePolygon } from './hazards';
import { checkPath } from './limits';
import { ARRIVAL_M, WALK_STOPS } from './sciencewalk';
import { PREPARED, cellSlope, hoursMinutes, kilometres, preparedAlternative, walkTerrain, type SlopeCells } from './preparedRoute';

const route = PREPARED.points.values.map(([x, y]) => ({ x, y }));
const dense = (pts: Point[], stepM: number) => pts.slice(1).flatMap((b, i) => {
  const a = pts[i], k = Math.max(1, Math.ceil(distance(a, b) / stepM));
  return Array.from({ length: k }, (_, j) => ({ x: a.x + (b.x - a.x) * (j + 1) / k, y: a.y + (b.y - a.y) * (j + 1) / k }));
});

describe('prepared science route', () => {
  it('keeps every point inside the team Boxwork area and outside every hazard area', () => {
    const area = FULL.teamAreaM;
    for (const p of [route[0], ...dense(route, 1)]) {
      expect(p.x).toBeGreaterThanOrEqual(area.west); expect(p.x).toBeLessThanOrEqual(area.east);
      expect(p.y).toBeGreaterThanOrEqual(area.south); expect(p.y).toBeLessThanOrEqual(area.north);
      for (const z of HAZARD_ZONES) expect(insidePolygon(p, z.polygon), `${z.id} at ${p.x}, ${p.y}`).toBe(false);
    }
  });

  it('passes within the arrival radius of the eight stops in order', () => {
    const path = [route[0], ...dense(route, .5)];
    let from = 0;
    for (const stop of WALK_STOPS) {
      const at = path.findIndex((p, i) => i >= from && distance(p, stop) <= ARRIVAL_M);
      expect(at, `Stop ${stop.id}`).toBeGreaterThanOrEqual(0);
      from = at;
    }
    expect(PREPARED.legs.map(l => l.to)).toEqual([...WALK_STOPS.map(s => `Stop ${s.id}`), 'Crew rover']);
  });

  it('has totals equal to the sum of its legs and parts', () => {
    const sum = PREPARED.legs.reduce((s, l) => s + l.distanceM, 0);
    expect(PREPARED.totals.distanceM).toBeCloseTo(sum, 6);
    const { walkingS, stopsS, stopCount, workMinPerStop, walkingSpeedMps } = PREPARED.totals.parts;
    expect(PREPARED.totals.timeInSuitS).toBeCloseTo(walkingS + stopsS, 6);
    expect(walkingS).toBeCloseTo(sum / walkingSpeedMps, 6);
    expect(stopsS).toBe(stopCount * workMinPerStop * 60);
    expect(PREPARED.totals.steepestSlopeDeg).toBe(Math.max(...PREPARED.legs.map(l => l.maxSlopeDeg)));
    expect(PREPARED.totals.steepestSlopeDeg).toBeLessThanOrEqual(PREPARED.totals.slopeLimitDeg);
    const last = PREPARED.legs.at(-1)!.pointRange[1];
    expect(last).toBe(PREPARED.points.values.length - 1);
  });

  it('uses the stop and base positions of the team stop file, converted by the frame rule', () => {
    const stops = JSON.parse(readFileSync('public/marswalk/stops.json', 'utf8'));
    expect(PREPARED.frame.groundScaleX).toBe(stops.frame.groundScaleX);
    for (const s of PREPARED.stops) {
      const team = stops.stops.find((t: { id: number }) => t.id === s.id);
      expect(marswalkToTeam(s.marswalk, PREPARED.frame).x).toBeCloseTo(team.x, 5);
      expect(s.y).toBe(team.y);
    }
    expect(PREPARED.base.x).toBeCloseTo(stops.base.x, 5);
    expect(PREPARED.origin).toBe('planned by the Marswalk planner on the 1 m terrain grid');
  });

  it('formats the figures as the Marswalk app shows them', () => {
    expect(kilometres(PREPARED.totals.distanceM)).toBe('1.7 km');
    expect(hoursMinutes(PREPARED.totals.timeInSuitS)).toBe('4 h 00 min');
    expect(PREPARED.totals.steepestSlopeDeg.toFixed(1)).toBe('15.0');
  });

  it('can be followed on foot: the 1 m walking grid blocks no step along it at the team slope limit', () => {
    const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
    const scene = JSON.parse(readFileSync('public/boxwork/detail/scene.json', 'utf8'));
    const b = readFileSync('public/boxwork/full/height.f32'), grid = heightGrid(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const slope: SlopeCells = { cells: scene.core.slope_cells, sizeM: scene.core.size_m, scaleDeg: scene.slope.scale_deg, nodata: scene.slope.nodata, groundScaleX: scene.ground_scale.x, values: new Uint8Array(readFileSync('public/boxwork/detail/slope_core.bin')) };
    for (const p of route) expect(cellSlope(slope, p)!).toBeLessThanOrEqual(PREPARED.totals.slopeLimitDeg);
    const checks = checkPath({ path: route, rover: PREPARED.base, durationH: PREPARED.totals.timeInSuitS / 3600, slope: { at: p => cellSlope(slope, p), stepM: .5 } });
    const steep = checks.find(c => c.id === 'slope_cap')!;
    expect(steep.value!).toBeLessThanOrEqual(PREPARED.totals.slopeLimitDeg);
    expect(steep.status).not.toBe('over');
    const walk = walkTerrain({ meta } as TerrainData, (x, y) => heightAt(grid, x, y), slope);
    expect(walk.meta.stepM).toBe(1);
    const settings = { speedMps: .8, maxSlopeDeg: 20, exclusions: [] };
    for (let i = 0; i < route.length - 1; i++) expect(canMove(walk, route[i], route[i + 1], settings), `segment ${i}`).toBe(true);
    const alt = preparedAlternative(meta, { doseRateMicroGyH: 10 });
    expect(alt.points).toHaveLength(route.length);
    expect(alt.metrics.distanceM).toBe(PREPARED.totals.distanceM);
    expect(alt.conditions.status).toBe('unknown');
  });

  it('stops a step on the 1 m walking grid where the ground is steeper than the walker limit', () => {
    const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
    const scene = JSON.parse(readFileSync('public/boxwork/detail/scene.json', 'utf8'));
    const b = readFileSync('public/boxwork/full/height.f32'), grid = heightGrid(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const slope: SlopeCells = { cells: scene.core.slope_cells, sizeM: scene.core.size_m, scaleDeg: scene.slope.scale_deg, nodata: scene.slope.nodata, groundScaleX: scene.ground_scale.x, values: new Uint8Array(readFileSync('public/boxwork/detail/slope_core.bin')) };
    const walk = walkTerrain({ meta } as TerrainData, (x, y) => heightAt(grid, x, y), slope);
    const cell = slope.sizeM / slope.cells, half = slope.sizeM / 2;
    let steep: Point | undefined;
    for (let j = 100; j < slope.cells - 100 && !steep; j++) for (let i = 100; i < slope.cells - 100; i++) {
      const v = slope.values[j * slope.cells + i];
      if (v !== slope.nodata && v * slope.scaleDeg >= 25) { steep = { x: (-half + (i + .5) * cell) * slope.groundScaleX, y: half - (j + .5) * cell }; break; }
    }
    expect(steep, 'a cell of 25 degrees or more inside the area').toBeDefined();
    const from = { x: steep!.x - 3, y: steep!.y };
    expect(canMove(walk, from, steep!, { maxSlopeDeg: 15, exclusions: [] })).toBe(false);
    expect(canMove(walk, from, steep!, { maxSlopeDeg: 89, exclusions: [] })).toBe(true);
  });
});
