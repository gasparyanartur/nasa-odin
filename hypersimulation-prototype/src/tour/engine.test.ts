import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL, MAX_SKIPS_IN_ROW, dwellMs, reduce, type TourEvent, type TourState } from './engine';
import { placeCard } from './layout';
import { TOUR_KEY, tourMemory } from './memory';
import { createScope } from './scope';

const N = 5;
const run = (events: TourEvent[], from: TourState = INITIAL) => events.reduce((s, e) => reduce(s, e, N), from);
const started = () => run([{ type: 'invite' }, { type: 'start' }]);

describe('tour engine', () => {
  it('starts only on an explicit start, never from the invitation alone', () => {
    const invited = run([{ type: 'invite' }]);
    expect(invited.phase).toBe('invite');
    expect(run([{ type: 'not-now' }], invited).phase).toBe('off');
    const s = started();
    expect(s).toMatchObject({ phase: 'running', index: 0, mode: 'auto', stage: 'reach', paused: false });
  });

  it('plays the steps in order: act, read, next step', () => {
    let s = started();
    const seen = [s.index];
    for (let i = 0; i < N - 1; i++) {
      s = run([{ type: 'acted' }], s);
      expect(s.stage).toBe('dwell');
      s = run([{ type: 'dwell-over' }], s);
      seen.push(s.index);
      expect(s.stage).toBe('reach');
    }
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    s = run([{ type: 'acted' }, { type: 'dwell-over' }], s);
    expect(s).toMatchObject({ phase: 'running', index: N - 1 });
    expect(run([{ type: 'next' }], s)).toMatchObject({ phase: 'off', reason: 'finished' });
  });

  it('every step entry gets a fresh run number, so stale async work is ignored', () => {
    const a = started(), b = run([{ type: 'next' }], a), c = run([{ type: 'hands-on' }], b);
    expect(new Set([a.run, b.run, c.run]).size).toBe(3);
  });

  it('pause holds the dwell, play releases it', () => {
    let s = run([{ type: 'acted' }, { type: 'pause' }], started());
    expect(s.paused).toBe(true);
    s = run([{ type: 'dwell-over' }], s);
    expect(s.index).toBe(0);
    s = run([{ type: 'play' }, { type: 'dwell-over' }], s);
    expect(s).toMatchObject({ index: 1, paused: false });
  });

  it('Next moves on at once, also while the step is still reaching its target or paused', () => {
    expect(run([{ type: 'next' }], started()).index).toBe(1);
    expect(run([{ type: 'pause' }, { type: 'next' }], started())).toMatchObject({ index: 1, paused: false });
  });

  it('Let me do it waits on the same step; the visitor’s action moves on and stays hands-on', () => {
    let s = run([{ type: 'hands-on' }], started());
    expect(s).toMatchObject({ index: 0, mode: 'hands', stage: 'wait-user' });
    expect(run([{ type: 'dwell-over' }], s).index).toBe(0);
    s = run([{ type: 'acted' }], s);
    expect(s).toMatchObject({ index: 1, mode: 'hands', stage: 'wait-user' });
    s = run([{ type: 'show-me' }], s);
    expect(s).toMatchObject({ index: 1, mode: 'auto', stage: 'reach' });
  });

  it('a missing target skips the step and the tour goes on', () => {
    const s = run([{ type: 'failed' }], started());
    expect(s).toMatchObject({ phase: 'running', index: 1, skips: 1 });
    expect(run([{ type: 'acted' }], s).skips).toBe(0);
  });

  it(`ends after ${MAX_SKIPS_IN_ROW} skipped steps in a row, with the ended card`, () => {
    const s = run([{ type: 'failed' }, { type: 'failed' }], started());
    expect(s).toMatchObject({ phase: 'ended', reason: 'failed' });
    expect(run([{ type: 'next' }, { type: 'acted' }], s).phase).toBe('ended');
    expect(run([{ type: 'close' }], s).phase).toBe('off');
    const apart = run([{ type: 'failed' }, { type: 'acted' }, { type: 'dwell-over' }, { type: 'failed' }], started());
    expect(apart).toMatchObject({ phase: 'running', index: 3 });
  });

  it('a detour offers Resume or End; Resume replays the step with the way back', () => {
    const lost = run([{ type: 'hands-on' }, { type: 'lost' }], started());
    expect(lost.phase).toBe('lost');
    expect(run([{ type: 'resume' }], lost)).toMatchObject({ phase: 'running', index: 0, mode: 'auto', recover: true });
    expect(run([{ type: 'end' }], lost)).toMatchObject({ phase: 'off', reason: 'skipped' });
  });

  it('Skip tour and Escape (the end event) stop at once from any stage, with no pause left', () => {
    for (const before of [[], [{ type: 'pause' }], [{ type: 'acted' }, { type: 'pause' }], [{ type: 'hands-on' }]] as TourEvent[][]) {
      const s = run([...before, { type: 'end' }], started());
      expect(s).toMatchObject({ phase: 'off', paused: false, reason: 'skipped' });
      expect(run([{ type: 'acted' }, { type: 'dwell-over' }, { type: 'next' }], s).phase).toBe('off');
    }
  });

  it('can start again after an end', () => {
    const s = run([{ type: 'end' }, { type: 'start' }], run([{ type: 'next' }], started()));
    expect(s).toMatchObject({ phase: 'running', index: 0, skips: 0 });
  });

  it('reads longer captions for longer, between 2.5 and 4 s', () => {
    expect(dwellMs('Go.')).toBe(2500);
    expect(dwellMs('one two three four five six seven eight')).toBeGreaterThan(2500);
    expect(dwellMs('word '.repeat(40))).toBe(4000);
  });
});

describe('cleanup scope', () => {
  afterEach(() => vi.useRealTimers());

  it('drops every timer and listener on dispose', () => {
    vi.useFakeTimers();
    const scope = createScope(), target = new EventTarget(), fn = vi.fn(), later = vi.fn();
    scope.listen(target, 'ping', fn);
    scope.timeout(later, 1000);
    expect(scope.pending).toBe(2);
    scope.dispose();
    target.dispatchEvent(new Event('ping'));
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
    expect(later).not.toHaveBeenCalled();
    expect(scope.pending).toBe(0);
    scope.timeout(later, 10);
    vi.advanceTimersByTime(20);
    expect(later).not.toHaveBeenCalled();
  });
});

describe('first-visit memory', () => {
  it('remembers Not now, started and finished', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(tourMemory(() => store).seen()).toBe(false);
    tourMemory(() => store).remember('dismissed');
    expect(data.get(TOUR_KEY)).toBe('dismissed');
    expect(tourMemory(() => store).seen()).toBe(true);
  });

  it('works when storage throws, remembering until reload', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const m = tourMemory(() => broken);
    expect(m.seen()).toBe(false);
    expect(() => m.remember('dismissed')).not.toThrow();
    expect(m.seen()).toBe(true);
    const noAccess = tourMemory(() => { throw new Error('SecurityError'); });
    expect(noAccess.seen()).toBe(false);
    expect(() => noAccess.remember('finished')).not.toThrow();
  });
});

describe('caption card placement', () => {
  const card = { width: 320, height: 140 };
  const inside = (p: { left: number; top: number }, view: { width: number; height: number }) =>
    p.left >= 0 && p.top >= 0 && p.left + card.width <= view.width && p.top + card.height <= view.height;
  const covers = (p: { left: number; top: number }, t: { left: number; top: number; width: number; height: number }) =>
    p.left < t.left + t.width && p.left + card.width > t.left && p.top < t.top + t.height && p.top + card.height > t.top;

  it('sits beside the target without covering it, and flips at the window edge', () => {
    const view = { width: 1280, height: 800 };
    const left = { left: 40, top: 300, width: 200, height: 40 }, right = { left: 1080, top: 300, width: 160, height: 40 };
    expect(placeCard(left, card, view).side).toBe('right');
    expect(placeCard(right, card, view).side).toBe('left');
    for (const t of [left, right]) { const p = placeCard(t, card, view); expect(inside(p, view)).toBe(true); expect(covers(p, t)).toBe(false); }
  });

  for (const view of [{ width: 800, height: 600 }, { width: 768, height: 1024 }]) {
    it(`stays inside a ${view.width} x ${view.height} window and clear of a wide target`, () => {
      const wide = { left: 20, top: 60, width: view.width - 40, height: 44 };
      const p = placeCard(wide, card, view);
      expect(inside(p, view)).toBe(true);
      expect(covers(p, wide)).toBe(false);
      const bottom = { left: 20, top: view.height - 70, width: view.width - 40, height: 48 };
      const q = placeCard(bottom, card, view);
      expect(q.side).toBe('above');
      expect(inside(q, view)).toBe(true);
    });
  }

  it('without a target it sits at the bottom centre', () => {
    const p = placeCard(null, card, { width: 1000, height: 700 });
    expect(p.side).toBe('free');
    expect(Math.round(p.left)).toBe(340);
  });
});
