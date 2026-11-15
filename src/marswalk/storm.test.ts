import { describe, expect, it } from 'vitest';
import { AUTO_FADE, HAZARD_START, IDLE, SCENARIO_LABEL, advance, cancelReturn, dismiss, fade, message, reopen, reset, resumeReturn, shouldTrigger, startSeconds, trigger } from './storm';

describe('solar particle event scenario', () => {
  it('stays idle before the scheduled start and triggers at it', () => {
    const start = startSeconds();
    expect(start).toBe(HAZARD_START.value * 60);
    expect(shouldTrigger(IDLE, start! - 1)).toBe(false);
    expect(shouldTrigger(IDLE, start!)).toBe(true);
    expect(advance(IDLE, start! - 1, 0)).toBe(IDLE);
    const s = advance(IDLE, start!, 1000);
    expect(s).toMatchObject({ phase: 'active', triggeredAtS: start, warning: 'shown', shownAtMs: 1000, returning: true });
    expect(shouldTrigger(s, start! + 10)).toBe(false);
    expect(trigger(s, start! + 10, 2000)).toBe(s);
    expect(startSeconds(Number.NaN)).toBeNull();
    expect(shouldTrigger(IDLE, 1e9, null)).toBe(false);
  });

  it('labels the message as a scenario with return advice', () => {
    expect(message(IDLE)).toBeNull();
    const m = message(trigger(IDLE, 9000, 0))!;
    expect(m.label).toBe(SCENARIO_LABEL);
    expect(m.headline).toBe('RETURN NOW');
    expect(m.text).toMatch(/^Scenario: .*near Earth on 2025-05-13 18:14 UTC.*not claimed\.$/);
    expect(m.advice).toMatch(/crew rover/);
  });

  it('dismisses the card to the side list while the scenario stays active', () => {
    const s = dismiss(trigger(IDLE, 9000, 0));
    expect(s).toMatchObject({ phase: 'active', warning: 'listed', returning: true });
    expect(dismiss(s)).toBe(s);
    expect(reopen(s, 50).warning).toBe('shown');
    expect(reopen(IDLE, 50)).toBe(IDLE);
  });

  it('fades the card after the exposed auto-fade time, not before', () => {
    expect(AUTO_FADE).toMatchObject({ value: 10_000, unit: 'ms' });
    const s = trigger(IDLE, 9000, 1000);
    expect(fade(s, 1000 + AUTO_FADE.value - 1).warning).toBe('shown');
    expect(fade(s, 1000 + AUTO_FADE.value).warning).toBe('listed');
    expect(advance(s, 9100, 1000 + AUTO_FADE.value).warning).toBe('listed');
  });

  it('cancels and resumes the way back without ending the scenario', () => {
    const s = cancelReturn(trigger(IDLE, 9000, 0));
    expect(s).toMatchObject({ phase: 'active', returning: false, returnCancelled: true });
    expect(message(s)!.advice).toMatch(/cancelled/);
    expect(cancelReturn(s)).toBe(s);
    expect(resumeReturn(s)).toMatchObject({ returning: true, returnCancelled: false });
    expect(cancelReturn(IDLE)).toBe(IDLE);
    expect(reset()).toEqual(IDLE);
  });
});
