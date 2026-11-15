import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL, MAX_SKIPS_IN_ROW, cardText, dwellMs, overlay, reduce, restorePath, type TourEvent, type TourState, type TourStep } from './engine';
import { TOUR_MARKS, TOUR_NODES, sweepTour } from './dom';
import { NEAR, placeCard } from './layout';
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
    expect(s).toMatchObject({ phase: 'running', index: 0, mode: 'hands', stage: 'wait-user', paused: false, once: false });
  });

  it('is hands-on by default: it never clicks by itself, the visitor action moves on', () => {
    let s = started();
    expect(s.mode).toBe('hands');
    expect(run([{ type: 'dwell-over' }], s).index).toBe(0);
    for (let i = 1; i < N; i++) {
      s = run([{ type: 'acted' }], s);
      expect(s).toMatchObject({ phase: 'running', index: i, mode: 'hands', stage: 'wait-user' });
    }
    expect(run([{ type: 'acted' }], s)).toMatchObject({ phase: 'off', reason: 'finished' });
  });

  it('hands-on Next on an undone action step does that one step, then waits for the visitor again', () => {
    let s = run([{ type: 'next', act: true }], started());
    expect(s).toMatchObject({ index: 0, mode: 'hands', stage: 'reach', once: true });
    s = run([{ type: 'acted' }], s);
    expect(s).toMatchObject({ index: 1, mode: 'hands', stage: 'wait-user', once: false });
    expect(run([{ type: 'next' }], started())).toMatchObject({ index: 1, stage: 'wait-user' });
    expect(run([{ type: 'next', act: true }, { type: 'next' }], started())).toMatchObject({ index: 1, once: false, stage: 'wait-user' });
    const auto = run([{ type: 'show-me' }, { type: 'next', act: true }], started());
    expect(auto).toMatchObject({ index: 1, mode: 'auto', once: false });
  });

  it('Show me plays the current step and the rest while it stays on; Let me do it returns', () => {
    let s = run([{ type: 'show-me' }], started());
    expect(s).toMatchObject({ index: 0, mode: 'auto', stage: 'reach' });
    s = run([{ type: 'acted' }], s);
    expect(s.stage).toBe('dwell');
    s = run([{ type: 'dwell-over' }], s);
    expect(s).toMatchObject({ index: 1, mode: 'auto', stage: 'reach' });
    expect(run([{ type: 'hands-on' }], s)).toMatchObject({ index: 1, mode: 'hands', stage: 'wait-user' });
    // The tour already did the step: back by hand on the next one.
    expect(run([{ type: 'acted' }, { type: 'hands-on' }], s)).toMatchObject({ index: 2, mode: 'hands', stage: 'wait-user' });
  });

  it('Previous goes one card back, keeps the mode and asks for the app state to be restored', () => {
    expect(run([{ type: 'back' }], started())).toEqual(started());
    const two = run([{ type: 'acted' }, { type: 'acted' }], started());
    const back = run([{ type: 'back' }], two);
    expect(back).toMatchObject({ phase: 'running', index: 1, mode: 'hands', stage: 'wait-user', recover: true, skips: 0 });
    expect(back.run).not.toBe(two.run);
    expect(run([{ type: 'acted' }], back)).toMatchObject({ index: 2, recover: false });
    const auto = run([{ type: 'show-me' }, { type: 'acted' }, { type: 'dwell-over' }, { type: 'back' }], started());
    expect(auto).toMatchObject({ index: 0, mode: 'auto', stage: 'reach', recover: true });
    const ended = run([{ type: 'failed' }, { type: 'failed' }], started());
    expect(run([{ type: 'back' }], ended).phase).toBe('ended');
  });

  it('restoring a step stops a running preview outside the helmet, then walks the way into the chapter', () => {
    const recover = { Station: ['close-tablet'], Tablet: ['tablet-tab'], Helmet: ['tablet-tab', 'routes-tab', 'preview-route'] };
    const tablet: TourStep = { id: 'p', chapter: 'Tablet', target: 'preview-route', action: 'click', via: ['routes-tab'], caption: 'c', doIt: 'd' };
    expect(restorePath(tablet, recover, true)).toEqual(['preview-stop', 'tablet-tab', 'routes-tab']);
    expect(restorePath(tablet, recover, false)).toEqual(['tablet-tab', 'routes-tab']);
    const helmet: TourStep = { id: 'h', chapter: 'Helmet', target: 'hud-compass', action: 'point', caption: 'c', doIt: 'd' };
    expect(restorePath(helmet, recover, true)).toEqual(['tablet-tab', 'routes-tab', 'preview-route']);
  });

  it('a step whose control cannot be brought back shows as an explanation, and Next still moves on', () => {
    const step: TourStep = { id: 'x', chapter: 'Station', target: 't', action: 'click', caption: 'Gale is the region.', doIt: 'Click Gale.' };
    expect(cardText(step, 'hands', false)).toBe('Click Gale.');
    expect(cardText(step, 'hands', true)).toBe('Gale is the region.');
    expect(cardText(step, 'auto', false)).toBe('Gale is the region.');
    const back = run([{ type: 'acted' }, { type: 'back' }], started());
    expect(run([{ type: 'next' }], back)).toMatchObject({ index: 1, recover: false });
  });

  it('with Show me on, plays the steps in order: act, read, next step', () => {
    let s = run([{ type: 'show-me' }], started());
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
    const a = started(), b = run([{ type: 'next' }], a), c = run([{ type: 'show-me' }], b), d = run([{ type: 'hands-on' }], c);
    expect(new Set([a.run, b.run, c.run, d.run]).size).toBe(4);
  });

  it('pause holds the dwell, play releases it', () => {
    let s = run([{ type: 'show-me' }, { type: 'acted' }, { type: 'pause' }], started());
    expect(s.paused).toBe(true);
    s = run([{ type: 'dwell-over' }], s);
    expect(s.index).toBe(0);
    s = run([{ type: 'play' }, { type: 'dwell-over' }], s);
    expect(s).toMatchObject({ index: 1, paused: false });
    expect(run([{ type: 'pause' }], started()).paused).toBe(false);
  });

  it('Next moves on at once, also while the step is still reaching its target or paused', () => {
    expect(run([{ type: 'next' }], started()).index).toBe(1);
    expect(run([{ type: 'show-me' }, { type: 'pause' }, { type: 'next' }], started())).toMatchObject({ index: 1, paused: false });
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
    const lost = run([{ type: 'lost' }], started());
    expect(lost.phase).toBe('lost');
    expect(run([{ type: 'resume' }], lost)).toMatchObject({ phase: 'running', index: 0, mode: 'hands', recover: true });
    expect(run([{ type: 'show-me' }, { type: 'lost' }, { type: 'resume' }], started())).toMatchObject({ mode: 'auto', recover: true });
    expect(run([{ type: 'end' }], lost)).toMatchObject({ phase: 'off', reason: 'skipped' });
  });

  const stages: TourEvent[][] = [[], [{ type: 'next', act: true }], [{ type: 'acted' }, { type: 'back' }], [{ type: 'show-me' }],
    [{ type: 'show-me' }, { type: 'pause' }], [{ type: 'show-me' }, { type: 'acted' }, { type: 'pause' }], [{ type: 'lost' }]];

  it('Skip tour and Escape (the end event) stop at once from any stage, with no pause left', () => {
    for (const before of stages) {
      const s = run([...before, { type: 'end' }], started());
      expect(s).toMatchObject({ phase: 'off', paused: false, reason: 'skipped' });
      expect(run([{ type: 'acted' }, { type: 'dwell-over' }, { type: 'next' }, { type: 'back' }], s).phase).toBe('off');
    }
  });

  it('once the tour is off, after Skip, Finish, Escape or Close, nothing of it stays mounted: no layer, ring or pointer', () => {
    const ends: TourState[] = [
      ...stages.map(before => run([...before, { type: 'end' }], started())),
      run([{ type: 'acted' }, { type: 'acted' }, { type: 'acted' }, { type: 'acted' }, { type: 'next' }], started()),
      run([{ type: 'failed' }, { type: 'failed' }, { type: 'close' }], started()),
      run([{ type: 'invite' }, { type: 'end' }]),
      run([{ type: 'invite' }, { type: 'not-now' }]),
    ];
    for (const s of ends) {
      expect(s.phase).toBe('off');
      expect(overlay(s.phase)).toEqual({ layer: false, marks: false });
    }
    expect(overlay('ended')).toEqual({ layer: true, marks: false });
    expect(overlay('running').marks).toBe(true);
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

describe('total cleanup after the tour ends', () => {
  /** A small stand-in for the page: elements with classes and attributes, matched like the tour's selectors. */
  function page() {
    type El = { cls: string[]; attrs: Set<string>; remove(): void; removeAttribute(n: string): void };
    const nodes: El[] = [], root = new Set<string>(['data-tour-invite']);
    const el = (cls: string[], attrs: string[] = []): El => {
      const e: El = { cls, attrs: new Set(attrs), remove: () => { const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); }, removeAttribute: n => void e.attrs.delete(n) };
      nodes.push(e);
      return e;
    };
    const tourClasses = TOUR_NODES.split(',').map(s => s.trim().replace(/^\./, ''));
    const doc = {
      documentElement: { removeAttribute: (n: string) => void root.delete(n) },
      querySelectorAll(sel: string) {
        if (sel === TOUR_NODES) return nodes.filter(n => n.cls.some(c => tourClasses.includes(c)));
        const attr = /^\[([\w-]+)\]$/.exec(sel);
        if (attr) return nodes.filter(n => n.attrs.has(attr[1]));
        throw new Error(`unexpected selector ${sel}`);
      },
    };
    return { nodes, root, el, doc };
  }

  it('removes every ring, glow, pointer and tour node, keeps the app, and can run again', () => {
    const p = page();
    const button = p.el(['region-card'], ['data-tour', 'data-tour-invite']);
    p.el(['tour-layer']); p.el(['tour-ring', 'is-in']); p.el(['tour-pointer', 'is-pressing']); p.el(['tour-card', 'tour-ui']); p.el(['tour-invite']);
    sweepTour(p.doc);
    expect(p.nodes).toEqual([button]);
    expect(p.doc.querySelectorAll(TOUR_NODES)).toHaveLength(0);
    for (const m of TOUR_MARKS) { expect(p.root.has(m)).toBe(false); expect(p.doc.querySelectorAll(`[${m}]`)).toHaveLength(0); }
    expect(button.attrs.has('data-tour')).toBe(true);
    expect(() => sweepTour(p.doc)).not.toThrow();
    expect(p.nodes).toEqual([button]);
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

  it('at 800 x 655 never covers the target or the preview controls, and keeps off busy context where it can', () => {
    const view = { width: 800, height: 655 };
    const preview = { left: 140, top: 515, width: 520, height: 125 };
    const stop = { left: 560, top: 590, width: 80, height: 40 };
    const p = placeCard(stop, card, view, { keep: [preview] });
    expect(inside(p, view)).toBe(true);
    expect(covers(p, stop)).toBe(false);
    expect(covers(p, preview)).toBe(false);
    const nav = { left: 0, top: 0, width: 800, height: 56 }, header = { left: 0, top: 56, width: 800, height: 60 };
    const regionCard = { left: 20, top: 120, width: 260, height: 60 }, regionLabel = { left: 300, top: 420, width: 310, height: 200 };
    const q = placeCard(regionCard, card, view, { busy: [nav, header, regionLabel] });
    for (const b of [regionCard, nav, header, regionLabel]) expect(covers(q, b)).toBe(false);
  });

  it('in the helmet sits at its calm spot left middle while that spot is clear, and moves only off a kept box', () => {
    const view = { width: 800, height: 655 }, home = { left: 24, top: (655 - card.height) / 2 };
    const compass = { left: 280, top: 20, width: 240, height: 50 }, minimap = { left: 650, top: 60, width: 130, height: 180 };
    const p = placeCard(compass, card, view, { keep: [minimap], home });
    expect([p.left, p.top]).toEqual([24, home.top]);
    const overHome = { left: 30, top: 300, width: 60, height: 40 };
    const q = placeCard(overHome, card, view, { home });
    expect(covers(q, overHome)).toBe(false);
    expect(placeCard(null, card, view, { keep: [{ left: 140, top: 515, width: 520, height: 125 }], home }).top).toBe(home.top);
  });

  it('a card that cannot avoid a busy area covers as little of it as it can, never the target', () => {
    const view = { width: 800, height: 655 };
    const sidebarItem = { left: 12, top: 140, width: 300, height: 40 }, map = { left: 330, top: 116, width: 470, height: 480 };
    const p = placeCard(sidebarItem, card, view, { busy: [map] });
    expect(covers(p, sidebarItem)).toBe(false);
    const area = (x: { left: number; top: number }) => Math.max(0, Math.min(x.left + card.width, map.left + map.width) - Math.max(x.left, map.left)) * Math.max(0, Math.min(x.top + card.height, map.top + map.height) - Math.max(x.top, map.top));
    expect(area(p)).toBeLessThan(card.width * card.height / 2);
  });

  it('keeps its place while it is clear of the new target and near it, else moves beside it', () => {
    const view = { width: 1280, height: 800 };
    const a = { left: 40, top: 300, width: 200, height: 40 };
    const first = placeCard(a, card, view);
    const nearTarget = { left: 40, top: 380, width: 200, height: 40 };
    expect(placeCard(nearTarget, card, view, { stay: first })).toMatchObject({ left: first.left, top: first.top });
    const over = { left: first.left + 10, top: first.top + 10, width: 80, height: 30 };
    const moved = placeCard(over, card, view, { stay: first });
    expect(covers(moved, over)).toBe(false);
    const far = { left: first.left + card.width + NEAR + 200, top: 600, width: 100, height: 40 };
    expect(placeCard(far, card, view, { stay: first })).not.toMatchObject({ left: first.left, top: first.top });
    expect(placeCard(null, card, view, { stay: first })).toMatchObject({ left: first.left, top: first.top });
    const keep = { left: first.left, top: first.top, width: 40, height: 40 };
    expect(covers(placeCard(null, card, view, { stay: first, keep: [keep] }), keep)).toBe(false);
  });

  it('in the helmet the calm spot wins over keeping the place', () => {
    const view = { width: 800, height: 655 }, home = { left: 24, top: (655 - card.height) / 2 };
    const compass = { left: 280, top: 20, width: 240, height: 50 };
    expect(placeCard(compass, card, view, { home, stay: { left: 400, top: 300 } })).toMatchObject({ left: 24, top: home.top });
  });

  it('without a target it sits at the bottom centre', () => {
    const p = placeCard(null, card, { width: 1000, height: 700 });
    expect(p.side).toBe('free');
    expect(Math.round(p.left)).toBe(340);
  });
});
