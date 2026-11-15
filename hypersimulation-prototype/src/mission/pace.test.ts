import { describe, expect, it } from 'vitest';
import { DEFAULT_PACE, PACE_KEY, savePace, storedPace } from './pace';

const memory = (value?: string) => { const m = new Map<string, string>(value === undefined ? [] : [[PACE_KEY, value]]); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('simulation pace', () => {
  it('defaults to 20', () => {
    expect(DEFAULT_PACE).toBe(20);
    expect(storedPace(memory())).toBe(20);
  });
  it('lets a stored user value win', () => {
    expect(storedPace(memory('1'))).toBe(1);
    expect(storedPace(memory('5'))).toBe(5);
    const s = memory(); savePace(1, s);
    expect(storedPace(s)).toBe(1);
  });
  it('ignores a stored value that is not an offered step, and blocked storage', () => {
    expect(storedPace(memory('7'))).toBe(20);
    expect(storedPace(memory('x'))).toBe(20);
    expect(storedPace({ getItem: () => { throw new Error('blocked'); } })).toBe(20);
    expect(() => savePace(5, { setItem: () => { throw new Error('blocked'); } })).not.toThrow();
  });
});
