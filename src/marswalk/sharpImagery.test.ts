import { describe, expect, it } from 'vitest';
import { FULL_MAP, zoomViewport } from '../mission/mapViewport';
import { FOLLOW_MAX_M, FOLLOW_MIN_M, FOLLOW_TILE_ZOOM, HALF_ZOOM, TILE_ZOOM, followViewport, followWidth, sharpSources, viewExtent } from './sharpImagery';

const EXTENT = 1000;

describe('sharp Boxwork imagery on the map', () => {
  it('keeps the team image when zoomed out', () => {
    expect(sharpSources(FULL_MAP, EXTENT, 'colour')).toEqual([]);
    expect(sharpSources(zoomViewport(FULL_MAP, HALF_ZOOM), EXTENT, 'colour')).toEqual([]);
  });

  it('uses the half-resolution core between the two zoom steps', () => {
    const s = sharpSources(zoomViewport(FULL_MAP, 3), EXTENT, 'grey');
    expect(s.map(x => x.key)).toEqual(['grey_half']);
  });

  it('holds only the tiles the view touches when zoomed in', () => {
    const corner = followViewport({ x: -300, y: 300 }, 120, EXTENT);
    expect(corner.zoom).toBeGreaterThan(TILE_ZOOM);
    expect(sharpSources(corner, EXTENT, 'colour').map(x => x.key)).toEqual(['colour_0_0']);
    const middle = followViewport({ x: 0, y: 0 }, 120, EXTENT);
    expect(sharpSources(middle, EXTENT, 'colour')).toHaveLength(4);
    const east = followViewport({ x: 300, y: 0 }, 120, EXTENT);
    expect(sharpSources(east, EXTENT, 'colour').map(x => x.key)).toEqual(['colour_0_1', 'colour_1_1']);
  });

  it('draws the helmet minimap from the tiles at every window width it can take', () => {
    for (const w of [FOLLOW_MIN_M, FOLLOW_MAX_M]) {
      const s = sharpSources(followViewport({ x: 195, y: 315 }, w, EXTENT), EXTENT, 'colour', FOLLOW_TILE_ZOOM);
      expect(s.length).toBeGreaterThan(0);
      expect(s.every(x => !x.key.endsWith('half'))).toBe(true);
    }
  });

  it('measures the visible extent of a viewport', () => {
    expect(viewExtent(FULL_MAP, EXTENT)).toEqual({ west: -500, east: 500, north: 500, south: -500 });
    const v = followViewport({ x: 100, y: -50 }, 200, EXTENT), e = viewExtent(v, EXTENT);
    expect(e.west).toBeCloseTo(0, 9); expect(e.east).toBeCloseTo(200, 9);
    expect(e.north).toBeCloseTo(50, 9); expect(e.south).toBeCloseTo(-150, 9);
  });

  it('widens the round minimap window to keep the next stop inside, up to a close-view cap', () => {
    const at = { x: 0, y: 0 };
    expect(followWidth(at, [], EXTENT)).toBe(FOLLOW_MIN_M);
    const w = followWidth(at, [{ x: 110, y: 0 }], EXTENT);
    expect(w / 2).toBeGreaterThanOrEqual(110); expect(w).toBeLessThanOrEqual(FOLLOW_MAX_M);
    expect(w % 50).toBe(0);
    expect(followWidth(at, [{ x: 900, y: 900 }], EXTENT)).toBe(FOLLOW_MAX_M);
  });
});
