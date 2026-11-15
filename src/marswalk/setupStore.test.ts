import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, pickMission, toggleFeature } from './presets';
import { SETUP_KEY, canStore, loadSetup, saveSetup, savedSetup } from './setupStore';

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

  it('reports a stored choice for re-applying after a reload, and none when nothing is stored', () => {
    const s = memory();
    expect(savedSetup(() => s)).toBeNull();
    const chosen = pickMission(DEFAULT_SETUP, 'water');
    saveSetup(chosen, () => s);
    expect(savedSetup(() => s)).toEqual(chosen);
    expect(savedSetup(() => { throw new Error('SecurityError'); })).toBeNull();
    s.setItem(SETUP_KEY, '{not json');
    expect(savedSetup(() => s)).toBeNull();
  });

  it('tells on load whether storage works, without leaving a stored choice behind', () => {
    const s = memory();
    expect(canStore(() => s)).toBe(true);
    expect(s.length).toBe(0);
    expect(savedSetup(() => s)).toBeNull();
    expect(canStore(() => { throw new Error('SecurityError'); })).toBe(false);
    const full = { ...memory(), setItem: () => { throw new Error('QuotaExceededError'); } } as Storage;
    expect(canStore(() => full)).toBe(false);
  });

  it('cleans unknown values on load', () => {
    const s = memory(); s.setItem(SETUP_KEY, JSON.stringify({ region: 'mars', mission: 'party', features: { stops: 'yes' } }));
    expect(loadSetup(() => s)).toEqual(DEFAULT_SETUP);
  });
});
