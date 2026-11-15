import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sample, type Meta, type TerrainData } from '../mission/data';
import { FULL, ORTHO_PX, heightAt, heightGrid, inside, pickImagerySource, tileFor, tiles } from './fullData';
import { CREW_ROVER, STOPS } from './stops';

const meta = JSON.parse(readFileSync('public/boxwork/manifest.json', 'utf8')) as Meta;
const scene = JSON.parse(readFileSync('public/boxwork/detail/scene.json', 'utf8')) as {
  ground_scale: { x: number }; core: { size_m: number; image_m_per_px: number; dem_samples: number; tile_px: number; tiles: string[][] };
  imagery: Record<'colour' | 'grey', { tiles: string[][] }>;
};
const bin = (path: string) => { const b = readFileSync(path); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const team = { meta, heights: new Float32Array(bin('public/boxwork/height.f32')), slopes: new Float32Array(bin('public/boxwork/slope.f32')), valid: new Uint8Array(bin('public/boxwork/valid.u8')) } as TerrainData;
const grid = heightGrid(bin('public/boxwork/full/height.f32'));
const half = scene.core.size_m / 2, gs = scene.ground_scale.x;

function jpegSize(path: string): [number, number] {
  const b = readFileSync(path);
  for (let i = 2; i < b.length - 9;) {
    const marker = b[i + 1], len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  throw new Error(`${path}: no JPEG frame header`);
}

describe('Full Boxwork data description', () => {
  it('matches the Marswalk scene geometry it was derived from', () => {
    expect(FULL.frame.groundScaleX).toBe(gs);
    expect(FULL.frame.origin).toEqual(meta.origin);
    expect(FULL.frame.radiusM).toBe(meta.radiusM);
    expect(FULL.extentTeamM).toMatchObject({ west: -half * gs, east: half * gs, south: -half, north: half });
    expect(FULL.imagery.pixelSizeM).toEqual({ east: scene.core.image_m_per_px * gs, north: scene.core.image_m_per_px });
    expect(FULL.height.rows).toBe(scene.core.dem_samples);
    expect(FULL.height.cols).toBe(scene.core.dem_samples);
    expect(FULL.height.stepTeamM.north).toBe(scene.core.size_m / (scene.core.dem_samples - 1));
    expect(FULL.height.noDataCount).toBe(0);
    expect(grid.values.length).toBe(1025 * 1025);
    expect(statSync('public/boxwork/full/height.f32').size).toBe(FULL.height.bytes);
  });

  it('points at tile files that exist, match their hash and have the stated size', () => {
    for (const mode of ['colour', 'grey'] as const)
      scene.imagery[mode].tiles.forEach((row, r) => row.forEach((rel, c) => {
        const ref = FULL.imagery.files[`${mode}_${r}_${c}`];
        expect(ref.url).toBe(`/boxwork/detail/${rel}`);
        const bytes = readFileSync(`public${ref.url}`);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(ref.sha256);
        expect([ref.widthPx, ref.heightPx]).toEqual([scene.core.tile_px, scene.core.tile_px]);
      }));
  });

  it('joins the four tiles without gap or overlap and covers the full extent', () => {
    const t = tiles();
    expect(t).toHaveLength(4);
    const at = (r: number, c: number) => t.find(x => x.row === r && x.col === c)!.extent;
    expect(at(0, 0).east).toBe(at(0, 1).west);
    expect(at(1, 0).east).toBe(at(1, 1).west);
    expect(at(0, 0).south).toBe(at(1, 0).north);
    expect(at(0, 1).south).toBe(at(1, 1).north);
    expect(at(0, 0).west).toBe(FULL.extentTeamM.west);
    expect(at(0, 0).north).toBe(FULL.extentTeamM.north);
    expect(at(1, 1).east).toBeCloseTo(FULL.extentTeamM.east, 9);
    expect(at(1, 1).south).toBe(FULL.extentTeamM.south);
    const area = t.reduce((s, x) => s + (x.extent.east - x.extent.west) * (x.extent.north - x.extent.south), 0);
    const full = (FULL.extentTeamM.east - FULL.extentTeamM.west) * (FULL.extentTeamM.north - FULL.extentTeamM.south);
    expect(area).toBeCloseTo(full, 6);
    for (const p of [{ x: at(0, 0).east, y: 100 }, { x: -100, y: at(0, 0).south }]) expect(tileFor(p.x, p.y)).not.toBeNull();
  });

  it('covers the whole team Boxwork area, with a margin of 12 m north-south and about 10.2 m east-west', () => {
    expect(FULL.teamAreaM).toMatchObject({ west: -meta.extentM / 2, east: meta.extentM / 2, south: -meta.extentM / 2, north: meta.extentM / 2 });
    for (const [x, y] of [[-500, -500], [500, 500], [-500, 500], [500, -500]]) expect(inside(FULL.extentTeamM, x, y)).toBe(true);
    expect(FULL.extentTeamM.north - meta.extentM / 2).toBe(12);
    expect(FULL.extentTeamM.east - meta.extentM / 2).toBeCloseTo(512 * gs - 500, 9);
    expect(FULL.extentTeamM.east - meta.extentM / 2).toBeGreaterThan(10);
  });

  it('puts the crew rover and two stops in the expected tiles', () => {
    const stop1 = STOPS.find(s => s.id === 1)!, stop3 = STOPS.find(s => s.id === 3)!;
    expect(tileFor(CREW_ROVER.x, CREW_ROVER.y)).toMatchObject({ row: 0, col: 1 });
    expect(tileFor(stop1.x, stop1.y)).toMatchObject({ row: 0, col: 0 });
    expect(tileFor(stop3.x, stop3.y)).toMatchObject({ row: 1, col: 0 });
    expect(tileFor(stop3.x, stop3.y)!.url.colour).toBe('/boxwork/detail/ortho/colour_core_1_0.webp');
    expect(tileFor(FULL.extentTeamM.east + 0.01, 0)).toBeNull();
  });

  it('agrees with the team 5 m grid exactly at its nodes', () => {
    for (const [x, y] of [[0, 0], [-500, 500], [500, -500], [195, 315], [-95, 45]]) {
      const team5 = sample(team, { x, y })!.elevation;
      expect(Math.abs(heightAt(grid, x, y)! - team5)).toBeLessThanOrEqual(1e-3);
    }
  });

  it('agrees with the team 5 m grid at the rover and stops within the measured 5 m deviation', () => {
    const tol = FULL.checks.fiveMetreDeviationMaxM;
    expect(tol).toBeGreaterThan(0);
    for (const p of [CREW_ROVER, STOPS.find(s => s.id === 1)!, STOPS.find(s => s.id === 3)!]) {
      const fine = heightAt(grid, p.x, p.y)!, coarse = sample(team, p)!.elevation;
      expect(fine).not.toBeNull();
      expect(Math.abs(fine - coarse)).toBeLessThanOrEqual(tol);
    }
  });

  it('returns null outside the grid and next to no-data', () => {
    expect(heightAt(grid, 0, FULL.extentTeamM.north + 1)).toBeNull();
    const holed = { ...grid, values: new Float32Array(grid.values) };
    const r = 512, c = 512;
    holed.values[r * grid.cols + c] = NaN;
    expect(heightAt(holed, 0, 0)).toBeNull();
    expect(() => heightGrid(new ArrayBuffer(8))).toThrow();
  });

  it('picks the sharpest loaded imagery and falls back to the 1600 px ortho', () => {
    expect(jpegSize('public/boxwork/ortho.jpg')).toEqual([ORTHO_PX, ORTHO_PX]);
    expect(jpegSize('public/boxwork/ortho-grey.jpg')).toEqual([ORTHO_PX, ORTHO_PX]);
    const all = Object.fromEntries(tiles().map(t => [`colour_${t.row}_${t.col}`, true]));
    expect(pickImagerySource({ tiles: all, half: true })).toMatchObject({ id: 'full-tiles', metresPerPixel: 0.25 });
    expect(pickImagerySource({ tiles: { ...all, colour_1_1: false }, half: true })).toMatchObject({ id: 'core-half', metresPerPixel: 0.5 });
    expect(pickImagerySource({ tiles: all }, 'grey')).toMatchObject({ id: 'ortho', urls: ['/boxwork/ortho-grey.jpg'], metresPerPixel: 0.625 });
    expect(pickImagerySource({})).toMatchObject({ id: 'ortho', urls: ['/boxwork/ortho.jpg'], extent: FULL.teamAreaM });
    const ranks = [pickImagerySource({ tiles: all }), pickImagerySource({ half: true }), pickImagerySource({})].map(s => s.metresPerPixel);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
