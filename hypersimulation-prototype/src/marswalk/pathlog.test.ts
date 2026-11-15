import { describe, expect, it } from 'vitest';
import { CURIOSITY_PATH, WALKS_KEY, appendSample, closeWalk, compareWithReference, curiosityLine, deleteWalk, listWalks, localStore, memoryStore, saveWalk, startWalk, walkLengthM } from './pathlog';

class FakeStorage {
  data = new Map<string, string>();
  failWrites = false;
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { if (this.failWrites) throw new DOMException('Quota', 'QuotaExceededError'); this.data.set(k, v); }
}

const T0 = '2026-11-15T10:00:00.000Z', T1 = '2026-11-15T11:00:00.000Z';

describe('saved walked paths', () => {
  it('appends ordered finite samples, skips repeats and closes the walk', () => {
    let w = startWalk('w1', 'gale-boxwork', 'Morning walk', T0);
    w = appendSample(w, { x: 0, y: 0, elapsedS: 0 });
    w = appendSample(w, { x: 0, y: 0, elapsedS: 1 });
    w = appendSample(w, { x: 3, y: 4, elapsedS: 2 });
    w = appendSample(w, { x: 9, y: 9, elapsedS: 1 });
    w = appendSample(w, { x: Number.NaN, y: 0, elapsedS: 3 });
    expect(w.samples).toHaveLength(2);
    expect(walkLengthM(w)).toBe(5);
    const closed = closeWalk(w, T1);
    expect(closed.endedAt).toBe(T1);
    expect(appendSample(closed, { x: 10, y: 10, elapsedS: 5 })).toBe(closed);
    expect(closeWalk(closed, '2026-11-15T12:00:00.000Z').endedAt).toBe(T1);
  });

  it('measures maximum and mean separation from a reference line', () => {
    const r = compareWithReference([{ x: 0, y: 3 }, { x: 5, y: -1 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(r).toEqual({ samples: 3, maxM: 3, meanM: 4 / 3 });
    expect(compareWithReference([], [{ x: 0, y: 0 }])).toEqual({ samples: 0, maxM: null, meanM: null });
    const self = compareWithReference(curiosityLine(), curiosityLine());
    expect(self.samples).toBe(CURIOSITY_PATH.count);
    expect(self.maxM).toBe(0);
  });

  it('stores and lists closed walks per region in localStorage', () => {
    const fake = new FakeStorage(), store = localStore(() => fake as unknown as Storage);
    const a = closeWalk(appendSample(startWalk('a', 'gale-boxwork', 'A', T0), { x: 1, y: 1, elapsedS: 0 }), T1);
    const b = closeWalk(startWalk('b', 'gale-bradbury', 'B', T1), T1);
    const open = startWalk('c', 'gale-boxwork', 'C', T1);
    expect(saveWalk(store, a) && saveWalk(store, b) && saveWalk(store, open)).toBe(true);
    expect(JSON.parse(fake.getItem(WALKS_KEY)!)).toHaveLength(3);
    expect(listWalks(store).map(w => w.id)).toEqual(['a', 'b']);
    expect(listWalks(store, 'gale-boxwork').map(w => w.id)).toEqual(['a']);
    expect(saveWalk(store, { ...a, label: 'A2' }) && listWalks(store, 'gale-boxwork')[0].label).toBe('A2');
    expect(deleteWalk(store, 'a') && listWalks(store).map(w => w.id)).toEqual(['b']);
  });

  it('survives blocked storage, failed writes and damaged data', () => {
    const blocked = localStore(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(blocked.persistent).toBe(false);
    const w = closeWalk(startWalk('x', 'gale-boxwork', 'X', T0), T1);
    expect(saveWalk(blocked, w)).toBe(true);
    expect(listWalks(blocked).map(v => v.id)).toEqual(['x']);
    expect(localStore(() => null).persistent).toBe(false);

    const full = new FakeStorage(), store = localStore(() => full as unknown as Storage);
    full.failWrites = true;
    expect(saveWalk(store, w)).toBe(false);
    expect(store.persistent).toBe(false);
    expect(listWalks(store).map(v => v.id)).toEqual(['x']);

    const bad = new FakeStorage();
    bad.data.set(WALKS_KEY, '{not json');
    expect(localStore(() => bad as unknown as Storage).load()).toEqual([]);
    bad.data.set(WALKS_KEY, JSON.stringify([w, { id: 'broken', samples: 'no' }]));
    expect(localStore(() => bad as unknown as Storage).load().map(v => v.id)).toEqual(['x']);
    expect(memoryStore([w]).load()).toEqual([w]);
  });
});
