import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_QUALITY, surfacePlan } from './plan';

describe('walk scene load plan', () => {
  it('uses the 1 m Boxwork height grid at the default quality and stays at the built-in graphics recommendation', () => {
    const plan = surfacePlan(DEFAULT_QUALITY, true);
    expect(DEFAULT_QUALITY).toBe('medium');
    expect(plan.coreHeight).toBe('dem_core');
    expect(plan.lowDetail).toBe(true);
    expect(plan.coreTiles).toBe(false);
    const scene = JSON.parse(readFileSync('public/boxwork/detail/scene.json', 'utf8'));
    expect(scene.core.dem_m_per_px).toBe(1);
    expect(readFileSync('public/boxwork/detail/dem_core.bin').byteLength).toBe(scene.core.dem_samples ** 2 * 2);
  });

  it('keeps the full tiles and every 1 m mesh sample behind High', () => {
    expect(surfacePlan('high', true)).toEqual({ coreHeight: 'dem_core', lowDetail: false, coreTiles: true });
    expect(surfacePlan('low', true).coreTiles).toBe(false);
    expect(surfacePlan('medium', false).lowDetail).toBe(false);
  });
});
