import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../design/icons';
import { INITIAL, cardText, dwellMs, inPlace, overlay, placePath, reduce, restorePath, type TourEvent, type TourStep } from './engine';
import { boxes, bringIntoView, centre, present, pressed, ready, reducedMotion, shownRect, sweepTour, visible } from './dom';
import { placeCard } from './layout';
import { tourMemory } from './memory';
import { createScope, type Scope } from './scope';
import { RECOVER, STEPS } from './steps';

const TIMEOUT_MS = 6000, POLL_MS = 150, LOST_AFTER_MS = 1500, RING_PAD = 6;
/** The caption card glides this long to a new place; a shift smaller than CARD_SNAP_PX follows the layout at once. */
const CARD_GLIDE_MS = 620, CARD_SNAP_PX = 24;
/** Key context the caption card covers as little as it can, in every step. */
const BUSY = ['.mission-nav', '.context-bar', '.tablet-header', '.tablet-tabs', '.tablet-footer'];
/** The helmet view: the card sits left middle, never over these. */
const HELMET_KEEP = ['[data-tour="preview-controls"]', '[data-tour="hud-compass"]', '.hud-corner', '.hud-heading', '.hud-alerts'];
/** Globe ready: the first imagery frame is drawn (GlobeExplorer sets data-ready). */
const globeReady = () => !!document.querySelector('[data-tour="globe"][data-ready="true"]');

interface TourApi { start: () => void; active: boolean }
const TourContext = createContext<TourApi>({ start: () => {}, active: false });
export const useTour = () => useContext(TourContext);

/** The "Tour" entry beside the Station and Tablet help marks. */
export function TourStartButton({ tour }: { tour: string }) {
  const t = useTour();
  return <button type="button" className="tour-entry" data-tour={tour} disabled={t.active} title="Take the 2 minute tour on the real app" onClick={t.start}><Icon name="play" />Tour</button>;
}

type Pending = { reclick?: HTMLElement; restore?: string; flipBack?: HTMLElement };

function waitFor<T>(scope: Scope, read: () => T | null | undefined | false, ms: number): Promise<T | null> {
  const until = performance.now() + ms;
  return new Promise(resolve => {
    const check = () => {
      const value = read();
      if (value) resolve(value);
      else if (performance.now() >= until) resolve(null);
      else scope.timeout(check, POLL_MS);
    };
    check();
  });
}

const ease = (k: number) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

/**
 * Runs the tour on the real app. By default the ring marks each data-tour anchor and the tour waits for the visitor
 * to use it. With Show me a drawn pointer glides to the anchor and clicks it with .click(); the next step waits until
 * the app shows the expected result. The state machine lives in engine.ts.
 */
export default function TourProvider({ children }: { children: ReactNode }) {
  const memory = useMemo(() => tourMemory(), []);
  const [state, setState] = useState(INITIAL);
  const send = useCallback((e: TourEvent) => setState(s => reduce(s, e, STEPS.length)), []);
  const paused = useRef(false); paused.current = state.paused;
  const pointer = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null);
  const ringTarget = useRef<HTMLElement | null>(null), ringFor = useRef<HTMLElement | null>(null);
  // The card's place now, where it heads, and the glide between them.
  const cardAt = useRef<{ left: number; top: number } | null>(null), cardGoal = useRef<{ left: number; top: number } | null>(null);
  const cardGlide = useRef<{ from: { left: number; top: number }; t0: number } | null>(null);
  // The step's control could not be brought back: the card explains it, without a ring.
  const [explain, setExplain] = useState(false);
  // True while the tour brings the app into the step's place: the card shows once it is there.
  const hideCard = useRef(false);
  const pointerAt = useRef({ x: 0, y: 0 });
  // The element the pointer rests on between glides, so it stays on it when the window is resized.
  const pointerOn = useRef<HTMLElement | null>(null), gliding = useRef(false);
  // The step whose caption shows. It changes together with the ring, once the new target is found and in view.
  const [shown, setShown] = useState(-1);
  const pending = useRef<Pending | null>(null);
  const previewByTour = useRef(false);
  const lastTouch = useRef(0), lastActed = useRef(0);
  const live = state.phase === 'running' || state.phase === 'lost';
  const step: TourStep | undefined = STEPS[state.index];
  const shownIndex = state.phase === 'running' && state.stage === 'reach' && shown >= 0 && shown < STEPS.length ? shown : state.index;
  const at = useRef({ index: shownIndex, phase: state.phase }); at.current = { index: shownIndex, phase: state.phase };

  const showPointer = (on: boolean) => { if (pointer.current) pointer.current.dataset.shown = on ? 'true' : 'false'; };

  const start = useCallback(() => {
    memory.remember('started');
    previewByTour.current = false; pending.current = null; lastActed.current = performance.now();
    pointerAt.current = { x: window.innerWidth * .5, y: window.innerHeight * .72 }; pointerOn.current = null;
    cardAt.current = null; cardGoal.current = null; cardGlide.current = null; ringFor.current = null;
    hideCard.current = false;
    setShown(-1); setExplain(false);
    send({ type: 'start' });
  }, [memory, send]);

  // First visit: invite once the Station is on screen and Mars is drawn on the globe. Never starts by itself.
  useEffect(() => {
    if (memory.seen()) return;
    const scope = createScope();
    const look = () => { if (ready('atlas-tab') && globeReady()) send({ type: 'invite' }); else scope.timeout(look, 500); };
    look();
    return () => scope.dispose();
  }, [memory, send]);

  // The invitation belongs to the Station: it steps aside while the tablet or the helmet is open. While it shows,
  // the globe's footer hints (bottom right, under the card) are hidden.
  const invite = useRef<HTMLElement>(null);
  useEffect(() => {
    if (state.phase !== 'invite') return;
    const scope = createScope(), root = document.documentElement;
    const look = () => {
      const on = !!ready('atlas-tab');
      if (invite.current) invite.current.hidden = !on;
      if (on) root.dataset.tourInvite = 'true'; else delete root.dataset.tourInvite;
      scope.timeout(look, 400);
    };
    look();
    return () => { scope.dispose(); delete root.dataset.tourInvite; };
  }, [state.phase]);

  useEffect(() => { if (state.phase === 'off' && state.reason === 'finished') memory.remember('finished'); }, [state.phase, state.reason, memory]);

  // Undo a step's own side effect (an open info label, a switched route view or walk choice).
  const leave = useCallback(async (scope: Scope | null, animate: boolean) => {
    const p = pending.current; pending.current = null;
    if (!p) return;
    if (p.reclick?.isConnected && p.reclick.getAttribute('aria-expanded') === 'true') p.reclick.click();
    if (p.flipBack?.isConnected && visible(p.flipBack) && !(p.flipBack as HTMLInputElement).disabled) p.flipBack.click();
    const el = p.restore ? ready(p.restore) : null;
    if (!el || pressed(el)) return;
    if (animate && scope) {
      if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 400);
      await glide(scope, el);
      await press(scope);
    }
    if (scope?.disposed) return;
    el.click();
    if (scope) await scope.sleep(250);
  }, []);

  function note(s: TourStep, el: HTMLElement) {
    const before = s.leave?.restorePressed?.find(name => pressed(ready(name)));
    pending.current = s.leave ? { reclick: s.leave.reclickIfExpanded ? el : undefined, restore: before } : null;
    if (s.target === 'preview-route') previewByTour.current = true;
    if (s.target === 'preview-stop') previewByTour.current = false;
  }

  /** Glides to the centre of an element (and then rests on it) or to a point that moves with the layout. */
  function glide(scope: Scope, target: HTMLElement | (() => { x: number; y: number }), ms?: number): Promise<void> {
    const to = typeof target === 'function' ? target : () => centre(target);
    const rest = typeof target === 'function' ? null : target;
    const from = { ...pointerAt.current }, first = to();
    const dur = reducedMotion() ? 0 : ms ?? Math.max(600, Math.min(900, 500 + Math.hypot(first.x - from.x, first.y - from.y) * .6));
    pointerOn.current = null;
    if (!dur) { pointerAt.current = first; pointerOn.current = rest; return Promise.resolve(); }
    gliding.current = true;
    return new Promise(resolve => {
      let t0: number | undefined;
      const frame = (now: number) => {
        t0 ??= now;
        const k = Math.min(1, (now - t0) / dur), e = ease(k), end = to();
        pointerAt.current = { x: from.x + (end.x - from.x) * e, y: from.y + (end.y - from.y) * e };
        if (k < 1) scope.frame(frame); else { gliding.current = false; pointerOn.current = rest; resolve(); }
      };
      scope.frame(frame);
    });
  }

  /** The new step's caption and its ring appear together, on the target that is now found and in view. */
  function reveal(index: number, el: HTMLElement | null) {
    ringTarget.current = el;
    setShown(index);
  }

  async function press(scope: Scope) {
    pointer.current?.classList.add('is-pressing');
    await scope.sleep(reducedMotion() ? 60 : 180);
    pointer.current?.classList.remove('is-pressing');
  }

  async function gate(scope: Scope) { while (paused.current) await scope.sleep(100); }

  const failure = (): TourEvent => lastTouch.current > lastActed.current ? { type: 'lost' } : { type: 'failed' };

  /**
   * Previous and Resume: bring the app back to the state the step needs with its own controls. A preview that runs is
   * stopped for a step outside the helmet; then the way into the step's chapter and its via controls are clicked
   * until the step's control is ready.
   */
  async function restore(scope: Scope, s: TourStep) {
    const path = restorePath(s, RECOVER, !!present('preview-controls'));
    for (let i = 0; i < path.length; i++) {
      const name = path[i];
      if (name !== 'preview-stop' && ready(s.target)) break;
      const el = ready(name);
      if (!el) continue;
      if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 400);
      if (scope.disposed) return;
      el.click();
      if (name === 'preview-route') previewByTour.current = true;
      if (name === 'preview-stop') previewByTour.current = false;
      await waitFor(scope, () => (name !== 'preview-stop' && ready(s.target)) || path.slice(i + 1).some(n => present(n)), 2500);
    }
    await waitFor(scope, () => present(s.target), 600);
  }

  const probe = { present: (n: string) => !!present(n), pressed: (n: string) => pressed(present(n)) };

  /**
   * Start and Next: when the app is not in the place the step's chapter needs (the tablet is open for a Station step,
   * say), the tour brings it there with the real controls. The card stays hidden until it is there.
   */
  async function place(scope: Scope, s: TourStep) {
    if (inPlace(s.chapter, probe)) return;
    hideCard.current = true;
    const path = placePath(s, RECOVER, !!present('preview-controls'));
    for (let i = 0; i < path.length; i++) {
      const name = path[i];
      if (name !== 'preview-stop' && inPlace(s.chapter, probe)) break;
      const el = ready(name);
      if (!el) continue;
      if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 400);
      if (scope.disposed) return;
      el.click();
      if (name === 'preview-route') previewByTour.current = true;
      if (name === 'preview-stop') previewByTour.current = false;
      await waitFor(scope, () => (name !== 'preview-stop' && inPlace(s.chapter, probe)) || path.slice(i + 1).some(n => present(n)), 2500);
    }
    await waitFor(scope, () => inPlace(s.chapter, probe), 800);
    if (!scope.disposed) hideCard.current = false;
  }

  async function auto(scope: Scope, s: TourStep, index: number, recover: boolean): Promise<TourEvent> {
    // Between steps no ring shows: the previous caption stays until this step's target is found and in view.
    ringTarget.current = null; gliding.current = false;
    setExplain(false);
    await leave(scope, true);
    hideCard.current = false;
    if (recover) await restore(scope, s); else await place(scope, s);
    if (scope.disposed) return { type: 'failed' };
    const withPointer = s.pointer !== false;
    showPointer(withPointer);
    const path = s.via ?? [];
    for (let i = 0; i < path.length; i++) {
      if (ready(s.target)) break;
      const el = ready(path[i]);
      if (!el) continue;
      await gate(scope);
      if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 400);
      if (withPointer) { await glide(scope, el); await press(scope); }
      if (scope.disposed) return { type: 'failed' };
      el.click();
      await waitFor(scope, () => ready(s.target) || path.slice(i + 1).some(n => present(n)), 3000);
    }
    const timeout = s.timeoutMs ?? TIMEOUT_MS;
    const el = await waitFor(scope, () => ready(s.target), s.optional ? 1200 : timeout);
    if (!el) {
      if (!s.optional) return failure();
      reveal(index, null);
      return { type: 'acted' };
    }
    await gate(scope);
    if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 450);
    if (scope.disposed) return { type: 'failed' };
    if (withPointer) await glide(scope, el);
    reveal(index, el);
    if (s.action === 'click') {
      await press(scope);
      if (scope.disposed) return { type: 'failed' };
      note(s, el);
      el.click();
      if (s.flip) {
        // A switch that was on hid its mark: switch it back on, so the visitor sees the mark appear and nothing is changed.
        if (!await waitFor(scope, () => present(s.flip!), 700)) {
          await scope.sleep(reducedMotion() ? 50 : 600);
          await press(scope);
          if (scope.disposed) return { type: 'failed' };
          el.click();
        } else pending.current = { ...pending.current, flipBack: el };
      }
    } else if (s.action === 'drag' && withPointer) {
      pointerOn.current = null;
      pointer.current?.classList.add('is-pressing');
      const c = centre(el), dx = Math.min(140, el.getBoundingClientRect().width / 5);
      await glide(scope, () => ({ x: c.x - dx, y: c.y }), 500);
      await glide(scope, () => ({ x: c.x + dx, y: c.y + 10 }), 900);
      pointer.current?.classList.remove('is-pressing');
    }
    if (s.expect) { if (!await waitFor(scope, () => present(s.expect!), timeout)) return failure(); }
    else await scope.sleep(300);
    if (s.show) {
      const result = await waitFor(scope, () => present(s.show!), 1500);
      if (result) { if (bringIntoView(result)) await scope.sleep(reducedMotion() ? 50 : 400); ringTarget.current = result; }
    }
    return { type: 'acted' };
  }

  /** Hands-on: the ring marks the control (or the way to it) and the step moves on when the visitor uses it. */
  async function hands(scope: Scope, s: TourStep, index: number, recover: boolean) {
    await leave(null, false);
    if (scope.disposed) return;
    showPointer(false);
    gliding.current = false; pointerOn.current = null; hideCard.current = false;
    if (recover) {
      // Until the app is back in the step's state, the earlier card shows without a ring.
      ringTarget.current = null;
      setExplain(true); setShown(index);
      await restore(scope, s);
    } else {
      ringTarget.current = null;
      await place(scope, s);
    }
    if (scope.disposed) return;
    const reachable = () => !!present(s.target) || (s.via ?? []).some(n => !!present(n));
    await waitFor(scope, reachable, 1000);
    if (scope.disposed) return;
    // The control could not be brought back: the card explains the step and Next moves on. Never "left the path" here.
    const explainOnly = !reachable();
    setExplain(explainOnly);
    setShown(index);
    if (explainOnly) { ringTarget.current = null; return; }
    let missing: number | undefined, done = false;
    const tick = () => {
      if (done) return;
      const el = present(s.target) ?? (s.via ?? []).map(present).find(Boolean) ?? null;
      ringTarget.current = el;
      if (!el && s.action === 'click' && s.expect && present(s.expect)) {
        // The visitor already did it (the tablet is open, the preview has stopped): move on.
        done = true; lastActed.current = performance.now(); send({ type: 'acted' }); return;
      }
      if (!el && !s.optional) {
        missing ??= performance.now();
        if (performance.now() - missing > LOST_AFTER_MS) { send({ type: 'lost' }); return; }
      } else missing = undefined;
      scope.timeout(tick, POLL_MS);
    };
    tick();
    if (s.action === 'point') return;
    scope.listen(window, s.action === 'drag' ? 'pointerdown' : 'click', e => {
      if (done || !e.isTrusted) return;
      const el = present(s.target), hit = e.target as Node | null;
      if (!el || !hit || !(el.contains(hit) || el.closest('label')?.contains(hit))) return;
      done = true;
      note(s, el);
      void (async () => {
        if (s.expect) { if (!await waitFor(scope, () => present(s.expect!), s.timeoutMs ?? TIMEOUT_MS)) { send({ type: 'lost' }); return; } }
        else await scope.sleep(s.action === 'drag' ? 900 : 400);
        lastActed.current = performance.now();
        send({ type: 'acted' });
      })();
    }, true);
  }

  // One run per step entry: reach and act, read, or wait for the visitor.
  useEffect(() => {
    if (state.phase !== 'running' || !step) return;
    const scope = createScope();
    if (state.stage === 'reach') {
      void auto(scope, step, state.index, state.recover).then(e => {
        if (scope.disposed) return;
        if (e.type === 'acted') lastActed.current = performance.now();
        send(e);
      });
    } else if (state.stage === 'dwell' && !step.final) {
      let left = dwellMs(step.caption);
      const tick = () => { if (!paused.current) left -= 100; if (left <= 0) send({ type: 'dwell-over' }); else scope.timeout(tick, 100); };
      scope.timeout(tick, 100);
    } else if (state.stage === 'wait-user') void hands(scope, step, state.index, state.recover);
    return () => scope.dispose();
  }, [state.run, state.stage, state.phase]);

  // Leaving the tour: undo the open step's side effect, stop a preview the tour started, clear the pointer and ring.
  // Off: React has unmounted the whole tour layer by now; the sweep removes any stray node or mark, so nothing stays lit.
  useEffect(() => {
    if (state.phase === 'running') return;
    ringTarget.current = null; ringFor.current = null; pointerOn.current = null; gliding.current = false; hideCard.current = false;
    showPointer(false);
    if (ring.current) { ring.current.hidden = true; ring.current.classList.remove('is-in'); }
    pointer.current?.classList.remove('is-pressing');
    if (state.phase === 'ended' || state.phase === 'off') {
      void leave(null, false);
      if (previewByTour.current) { previewByTour.current = false; ready('preview-stop')?.click(); }
    }
    if (state.phase === 'off') sweepTour();
  }, [state.phase, leave]);

  // Visitor activity: a click outside the tour marks a possible detour; Escape ends the tour at once.
  useEffect(() => {
    if (!live && state.phase !== 'ended') return;
    const scope = createScope();
    scope.listen(window, 'pointerdown', e => { if (e.isTrusted && !(e.target as Element | null)?.closest?.('.tour-ui')) lastTouch.current = performance.now(); }, true);
    // Skip tour and End tour: caught first, on the window, so no app handler and no re-render of the card can swallow them.
    scope.listen(window, 'click', e => {
      if (!(e.target as Element | null)?.closest?.('.tour-ui [data-tour-end]')) return;
      e.preventDefault(); e.stopPropagation();
      send({ type: 'end' });
    }, true);
    scope.listen(window, 'keydown', e => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      send({ type: state.phase === 'ended' ? 'close' : 'end' });
    }, true);
    return () => scope.dispose();
  }, [live, state.phase, send]);

  // Ring, card and pointer follow the live layout every frame while the tour is on screen.
  useEffect(() => {
    if (state.phase === 'off' || state.phase === 'invite') return;
    const scope = createScope(), still = reducedMotion();
    const frame = (now: number) => {
      // The ring shows only the part of the target a visitor can see; a target scrolled out of its panel has no ring.
      const r = ringTarget.current ? shownRect(ringTarget.current) : null;
      let box: { left: number; top: number; width: number; height: number } | null = null;
      if (r) {
        const left = Math.max(2, r.left - RING_PAD), top = Math.max(2, r.top - RING_PAD);
        const right = Math.min(window.innerWidth - 2, r.right + RING_PAD), bottom = Math.min(window.innerHeight - 2, r.bottom + RING_PAD);
        if (right > left && bottom > top) box = { left, top, width: right - left, height: bottom - top };
      }
      const rg = ring.current;
      if (rg) {
        if (!box) { rg.hidden = true; rg.classList.remove('is-in'); ringFor.current = null; }
        else {
          rg.hidden = false;
          Object.assign(rg.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
          // A new target: the ring does not slide across the screen, it fades in where the target is.
          if (ringFor.current !== ringTarget.current) {
            rg.classList.remove('is-in');
            void rg.offsetWidth;
            rg.classList.add('is-in');
            ringFor.current = ringTarget.current;
          }
        }
      }
      const c = card.current, s = STEPS[at.current.index];
      if (c) {
        const view = { width: window.innerWidth, height: window.innerHeight }, size = { width: c.offsetWidth, height: c.offsetHeight };
        const helmet = s?.chapter === 'Helmet' && at.current.phase === 'running';
        const keep = boxes([...(s?.keep ?? []), '[data-tour="preview-controls"]', ...(helmet ? HELMET_KEEP : [])]);
        const busy = boxes([...BUSY, ...(s?.avoid ?? [])]);
        const spot = placeCard(box, size, view, { keep, busy, home: helmet ? { left: 24, top: (view.height - size.height) / 2 } : undefined, stay: cardGoal.current ?? undefined });
        const goal = { left: Math.round(spot.left), top: Math.round(spot.top) }, before = cardGoal.current;
        cardGoal.current = goal;
        if (!before || !cardAt.current || still) { cardGlide.current = null; cardAt.current = goal; }
        else {
          // A new place: glide there with an ease-in-out curve. A small shift (scroll, resize) follows at once.
          if (Math.hypot(goal.left - before.left, goal.top - before.top) > CARD_SNAP_PX) cardGlide.current = { from: { ...cardAt.current }, t0: now };
          const g = cardGlide.current;
          if (g) {
            const k = Math.min(1, (now - g.t0) / CARD_GLIDE_MS), e = ease(k);
            cardAt.current = { left: g.from.left + (goal.left - g.from.left) * e, top: g.from.top + (goal.top - g.from.top) * e };
            if (k >= 1) cardGlide.current = null;
          } else cardAt.current = goal;
        }
        c.style.transform = `translate(${Math.round(cardAt.current.left)}px, ${Math.round(cardAt.current.top)}px)`;
        c.style.visibility = hideCard.current ? 'hidden' : 'visible';
      }
      const rest = pointerOn.current;
      if (rest && !gliding.current && visible(rest)) pointerAt.current = centre(rest);
      if (pointer.current) pointer.current.style.transform = `translate(${pointerAt.current.x}px, ${pointerAt.current.y}px)`;
      scope.frame(frame);
    };
    scope.frame(frame);
    return () => scope.dispose();
  }, [state.phase]);

  const api = useMemo(() => ({ start, active: live }), [start, live]);
  const total = STEPS.length;
  const handsOn = state.mode === 'hands';

  // Hands-on Next on an action step the visitor has not done: the tour does it, so the next step finds its control.
  const next = () => {
    const s = STEPS[state.index];
    const act = !!s && state.phase === 'running' && handsOn && state.stage === 'wait-user' && s.action === 'click' && !explain
      && (!!ready(s.target) || (s.via ?? []).some(n => !!ready(n)));
    send({ type: 'next', act });
  };

  let body: ReactNode = null;
  if (state.phase === 'invite') {
    body = <section ref={invite} className="tour-invite tour-ui" role="dialog" aria-labelledby="tour-invite-title">
      <span className="eyebrow">First time here</span>
      <h2 id="tour-invite-title">Take the 2 minute tour</h2>
      <p>The tour marks the real controls and you use them, one step at a time.</p>
      <div className="tour-actions">
        <button type="button" className="tour-primary" onClick={start}>Start tour</button>
        <button type="button" className="tour-quiet" onClick={() => { memory.remember('dismissed'); send({ type: 'not-now' }); }}>Not now</button>
      </div>
    </section>;
  } else if (state.phase !== 'off' && step) {
    const seen = STEPS[shownIndex] ?? step;
    const head = <header className="tour-card__head"><span className="tour-card__chapter">{state.phase === 'ended' ? 'Tour' : seen.chapter}</span>{state.phase !== 'ended' && <span className="tour-card__count">{shownIndex + 1} of {total}</span>}</header>;
    let text: string, actions: ReactNode = null, nav: ReactNode = null;
    if (state.phase === 'ended') {
      text = 'Tour ended here. Start it again from Help.';
      actions = <button type="button" className="tour-primary" onClick={() => send({ type: 'close' })}>Close</button>;
    } else if (state.phase === 'lost') {
      text = 'You left the tour path. Pick up where you were, or end the tour.';
      nav = <button type="button" className="tour-primary" onClick={() => send({ type: 'resume' })}>Resume tour</button>;
      actions = <button type="button" className="tour-link" data-tour-end="" onClick={() => send({ type: 'end' })}>End tour</button>;
    } else {
      const previous = shownIndex > 0 && <button type="button" className="tour-quiet" onClick={() => send({ type: 'back' })}><Icon name="back" />Previous</button>;
      text = cardText(seen, state.mode, explain);
      if (seen.final) {
        nav = <>{previous}<button type="button" className="tour-primary" onClick={() => send({ type: 'next' })}>Finish</button></>;
      } else {
        nav = <>{previous}<button type="button" className="tour-primary" onClick={next}>Next<Icon name="next" /></button></>;
        actions = <>
          {handsOn
            ? !explain && <button type="button" className="tour-quiet" onClick={() => send({ type: 'show-me' })}><Icon name="play" />Show me</button>
            : <>
              <button type="button" className="tour-quiet" onClick={() => send({ type: 'hands-on' })}>Let me do it</button>
              <button type="button" className="tour-quiet" aria-pressed={state.paused} onClick={() => send({ type: state.paused ? 'play' : 'pause' })}><Icon name={state.paused ? 'play' : 'pause'} />{state.paused ? 'Play' : 'Pause'}</button>
            </>}
          <button type="button" className="tour-link" data-tour-end="" onClick={() => send({ type: 'end' })}>Skip tour</button>
        </>;
      }
    }
    body = <section ref={card} className="tour-card tour-ui" role="dialog" aria-label="Guided tour" style={{ visibility: 'hidden' }}>
      {head}
      <p className="tour-card__text" aria-live="polite">{text}</p>
      {state.phase === 'running' && <div className="tour-card__track" aria-hidden="true"><span style={{ width: `${((shownIndex + 1) / total) * 100}%` }} /></div>}
      {nav && <div className="tour-actions tour-actions--nav">{nav}</div>}
      {actions && <div className="tour-actions">{actions}</div>}
    </section>;
  }

  const parts = overlay(state.phase);
  return <TourContext.Provider value={api}>
    {children}
    {parts.layer && createPortal(<div className="tour-layer" data-phase={state.phase}>
      {parts.marks && <>
        <div ref={ring} className="tour-ring" hidden aria-hidden="true" />
        <div ref={pointer} className="tour-pointer" data-shown="false" aria-hidden="true">
          <svg viewBox="0 0 28 32" width="28" height="32"><path d="M3 2 L3 25 L9.2 19.6 L13.4 29 L17.6 27.2 L13.5 18 L22 18 Z" /></svg>
          <span className="tour-pointer__tap" />
        </div>
      </>}
      {body}
    </div>, document.body)}
  </TourContext.Provider>;
}
