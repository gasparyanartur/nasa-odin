import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, pickMission, toggleFeature } from './presets';
import { SETUP_KEY, loadSetup, saveSetup } from './setupStore';

function memory(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, clear: () => m.clear(), getItem: k => m.get(k) ?? null, key: i => [...m.keys()][i] ?? null, removeItem: k => { m.delete(k); }, setItem: (k, v) => { m.set(k, String(v)); } };
}

describe('walk choice storage', () => {
  it('survives a reload', () => {
    const s = memory(), chosen = toggleFeature(pickMission(DEFAULT_SETUP, 'safety'), 'hist');
    expect(saveSetup(chosen, () => s)).toBe(true);
    expect(loadSetup(() => s)).toEqual(chosen);
  });

  it('falls back to the default when storage is blocked or broken', () => {
    expect(loadSetup(() => { throw new Error('SecurityError'); })).toEqual(DEFAULT_SETUP);
    expect(saveSetup(DEFAULT_SETUP, () => { throw new Error('SecurityError'); })).toBe(false);
    const s = memory(); s.setItem(SETUP_KEY, '{not json');
    expect(loadSetup(() => s)).toEqual(DEFAULT_SETUP);
    const full = { ...memory(), setItem: () => { throw new Error('QuotaExceededError'); } } as Storage;
    expect(saveSetup(DEFAULT_SETUP, () => full)).toBe(false);
  });

  it('cleans unknown values on load', () => {
    const s = memory(); s.setItem(SETUP_KEY, JSON.stringify({ region: 'mars', mission: 'party', features: { stops: 'yes' } }));
    expect(loadSetup(() => s)).toEqual(DEFAULT_SETUP);
  });
});
