import { describe, expect, it } from 'vitest';
import type { Point } from '../mission/data';
import { hitStop, spreadStops, stopRadius, type MapStop } from './hatch';
import { WALK_STOPS } from './sciencewalk';
import { placeLegend } from './HazardLegend';
import { sourceLine } from './preparedRoute';

const stops: MapStop[] = WALK_STOPS.map(s => ({ id: s.id, x: s.x, y: s.y, kind: s.kind }));
// The tablet map at its default zoom: the 1000 m team square drawn about 280 px wide.
const pixel = (p: Point) => [(p.x + 500) / 1000 * 280, (500 - p.y) / 1000 * 280];

describe('stop marks on the tablet map', () => {
  it('spreads close stops so no two squares overlap, each keeping its true point', () => {
    const gap = 2 * stopRadius(true) + 6;
    const placed = spreadStops(stops, pixel, gap);
    for (let i = 0; i < placed.length; i++) {
      expect(placed[i].x).toBeCloseTo(pixel(stops[i])[0], 9);
      for (let j = i + 1; j < placed.length; j++) expect(Math.hypot(placed[i].lx - placed[j].lx, placed[i].ly - placed[j].ly)).toBeGreaterThanOrEqual(gap - .01);
    }
  });
  it('leaves stops that are already apart where they are', () => {
    const far = spreadStops(stops, p => [p.x * 10, p.y * 10], 20);
    for (const p of far) { expect(p.lx).toBe(p.x); expect(p.ly).toBe(p.y); }
  });
  it('selects the square a tap lands on and reports a cluster for a tap between close squares', () => {
    const placed = spreadStops(stops, pixel, 2 * stopRadius(true) + 6);
    const four = placed.find(p => p.stop.id === 4)!;
    expect(hitStop(stops, pixel, 1, true, [four.lx, four.ly])).toEqual({ stop: stops[3] });
    const three = placed.find(p => p.stop.id === 3)!;
    const between: [number, number] = [(three.lx + four.lx) / 2, (three.ly + four.ly) / 2 + 8];
    const hit = hitStop(stops, pixel, 1, true, between);
    expect(hit && 'cluster' in hit && hit.cluster.map(s => s.id).sort()).toEqual(expect.arrayContaining([3, 4]));
    expect(hitStop(stops, pixel, 1, true, [0, 0])).toBeUndefined();
  });
});

describe('map legend placement', () => {
  it('sits beside the map when the side room is wide enough, else over it', () => {
    expect(placeLegend({ left: 290, top: 40, right: 570, bottom: 320 }, { width: 860 }).beside).toBe(true);
    expect(placeLegend({ left: 10, top: 40, right: 280, bottom: 320 }, { width: 600 }).beside).toBe(true);
    const over = placeLegend({ left: 100, top: 40, right: 350, bottom: 290 }, { width: 450 });
    expect(over.beside).toBe(false);
    expect(over.button).toEqual({ left: 108, top: 48 });
  });
});

describe('prepared route source lines', () => {
  it('reads as plain words, without file names or line numbers', () => {
    for (const id of ['walking_speed', 'work_time_per_stop', 'slope_cap']) {
      const line = sourceLine(id);
      expect(line).not.toMatch(/README|\.md|line \d|_/);
    }
    expect(sourceLine('walking_speed')).toMatch(/assumption of the Marswalk team/);
    expect(sourceLine('slope_cap')).toMatch(/Moon value/);
  });
});
