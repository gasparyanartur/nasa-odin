import { describe, expect, it } from 'vitest';
import { HAZARD_ZONES } from './hazards';
import { NEAR_HAZARD_M, arrivalText, hazardStatus, nextStop, shouldSample, stopsAt } from './helmet';
import { ARRIVAL_M, WALK_STOPS } from './sciencewalk';

describe('helmet marks', () => {
  const zone = HAZARD_ZONES[0];
  const xs = zone.polygon.map(v => v[0]), ys = zone.polygon.map(v => v[1]);
  const centre = { x: xs.reduce((a, b) => a + b) / xs.length, y: ys.reduce((a, b) => a + b) / ys.length };

  it('reads inside, near and clear around a hazard area', () => {
    expect(hazardStatus(centre).state).toBe('inside');
    const east = Math.max(...xs);
    expect(hazardStatus({ x: east + NEAR_HAZARD_M - 1, y: centre.y }).state).toBe('near');
    expect(hazardStatus({ x: 450, y: 450 }).state).toBe('clear');
  });

  it('arrives at a stop within the radius, or at the end of its leg', () => {
    const s = WALK_STOPS[2];
    expect(stopsAt({ x: s.x + ARRIVAL_M - .5, y: s.y }).map(x => x.id)).toContain(s.id);
    expect(stopsAt({ x: s.x + 40, y: s.y }).map(x => x.id)).not.toContain(s.id);
    const end = { x: s.x + 30, y: s.y };
    expect(stopsAt({ x: s.x + 31, y: s.y }, new Map([[s.id, end]])).map(x => x.id)).toContain(s.id);
  });

  it('names the next unvisited stop and writes the short arrival line', () => {
    expect(nextStop(new Set([1, 2]))?.id).toBe(3);
    expect(nextStop(new Set(WALK_STOPS.map(s => s.id)))).toBeUndefined();
    expect(arrivalText(WALK_STOPS[0])).toBe(`Stop 1: ${WALK_STOPS[0].short}`);
  });

  it('samples once per planning cell travelled', () => {
    expect(shouldSample(undefined, { x: 0, y: 0 }, 5)).toBe(true);
    expect(shouldSample({ x: 0, y: 0 }, { x: 3, y: 0 }, 5)).toBe(false);
    expect(shouldSample({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
  });
});
