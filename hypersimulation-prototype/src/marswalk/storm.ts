import type { Origin } from './stops';

export const SCENARIO_LABEL = 'scenario';

export const SEP_EVENT = {
  id: '2025-05-13T18:14:00-SEP-001',
  eventTimeUtc: '2025-05-13T18:14Z',
  instrument: 'SOHO: COSTEP 15.8-39.8 MeV',
  link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/38846/-1',
  note: 'Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario.',
  citation: 'NASA CCMC DONKI, provided as is, at prototyping quality and in a research context; no NASA endorsement.',
  origin: 'source' as Origin,
} as const;

export const HAZARD_START = {
  value: 150, unit: 'min', origin: 'assumption' as Origin,
  note: 'Minutes after the walk starts. No source: the replay of a scenario, not a prediction.',
} as const;

export const AUTO_FADE = {
  value: 10_000, unit: 'ms', origin: 'assumption' as Origin,
  note: 'The warning card fades after about 10 seconds and moves to the side list (team review call, 2026-11-15). A design choice, not a NASA value.',
} as const;

export type StormPhase = 'idle' | 'active';
export type WarningView = 'hidden' | 'shown' | 'listed';

export interface StormState {
  phase: StormPhase;
  triggeredAtS: number | null;
  warning: WarningView;
  shownAtMs: number | null;
  returning: boolean;
  returnCancelled: boolean;
}

export interface StormMessage { label: typeof SCENARIO_LABEL; headline: string; text: string; advice: string; eventId: string; eventTimeUtc: string }

export const IDLE: StormState = { phase: 'idle', triggeredAtS: null, warning: 'hidden', shownAtMs: null, returning: false, returnCancelled: false };

export function startSeconds(startMin: number = HAZARD_START.value): number | null {
  return Number.isFinite(startMin) && startMin >= 0 ? startMin * 60 : null;
}

export function shouldTrigger(state: StormState, elapsedS: number, startS: number | null = startSeconds()): boolean {
  return state.phase === 'idle' && startS !== null && Number.isFinite(elapsedS) && elapsedS >= startS;
}

export function trigger(state: StormState, elapsedS: number, nowMs: number): StormState {
  if (state.phase === 'active' || !Number.isFinite(elapsedS)) return state;
  return { phase: 'active', triggeredAtS: elapsedS, warning: 'shown', shownAtMs: nowMs, returning: true, returnCancelled: false };
}

export function advance(state: StormState, elapsedS: number, nowMs: number, startS: number | null = startSeconds()): StormState {
  const next = shouldTrigger(state, elapsedS, startS) ? trigger(state, elapsedS, nowMs) : state;
  return fade(next, nowMs);
}

export function fade(state: StormState, nowMs: number): StormState {
  if (state.warning !== 'shown' || state.shownAtMs === null || nowMs - state.shownAtMs < AUTO_FADE.value) return state;
  return { ...state, warning: 'listed' };
}

export function dismiss(state: StormState): StormState {
  return state.warning === 'shown' ? { ...state, warning: 'listed' } : state;
}

export function reopen(state: StormState, nowMs: number): StormState {
  return state.phase === 'active' ? { ...state, warning: 'shown', shownAtMs: nowMs } : state;
}

export function cancelReturn(state: StormState): StormState {
  return state.phase === 'active' && state.returning ? { ...state, returning: false, returnCancelled: true } : state;
}

export function resumeReturn(state: StormState): StormState {
  return state.phase === 'active' && !state.returning ? { ...state, returning: true, returnCancelled: false } : state;
}

export function reset(): StormState { return IDLE; }

export function message(state: StormState): StormMessage | null {
  if (state.phase !== 'active') return null;
  return {
    label: SCENARIO_LABEL,
    headline: 'RETURN NOW',
    text: `Scenario: a solar particle event recorded near Earth on ${SEP_EVENT.eventTimeUtc.replace('T', ' ').replace('Z', ' UTC')}, replayed. Arrival at Mars is not claimed.`,
    advice: state.returning ? 'Walk back to the crew rover now. The way back is shown.' : 'Return cancelled. The scenario is still active; restart the way back when you can.',
    eventId: SEP_EVENT.id,
    eventTimeUtc: SEP_EVENT.eventTimeUtc,
  };
}
