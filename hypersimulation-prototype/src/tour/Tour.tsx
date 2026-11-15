import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../design/icons';
import { INITIAL, dwellMs, reduce, type TourEvent, type TourStep } from './engine';
import { bringIntoView, centre, present, pressed, ready, reducedMotion, visible } from './dom';
import { placeCard } from './layout';
import { tourMemory } from './memory';
import { createScope, type Scope } from './scope';
import { RECOVER, STEPS } from './steps';

const TIMEOUT_MS = 6000, POLL_MS = 150, LOST_AFTER_MS = 1500, RING_PAD = 6;

interface TourApi { start: () => void; active: boolean }
const TourContext = createContext<TourApi>({ start: () => {}, active: false });
export const useTour = () => useContext(TourContext);

/** The "Tour" entry beside the Station and Tablet help marks. */
export function TourStartButton({ tour }: { tour: string }) {
  const t = useTour();
  return <button type="button" className="tour-entry" data-tour={tour} disabled={t.active} title="Take the 2 minute tour on the real app" onClick={t.start}><Icon name="play" />Tour</button>;
}

type Pending = { reclick?: HTMLElement; restore?: string };

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
 * Plays the tour on the real app: a drawn pointer glides to each data-tour anchor, the anchor is clicked with .click(),
 * and the next step waits until the app shows the expected result. The state machine lives in engine.ts.
 */
export default function TourProvider({ children }: { children: ReactNode }) {
  const memory = useMemo(() => tourMemory(), []);
  const [state, setState] = useState(INITIAL);
  const send = useCallback((e: TourEvent) => setState(s => reduce(s, e, STEPS.length)), []);
  const paused = useRef(false); paused.current = state.paused;
  const pointer = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null);
  const ringTarget = useRef<HTMLElement | null>(null);
  const pointerAt = useRef({ x: 0, y: 0 });
  const pending = useRef<Pending | null>(null);
  const previewByTour = useRef(false);
  const lastTouch = useRef(0), lastActed = useRef(0);
  const live = state.phase === 'running' || state.phase === 'lost';
  const step: TourStep | undefined = STEPS[state.index];

  const showPointer = (on: boolean) => { if (pointer.current) pointer.current.dataset.shown = on ? 'true' : 'false'; };

  const start = useCallback(() => {
    memory.remember('started');
    previewByTour.current = false; pending.current = null; lastActed.current = performance.now();
    pointerAt.current = { x: window.innerWidth * .5, y: window.innerHeight * .72 };
    send({ type: 'start' });
  }, [memory, send]);

  // First visit: invite once the Station is on screen. Never starts by itself.
  useEffect(() => {
    if (memory.seen()) return;
    const scope = createScope();
    const look = () => { if (ready('atlas-tab')) send({ type: 'invite' }); else scope.timeout(look, 700); };
    look();
    return () => scope.dispose();
  }, [memory, send]);

  // The invitation belongs to the Station: it steps aside while the tablet or the helmet is open.
  const invite = useRef<HTMLElement>(null);
  useEffect(() => {
    if (state.phase !== 'invite') return;
    const scope = createScope();
    const look = () => { if (invite.current) invite.current.hidden = !ready('atlas-tab'); scope.timeout(look, 400); };
    look();
    return () => scope.dispose();
  }, [state.phase]);

  useEffect(() => { if (state.phase === 'off' && state.reason === 'finished') memory.remember('finished'); }, [state.phase, state.reason, memory]);

  // Undo a step's own side effect (an open info label, a switched route view or walk choice).
  const leave = useCallback(async (scope: Scope | null, animate: boolean) => {
    const p = pending.current; pending.current = null;
    if (!p) return;
    if (p.reclick?.isConnected && p.reclick.getAttribute('aria-expanded') === 'true') p.reclick.click();
    const el = p.restore ? ready(p.restore) : null;
    if (!el || pressed(el)) return;
    if (animate && scope) {
      if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 400);
      ringTarget.current = el;
      await glide(scope, () => centre(el));
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

  function glide(scope: Scope, to: () => { x: number; y: number }, ms?: number): Promise<void> {
    const from = { ...pointerAt.current }, first = to();
    const dur = reducedMotion() ? 0 : ms ?? Math.max(600, Math.min(900, 500 + Math.hypot(first.x - from.x, first.y - from.y) * .6));
    if (!dur) { pointerAt.current = first; return Promise.resolve(); }
    return new Promise(resolve => {
      let t0: number | undefined;
      const frame = (now: number) => {
        t0 ??= now;
        const k = Math.min(1, (now - t0) / dur), e = ease(k), end = to();
        pointerAt.current = { x: from.x + (end.x - from.x) * e, y: from.y + (end.y - from.y) * e };
        if (k < 1) scope.frame(frame); else resolve();
      };
      scope.frame(frame);
    });
  }

  async function press(scope: Scope) {
    pointer.current?.classList.add('is-pressing');
    await scope.sleep(reducedMotion() ? 60 : 180);
    pointer.current?.classList.remove('is-pressing');
  }

  async function gate(scope: Scope) { while (paused.current) await scope.sleep(100); }

  const failure = (): TourEvent => lastTouch.current > lastActed.current ? { type: 'lost' } : { type: 'failed' };

  async function auto(scope: Scope, s: TourStep, recover: boolean): Promise<TourEvent> {
    await leave(scope, true);
    const withPointer = s.pointer !== false;
    showPointer(withPointer);
    const path = [...(recover ? RECOVER[s.chapter] : []), ...(s.via ?? [])];
    for (let i = 0; i < path.length; i++) {
      if (ready(s.target)) break;
      const el = ready(path[i]);
      if (!el) continue;
      await gate(scope);
      if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 400);
      ringTarget.current = el;
      if (withPointer) { await glide(scope, () => centre(el)); await press(scope); }
      if (scope.disposed) return { type: 'failed' };
      el.click();
      await waitFor(scope, () => ready(s.target) || path.slice(i + 1).some(n => present(n)), 3000);
    }
    const timeout = s.timeoutMs ?? TIMEOUT_MS;
    const el = await waitFor(scope, () => ready(s.target), s.optional ? 1200 : timeout);
    if (!el) {
      if (!s.optional) return failure();
      ringTarget.current = null;
      return { type: 'acted' };
    }
    await gate(scope);
    if (bringIntoView(el)) await scope.sleep(reducedMotion() ? 50 : 450);
    ringTarget.current = el;
    if (withPointer) await glide(scope, () => centre(el));
    if (s.action === 'click') {
      await press(scope);
      if (scope.disposed) return { type: 'failed' };
      note(s, el);
      el.click();
    } else if (s.action === 'drag' && withPointer) {
      pointer.current?.classList.add('is-pressing');
      const c = centre(el), dx = Math.min(140, el.getBoundingClientRect().width / 5);
      await glide(scope, () => ({ x: c.x - dx, y: c.y }), 500);
      await glide(scope, () => ({ x: c.x + dx, y: c.y + 10 }), 900);
      pointer.current?.classList.remove('is-pressing');
    }
    if (s.expect) { if (!await waitFor(scope, () => present(s.expect!), timeout)) return failure(); }
    else await scope.sleep(300);
    if (s.show) {
      const shown = await waitFor(scope, () => present(s.show!), 1500);
      if (shown) { if (bringIntoView(shown)) await scope.sleep(reducedMotion() ? 50 : 400); ringTarget.current = shown; }
    }
    return { type: 'acted' };
  }

  function hands(scope: Scope, s: TourStep) {
    void leave(null, false);
    showPointer(false);
    let missing: number | undefined, done = false;
    const tick = () => {
      if (done) return;
      const el = present(s.target) ?? (s.via ?? []).map(present).find(Boolean) ?? null;
      ringTarget.current = el;
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
      void auto(scope, step, state.recover).then(e => {
        if (scope.disposed) return;
        if (e.type === 'acted') lastActed.current = performance.now();
        send(e);
      });
    } else if (state.stage === 'dwell' && !step.final) {
      let left = dwellMs(step.caption);
      const tick = () => { if (!paused.current) left -= 100; if (left <= 0) send({ type: 'dwell-over' }); else scope.timeout(tick, 100); };
      scope.timeout(tick, 100);
    } else if (state.stage === 'wait-user') hands(scope, step);
    return () => scope.dispose();
  }, [state.run, state.stage, state.phase]);

  // Leaving the tour: undo the open step's side effect, stop a preview the tour started, clear the pointer and ring.
  useEffect(() => {
    if (state.phase === 'running') return;
    ringTarget.current = null;
    showPointer(false);
    if (state.phase === 'ended' || state.phase === 'off') {
      void leave(null, false);
      if (previewByTour.current) { previewByTour.current = false; ready('preview-stop')?.click(); }
    }
  }, [state.phase, leave]);

  // Visitor activity: a click outside the tour marks a possible detour; Escape ends the tour at once.
  useEffect(() => {
    if (!live && state.phase !== 'ended') return;
    const scope = createScope();
    scope.listen(window, 'pointerdown', e => { if (e.isTrusted && !(e.target as Element | null)?.closest?.('.tour-ui')) lastTouch.current = performance.now(); }, true);
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
    const scope = createScope();
    const frame = () => {
      const el = ringTarget.current && visible(ringTarget.current) ? ringTarget.current : null;
      const r = el?.getBoundingClientRect();
      let box: { left: number; top: number; width: number; height: number } | null = null;
      if (r) {
        const left = Math.max(2, r.left - RING_PAD), top = Math.max(2, r.top - RING_PAD);
        const right = Math.min(window.innerWidth - 2, r.right + RING_PAD), bottom = Math.min(window.innerHeight - 2, r.bottom + RING_PAD);
        if (right > left && bottom > top) box = { left, top, width: right - left, height: bottom - top };
      }
      if (ring.current) {
        ring.current.hidden = !box;
        if (box) Object.assign(ring.current.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      }
      const c = card.current;
      if (c) {
        const at = placeCard(box, { width: c.offsetWidth, height: c.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
        c.style.transform = `translate(${Math.round(at.left)}px, ${Math.round(at.top)}px)`;
        c.style.visibility = 'visible';
      }
      if (pointer.current) pointer.current.style.transform = `translate(${pointerAt.current.x}px, ${pointerAt.current.y}px)`;
      scope.frame(frame);
    };
    scope.frame(frame);
    return () => scope.dispose();
  }, [state.phase]);

  const api = useMemo(() => ({ start, active: live }), [start, live]);
  const total = STEPS.length;
  const handsOn = state.mode === 'hands';

  let body: ReactNode = null;
  if (state.phase === 'invite') {
    body = <section ref={invite} className="tour-invite tour-ui" role="dialog" aria-labelledby="tour-invite-title">
      <span className="eyebrow">First time here</span>
      <h2 id="tour-invite-title">Take the 2 minute tour</h2>
      <p>A pointer shows you the real controls, one step at a time.</p>
      <div className="tour-actions">
        <button type="button" className="tour-primary" onClick={start}>Start tour</button>
        <button type="button" className="tour-quiet" onClick={() => { memory.remember('dismissed'); send({ type: 'not-now' }); }}>Not now</button>
      </div>
    </section>;
  } else if (state.phase !== 'off' && step) {
    const head = <header className="tour-card__head"><span className="tour-card__chapter">{state.phase === 'ended' ? 'Tour' : step.chapter}</span>{state.phase !== 'ended' && <span className="tour-card__count">{state.index + 1} of {total}</span>}</header>;
    let text: string, actions: ReactNode;
    if (state.phase === 'ended') {
      text = 'Tour ended here. Start it again from Help.';
      actions = <button type="button" className="tour-primary" onClick={() => send({ type: 'close' })}>Close</button>;
    } else if (state.phase === 'lost') {
      text = 'You left the tour path. Pick up where you were, or end the tour.';
      actions = <><button type="button" className="tour-primary" onClick={() => send({ type: 'resume' })}>Resume tour</button><button type="button" className="tour-quiet" onClick={() => send({ type: 'end' })}>End tour</button></>;
    } else if (step.final) {
      text = step.caption;
      actions = <button type="button" className="tour-primary" onClick={() => send({ type: 'next' })}>Finish</button>;
    } else {
      text = handsOn ? step.doIt : step.caption;
      actions = <>
        {handsOn
          ? <button type="button" className="tour-quiet" onClick={() => send({ type: 'show-me' })}><Icon name="play" />Show me</button>
          : <button type="button" className="tour-quiet" aria-pressed={state.paused} onClick={() => send({ type: state.paused ? 'play' : 'pause' })}><Icon name={state.paused ? 'play' : 'pause'} />{state.paused ? 'Play' : 'Pause'}</button>}
        <button type="button" className="tour-primary" onClick={() => send({ type: 'next' })}>Next<Icon name="next" /></button>
        {!handsOn && <button type="button" className="tour-quiet" onClick={() => send({ type: 'hands-on' })}>Let me do it</button>}
        <button type="button" className="tour-link" onClick={() => send({ type: 'end' })}>Skip tour</button>
      </>;
    }
    body = <section ref={card} className="tour-card tour-ui" role="dialog" aria-label="Guided tour" style={{ visibility: 'hidden' }}>
      {head}
      <p className="tour-card__text" aria-live="polite">{text}</p>
      {state.phase === 'running' && <div className="tour-card__track" aria-hidden="true"><span style={{ width: `${((state.index + 1) / total) * 100}%` }} /></div>}
      <div className="tour-actions">{actions}</div>
    </section>;
  }

  return <TourContext.Provider value={api}>
    {children}
    {createPortal(<div className="tour-layer" data-phase={state.phase}>
      <div ref={ring} className="tour-ring" hidden aria-hidden="true" />
      <div ref={pointer} className="tour-pointer" data-shown="false" aria-hidden="true">
        <svg viewBox="0 0 28 32" width="28" height="32"><path d="M3 2 L3 25 L9.2 19.6 L13.4 29 L17.6 27.2 L13.5 18 L22 18 Z" /></svg>
        <span className="tour-pointer__tap" />
      </div>
      {body}
    </div>, document.body)}
  </TourContext.Provider>;
}
