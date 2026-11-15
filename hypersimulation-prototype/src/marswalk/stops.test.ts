import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { geoToLocal, localToGeo, sample, type Meta, type TerrainData } from '../mission/data';
import { insideExtent, lonLatToMarswalk, marswalkToLonLat, marswalkToTeam, teamToMarswalk, type MarswalkScene } from './frame';
import { CREW_ROVER, DRILL_SITES, HELMET_WORD_LIMIT, MARSWALK_STOPS, STOPS, helmetLine, parseStops, placedDrillSites } from './stops';
import { CURIOSITY_PATH } from './pathlog';

const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
const scene = JSON.parse(readFileSync('public/boxwork/detail/scene.json', 'utf8')) as MarswalkScene & { projection: { radius_m: number; standard_parallel: number } };
const evidence = JSON.parse(readFileSync('public/boxwork/evidence.json', 'utf8')) as { path: { x: number; y: number; sol: number }[]; markers: { label: string; x: number; y: number }[] };
const bin = (name: string) => { const b = readFileSync(`public/boxwork/${name}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const terrain = { meta, heights: new Float32Array(bin('height.f32')), slopes: new Float32Array(bin('slope.f32')), valid: new Uint8Array(bin('valid.u8')) } as TerrainData;
const frame = MARSWALK_STOPS.frame;
const everyPoint = () => [CREW_ROVER, ...STOPS, ...placedDrillSites()];

describe('Marswalk stops in the team Boxwork frame', () => {
  it('links the two frames through the same origin, radius and ground scale', () => {
    expect(frame.origin).toEqual(meta.origin);
    expect(scene.origin).toEqual({ lon: meta.origin.longitude, lat: meta.origin.latitude });
    expect(frame.radiusM).toBe(meta.radiusM);
    expect(scene.projection.radius_m).toBe(meta.radiusM);
    expect(scene.projection.standard_parallel).toBe(0);
    expect(frame.groundScaleX).toBe(scene.ground_scale.x);
    expect(scene.ground_scale.y).toBe(1);
    expect(frame.groundScaleX).toBeCloseTo(Math.cos(meta.origin.latitude * Math.PI / 180), 12);
    expect(scene.metres_per_degree.lon).toBeCloseTo(meta.radiusM * Math.PI / 180, 6);
  });

  it('converts every stop both ways, directly and through Mars longitude and latitude', () => {
    for (const p of everyPoint()) {
      const direct = marswalkToTeam(p.marswalk!, frame);
      expect(direct.x).toBeCloseTo(p.x, 5); expect(direct.y).toBeCloseTo(p.y, 5);
      const [lon, lat] = marswalkToLonLat(p.marswalk!, scene);
      const viaGeo = geoToLocal(meta, lon, lat);
      expect(viaGeo.x).toBeCloseTo(p.x, 5); expect(viaGeo.y).toBeCloseTo(p.y, 5);
      const back = lonLatToMarswalk(...localToGeo(meta, p), scene);
      expect(back.x).toBeCloseTo(p.marswalk!.x, 5); expect(back.y).toBeCloseTo(p.marswalk!.y, 5);
      const inverse = teamToMarswalk(p, frame);
      expect(inverse.x).toBeCloseTo(p.marswalk!.x, 5);
    }
  });

  it('places NASA waypoint coordinates where the converted Curiosity path says, and matches the team evidence file', () => {
    expect(CURIOSITY_PATH.points).toHaveLength(evidence.path.length);
    CURIOSITY_PATH.points.forEach((p, i) => {
      const q = geoToLocal(meta, p.lon, p.lat);
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeLessThan(0.01);
      expect(p.sol).toBe(evidence.path[i].sol);
      expect(p.x).toBeCloseTo(evidence.path[i].x, 5); expect(p.y).toBeCloseTo(evidence.path[i].y, 5);
    });
    expect(CREW_ROVER.x).toBeCloseTo(CURIOSITY_PATH.points[0].x, 5);
    expect(CREW_ROVER.y).toBeCloseTo(CURIOSITY_PATH.points[0].y, 5);
    for (const d of placedDrillSites()) {
      const marker = evidence.markers.find(m => m.label.startsWith(d.name))!;
      expect(marker).toBeDefined(); expect(d.x).toBeCloseTo(marker.x, 5); expect(d.y).toBeCloseTo(marker.y, 5);
    }
  });

  it('keeps the crew rover, every stop and every placed drill site inside the prepared Boxwork area', () => {
    for (const p of everyPoint()) {
      expect(insideExtent(p, meta.extentM)).toBe(true);
      expect(sample(terrain, p)).not.toBeNull();
    }
  });

  it('carries the eight stops with full tasks, short helmet text and an honest null position', () => {
    expect(STOPS.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const s of STOPS) {
      expect(s.task.length).toBeGreaterThan(s.short.length);
      expect(s.short.trim().split(/\s+/).length).toBeLessThanOrEqual(HELMET_WORD_LIMIT);
      expect(s.origin).toBe('assumption');
    }
    expect(DRILL_SITES.map(d => d.name)).toEqual(['Altadena', 'Valle de la Luna', 'Nevado Sajama']);
    expect(DRILL_SITES[1]).toMatchObject({ x: null, y: null, marswalk: null });
    expect(helmetLine(STOPS[2], 2, 8)).toBe(`Stop 3 of 8. ${STOPS[2].short}`);
  });

  it('refuses packages in another frame or with long helmet text', () => {
    expect(() => parseStops({ ...MARSWALK_STOPS, frame: { ...frame, datasetId: 'gale-bradbury-v1' } })).toThrow(/frame/);
    expect(() => parseStops({ ...MARSWALK_STOPS, stops: [{ ...STOPS[0], short: 'one two three four five six seven' }] })).toThrow(/6 words/);
    expect(() => parseStops({ schema: 'other' })).toThrow(/schema/);
  });
});
