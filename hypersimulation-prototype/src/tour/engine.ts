/**
 * The first-start tour as a pure state machine. The React layer (Tour.tsx) reads the state, drives the real app through
 * its data-tour anchors and reports back with events. Nothing here touches the DOM, timers or storage.
 */

export type Chapter = 'Station' | 'Tablet' | 'Helmet';
export type StepAction = 'click' | 'point' | 'drag';

export interface TourStep {
  id: string;
  chapter: Chapter;
  /** data-tour name of the control the step is about. */
  target: string;
  action: StepAction;
  /** One short sentence in plain English, shown while the tour plays (Show me) and when the step can only be explained. */
  caption: string;
  /** What to do by hand, in the imperative, shown in the default hands-on mode. */
  doIt: string;
  /** data-tour names clicked first, in order, while the target is not yet on screen. */
  via?: string[];
  /** data-tour name that must appear after the action; the step fails when it does not. */
  expect?: string;
  /** data-tour name the ring moves to after the action, to show the result. */
  show?: string;
  /** A missing target shows the caption without a ring instead of skipping the step. */
  optional?: boolean;
  /** false hides the drawn pointer for this step. */
  pointer?: boolean;
  timeoutMs?: number;
  /** How the step undoes its own side effect when the tour moves on. */
  leave?: { reclickIfExpanded?: boolean; restorePressed?: string[] };
  /**
   * data-tour name of the mark a switch shows. When the first click hides the mark, the tour clicks again so the
   * visitor sees it appear, and the setting ends as it was; when the first click shows it, leaving clicks once more.
   */
  flip?: string;
  /** CSS selectors of key context the caption card should cover as little as it can. */
  avoid?: string[];
  /** CSS selectors the caption card must never cover. */
  keep?: string[];
  /** The closing card: no dwell, the card offers Finish. */
  final?: boolean;
}

export type Phase = 'off' | 'invite' | 'running' | 'lost' | 'ended';
/** hands: the visitor clicks, the tour marks the control (the default). auto: Show me, the tour clicks for the visitor. */
export type Mode = 'auto' | 'hands';
/** reach: the engine finds, points at and acts on the target. dwell: the caption reads. wait-user: hands-on. */
export type Stage = 'reach' | 'dwell' | 'wait-user';
export type EndReason = 'finished' | 'skipped' | 'failed';

export interface TourState {
  phase: Phase;
  index: number;
  mode: Mode;
  paused: boolean;
  stage: Stage;
  /** Steps skipped in a row (missing target or timed-out wait). */
  skips: number;
  /** Changes on every (re-)entry of a step, so stale async work can tell it is out of date. */
  run: number;
  /** Set by Resume and Previous: the step first brings the app back to the state it needs. */
  recover: boolean;
  /** Hands-on Next on an action step: the tour does this one step, then waits for the visitor again. */
  once: boolean;
  reason?: EndReason;
}

export type TourEvent =
  | { type: 'invite' }
  | { type: 'not-now' }
  | { type: 'start' }
  | { type: 'acted' }
  | { type: 'dwell-over' }
  /** act: hands-on, on an action step the visitor has not done; the tour does it first so the next step finds its control. */
  | { type: 'next'; act?: boolean }
  | { type: 'back' }
  | { type: 'pause' }
  | { type: 'play' }
  | { type: 'hands-on' }
  | { type: 'show-me' }
  | { type: 'failed' }
  | { type: 'lost' }
  | { type: 'resume' }
  | { type: 'end' }
  | { type: 'close' };

export const MAX_SKIPS_IN_ROW = 2;

export const INITIAL: TourState = { phase: 'off', index: 0, mode: 'hands', paused: false, stage: 'wait-user', skips: 0, run: 0, recover: false, once: false };

const live = (s: TourState) => s.phase === 'running' || s.phase === 'lost';

function enter(s: TourState, index: number, mode: Mode, skips: number): TourState {
  return { ...s, phase: 'running', index, mode, skips, paused: false, recover: false, once: false, stage: mode === 'auto' ? 'reach' : 'wait-user', run: s.run + 1 };
}

function advance(s: TourState, count: number): TourState {
  if (s.index + 1 >= count) return { ...s, phase: 'off', reason: 'finished', paused: false, run: s.run + 1 };
  return enter(s, s.index + 1, s.mode, s.skips);
}

export function reduce(s: TourState, e: TourEvent, count: number): TourState {
  switch (e.type) {
    case 'invite': return s.phase === 'off' ? { ...s, phase: 'invite' } : s;
    case 'not-now': return s.phase === 'invite' ? { ...s, phase: 'off', reason: 'skipped' } : s;
    case 'start': return count > 0 && !live(s) ? { ...enter(s, 0, 'hands', 0), reason: undefined } : s;
    case 'acted':
      if (s.phase !== 'running') return s;
      return s.mode === 'auto' && !s.once ? { ...s, stage: 'dwell', skips: 0 } : advance({ ...s, skips: 0 }, count);
    case 'dwell-over': return s.phase === 'running' && s.stage === 'dwell' && !s.paused && s.index + 1 < count ? advance(s, count) : s;
    case 'next':
      if (e.act && s.phase === 'running' && s.mode === 'hands' && s.stage === 'wait-user') return { ...s, stage: 'reach', once: true, recover: false, run: s.run + 1 };
      return live(s) ? advance(s, count) : s;
    case 'back': return s.phase === 'running' && s.index > 0 ? { ...enter(s, s.index - 1, s.mode, 0), recover: true } : s;
    case 'pause': return s.phase === 'running' && s.mode === 'auto' ? { ...s, paused: true } : s;
    case 'play': return s.phase === 'running' ? { ...s, paused: false } : s;
    case 'hands-on':
      if (s.phase !== 'running' || s.mode !== 'auto') return s;
      // The tour already did this step: the visitor goes on with the next one by hand.
      return s.stage === 'dwell' && s.index + 1 < count ? enter(s, s.index + 1, 'hands', 0) : enter(s, s.index, 'hands', s.skips);
    case 'show-me': return s.phase === 'running' && s.mode === 'hands' ? enter(s, s.index, 'auto', s.skips) : s;
    case 'failed': {
      if (s.phase !== 'running') return s;
      const skips = s.skips + 1;
      if (skips >= MAX_SKIPS_IN_ROW) return { ...s, phase: 'ended', reason: 'failed', skips, paused: false, run: s.run + 1 };
      return advance({ ...s, skips }, count);
    }
    case 'lost': return s.phase === 'running' ? { ...s, phase: 'lost', run: s.run + 1 } : s;
    case 'resume': return s.phase === 'lost' ? { ...enter(s, s.index, s.mode, s.skips), recover: true } : s;
    case 'end': return live(s) || s.phase === 'invite' ? { ...s, phase: 'off', reason: 'skipped', paused: false, run: s.run + 1 } : s;
    case 'close': return s.phase === 'ended' ? { ...s, phase: 'off' } : s;
  }
}

/** The card text: what to do by hand by default, the explanation while the tour plays or when the control is not there. */
export function cardText(step: TourStep, mode: Mode, explainOnly: boolean): string {
  return explainOnly || mode === 'auto' ? step.caption : step.doIt;
}

/**
 * Previous and Resume: the controls clicked, in order, to bring the app back to the state a step needs. A running
 * preview is stopped first for a step outside the helmet; then the way into the chapter, then the step's own via.
 * When none of them brings the control back, the step shows as an explanation only.
 */
export function restorePath(step: TourStep, recover: Record<Chapter, string[]>, previewRunning: boolean): string[] {
  return [...(previewRunning && step.chapter !== 'Helmet' ? ['preview-stop'] : []), ...recover[step.chapter], ...(step.via ?? [])];
}

/**
 * What the tour mounts in the page. layer: the tour's own node. marks: the ring and the pointer. When the tour is off
 * nothing of it is in the document, so no ring can stay behind after Skip, Finish, Escape or Close.
 */
export function overlay(phase: Phase): { layer: boolean; marks: boolean } {
  return { layer: phase !== 'off', marks: phase === 'running' || phase === 'lost' };
}

/** Reading time for a caption: about 2.5 to 4 s, longer for more words. */
export function dwellMs(caption: string): number {
  const words = caption.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2500, Math.min(4000, 1500 + 180 * words));
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Every data-tour name a step can touch. */
export function anchorsOf(step: TourStep): string[] {
  return [step.target, ...(step.via ?? []), ...(step.expect ? [step.expect] : []), ...(step.show ? [step.show] : []), ...(step.flip ? [step.flip] : []), ...(step.leave?.restorePressed ?? [])];
}
