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
  /** One short sentence in plain English, shown while the tour plays. */
  caption: string;
  /** What to do by hand, shown in "Let me do it" mode. */
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
  /** The closing card: no dwell, the card offers Finish. */
  final?: boolean;
}

export type Phase = 'off' | 'invite' | 'running' | 'lost' | 'ended';
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
  /** Set by Resume: the step first walks back to its chapter. */
  recover: boolean;
  reason?: EndReason;
}

export type TourEvent =
  | { type: 'invite' }
  | { type: 'not-now' }
  | { type: 'start' }
  | { type: 'acted' }
  | { type: 'dwell-over' }
  | { type: 'next' }
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

export const INITIAL: TourState = { phase: 'off', index: 0, mode: 'auto', paused: false, stage: 'reach', skips: 0, run: 0, recover: false };

const live = (s: TourState) => s.phase === 'running' || s.phase === 'lost';

function enter(s: TourState, index: number, mode: Mode, skips: number): TourState {
  return { ...s, phase: 'running', index, mode, skips, paused: false, recover: false, stage: mode === 'auto' ? 'reach' : 'wait-user', run: s.run + 1 };
}

function advance(s: TourState, count: number): TourState {
  if (s.index + 1 >= count) return { ...s, phase: 'off', reason: 'finished', paused: false, run: s.run + 1 };
  return enter(s, s.index + 1, s.mode, s.skips);
}

export function reduce(s: TourState, e: TourEvent, count: number): TourState {
  switch (e.type) {
    case 'invite': return s.phase === 'off' ? { ...s, phase: 'invite' } : s;
    case 'not-now': return s.phase === 'invite' ? { ...s, phase: 'off', reason: 'skipped' } : s;
    case 'start': return count > 0 && !live(s) ? { ...enter(s, 0, 'auto', 0), reason: undefined } : s;
    case 'acted':
      if (s.phase !== 'running') return s;
      return s.mode === 'auto' ? { ...s, stage: 'dwell', skips: 0 } : advance({ ...s, skips: 0 }, count);
    case 'dwell-over': return s.phase === 'running' && s.stage === 'dwell' && !s.paused && s.index + 1 < count ? advance(s, count) : s;
    case 'next': return live(s) ? advance(s, count) : s;
    case 'pause': return s.phase === 'running' && s.mode === 'auto' ? { ...s, paused: true } : s;
    case 'play': return s.phase === 'running' ? { ...s, paused: false } : s;
    case 'hands-on': return s.phase === 'running' && s.mode === 'auto' ? enter(s, s.index, 'hands', s.skips) : s;
    case 'show-me': return s.phase === 'running' && s.mode === 'hands' ? enter(s, s.index, 'auto', s.skips) : s;
    case 'failed': {
      if (s.phase !== 'running') return s;
      const skips = s.skips + 1;
      if (skips >= MAX_SKIPS_IN_ROW) return { ...s, phase: 'ended', reason: 'failed', skips, paused: false, run: s.run + 1 };
      return advance({ ...s, skips }, count);
    }
    case 'lost': return s.phase === 'running' ? { ...s, phase: 'lost', run: s.run + 1 } : s;
    case 'resume': return s.phase === 'lost' ? { ...enter(s, s.index, 'auto', s.skips), recover: true } : s;
    case 'end': return live(s) || s.phase === 'invite' ? { ...s, phase: 'off', reason: 'skipped', paused: false, run: s.run + 1 } : s;
    case 'close': return s.phase === 'ended' ? { ...s, phase: 'off' } : s;
  }
}

/** Reading time for a caption: about 2.5 to 4 s, longer for more words. */
export function dwellMs(caption: string): number {
  const words = caption.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2500, Math.min(4000, 1500 + 180 * words));
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Every data-tour name a step can touch. */
export function anchorsOf(step: TourStep): string[] {
  return [step.target, ...(step.via ?? []), ...(step.expect ? [step.expect] : []), ...(step.show ? [step.show] : []), ...(step.leave?.restorePressed ?? [])];
}
