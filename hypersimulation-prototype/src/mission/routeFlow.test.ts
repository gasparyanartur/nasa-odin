import { describe, expect, it } from 'vitest';
import { TerrainPlanner, settingsFor, type PlannerData } from './planner/core';
import { RoutePlanningError, advanceWalk, moveBlock, type Meta, type Point, type RouteDiagnostics, type RouteResult, type Settings, type StopReason, type TerrainData } from './data';
import { describeNotice } from './HudNotices';
import {
  currentOutcome, explainFailure, fixLabel, planBlock, planKey, previewBlock, resultWarning, returnBlock, shouldAutoPlan, slopeNeeded,
  stopText, surfaceTabBlock, tabletTabBlock, toolTabBlock, walkBlock, type FailureInput, type PlanOutcome,
} from './routeFlow';

const N = 21;
function terrain(): TerrainData & PlannerData {
  return {
    baseUrl: '', meta: { size: N, stepM: 1, extentM: N - 1, id: 'test', version: 1, origin: { latitude: 0, longitude: 0 }, radiusM: 3389500 } as Meta,
    environment: { weather: [] } as unknown as TerrainData['environment'],
    heights: new Float32Array(N * N), slopes: new Float32Array(N * N), valid: new Uint8Array(N * N).fill(1),
  };
}
const at = (d: TerrainData, x: number, y: number) => (Math.round((N - 1) / 2 - y)) * N + Math.round(x + (N - 1) / 2);
function diagnose(d: PlannerData, start: Point, goal: Point, s: Partial<Settings> = {}): RouteDiagnostics {
  try { new TerrainPlanner(d).search(start, goal, settingsFor(s)); }
  catch (e) { if (e instanceof RoutePlanningError && e.diagnostics) return e.diagnostics; throw e; }
  throw new Error('expected the planner to refuse');
}
const base: Omit<FailureInput, 'diagnostics'> = { slopeLimit: 20, manual: 0, fields: [], hazardCircles: 0 };
const settings: Settings = { speedMps: .8, maxSlopeDeg: 20, maxDurationMin: 90, doseRateMicroGyH: 10, maxDoseMicroGy: 50, temperatureK: 220, minTemperatureK: 180, windMps: 0, maxWindMps: 25, exclusions: [] };
const EM_DASH = String.fromCharCode(0x2014);

describe('auto-plan trigger rule', () => {
  const inputs = { dataId: 'boxwork@1', start: { x: 0, y: 0 }, goal: { x: 100, y: 50 }, settings, hazards: true };
  it('has nothing to plan without terrain or without a destination', () => {
    expect(planKey({ ...inputs, goal: undefined })).toBeUndefined();
    expect(planKey({ ...inputs, dataId: undefined })).toBeUndefined();
    expect(shouldAutoPlan(undefined, true, undefined)).toBe(false);
  });
  it('plans by itself once start and destination are set, only while Routes is open', () => {
    const key = planKey(inputs)!;
    expect(shouldAutoPlan(key, true, undefined)).toBe(true);
    expect(shouldAutoPlan(key, false, undefined)).toBe(false);
  });
  it('plans again when the start, the destination, a no-go area, a limit or hazard avoidance changes', () => {
    const key = planKey(inputs)!;
    const done: PlanOutcome = { key, status: 'failed', failure: { title: 'x', reason: 'y', fixes: [] } };
    expect(shouldAutoPlan(key, true, done)).toBe(false);
    for (const changed of [
      { ...inputs, start: { x: 5, y: 0 } }, { ...inputs, goal: { x: 100, y: 55 } },
      { ...inputs, settings: { ...settings, exclusions: [{ x: 1, y: 1, radius: 40 }] } },
      { ...inputs, settings: { ...settings, maxSlopeDeg: 25 } }, { ...inputs, hazards: false },
    ]) {
      const next = planKey(changed)!;
      expect(next).not.toBe(key);
      expect(shouldAutoPlan(next, true, done)).toBe(true);
    }
  });
  it('does not plan twice while a plan for the same inputs is running', () => {
    const key = planKey(inputs)!;
    expect(shouldAutoPlan(key, true, { key, status: 'busy' })).toBe(false);
  });
});

describe('stale-result rule', () => {
  it('never shows a result that belongs to an older start, destination or limit', () => {
    const old = planKey({ dataId: 'a', start: { x: 0, y: 0 }, goal: { x: 1, y: 1 }, settings, hazards: false })!;
    const now = planKey({ dataId: 'a', start: { x: 0, y: 0 }, goal: { x: 2, y: 1 }, settings, hazards: false })!;
    const outcome: PlanOutcome = { key: old, status: 'done', result: {} as RouteResult };
    expect(currentOutcome(outcome, old)).toBe(outcome);
    expect(currentOutcome(outcome, now)).toBeUndefined();
    expect(currentOutcome(outcome, undefined)).toBeUndefined();
  });
});

describe('failure code to plain reason and fix', () => {
  it('destination outside the mapped area', () => {
    const v = explainFailure({ ...base, diagnostics: diagnose(terrain(), { x: 0, y: 0 }, { x: 50, y: 0 }) });
    expect(v.title).toBe('Destination is outside the mapped area.');
    expect(v.fixes.map(f => f.kind)).toEqual(['change-destination']);
  });
  it('destination too steep: raise the limit to the slope the planner measured there', () => {
    const d = terrain();
    for (const [x, y] of [[5, 0], [6, 0], [5, -1], [6, -1]]) d.slopes[at(d, x, y)] = 27.4;
    const v = explainFailure({ ...base, diagnostics: diagnose(d, { x: -5, y: 0 }, { x: 5, y: 0 }) });
    expect(v.title).toBe('Destination is too steep.');
    expect(v.reason).toBe('The ground there is 27.4°, above your 20° limit.');
    expect(v.fixes).toContainEqual({ kind: 'raise-slope', to: 28 });
  });
  it('destination inside a hazard area, a no-go area or a field restriction', () => {
    const diagnostics = diagnose(terrain(), { x: -5, y: 0 }, { x: 5, y: 0 }, { exclusions: [{ x: 5, y: 0, radius: 5 }] });
    expect(explainFailure({ ...base, hazardCircles: 1, diagnostics }).title).toBe('Destination is inside a hazard area.');
    expect(explainFailure({ ...base, hazardCircles: 1, diagnostics }).fixes.map(f => f.kind)).toEqual(['change-destination', 'hazards-off']);
    expect(explainFailure({ ...base, manual: 1, diagnostics }).title).toBe('Destination is inside one of your no-go areas.');
    expect(explainFailure({ ...base, manual: 1, diagnostics }).fixes.map(f => f.kind)).toContain('remove-last-nogo');
    const field = explainFailure({ ...base, fields: [{ id: 'f1', title: 'Loose sand' }], diagnostics });
    expect(field.title).toBe('Destination is inside a saved field restriction.');
    expect(field.fixes).toContainEqual({ kind: 'open-field', id: 'f1', title: 'Loose sand' });
  });
  it('start and destination in the same cell', () => {
    expect(explainFailure({ ...base, diagnostics: diagnose(terrain(), { x: 1, y: 1 }, { x: 1, y: 1 }) }).title).toBe('Start and destination are the same spot.');
  });
  it('too steep: a slope wall closes every way; the fix raises the limit to the smallest value that opens it', () => {
    const d = terrain();
    for (let y = -10; y <= 10; y++) d.slopes[at(d, 0, y)] = 31.2;
    const diagnostics = diagnose(d, { x: -5, y: 0 }, { x: 5, y: 0 });
    const needed = slopeNeeded(d, { x: -5, y: 0 }, { x: 5, y: 0 }, [], 20);
    expect(needed).toBe(32);
    const v = explainFailure({ ...base, diagnostics, slopeNeeded: needed });
    expect(v.title).toBe('Too steep.');
    expect(v.reason).toBe('Every way crosses slopes above your 20° limit.');
    expect(v.fixes[0]).toEqual({ kind: 'raise-slope', to: 32 });
    expect(fixLabel(v.fixes[0])).toBe('Raise slope limit to 32°');
    expect(v.fixes.map(f => f.kind)).toContain('open-limits');
  });
  it('blocked: no-go areas close every way', () => {
    const exclusions = [{ x: 0, y: -8, radius: 5 }, { x: 0, y: 0, radius: 5 }, { x: 0, y: 8, radius: 5 }];
    const diagnostics = diagnose(terrain(), { x: -8, y: 0 }, { x: 8, y: 0 }, { exclusions });
    const mine = explainFailure({ ...base, manual: 3, diagnostics });
    expect(mine).toMatchObject({ title: 'Blocked.', reason: 'Your no-go areas close every way.' });
    expect(mine.fixes.map(f => f.kind)).toEqual(['remove-last-nogo', 'clear-nogo', 'change-destination']);
    const hazards = explainFailure({ ...base, hazardCircles: 3, diagnostics });
    expect(hazards.reason).toBe('The marked hazard areas close every way.');
    expect(hazards.fixes[0]).toEqual({ kind: 'hazards-off' });
  });
  it('too many no-go areas for the hazard circles', () => {
    const v = explainFailure({ ...base, manual: 2, message: 'The hazard areas need at least 6 free planner restrictions; 2 are free. Clear manual exclusions or switch off a field restriction, then plan again.' });
    expect(v.title).toBe('Too many no-go areas.');
    expect(v.fixes.map(f => f.kind)).toEqual(['remove-last-nogo', 'clear-nogo', 'hazards-off']);
  });
  it('unknown failure: no route found, change the destination or open the limits', () => {
    const v = explainFailure({ ...base, message: 'The browser planner was interrupted. Please try again.' });
    expect(v.title).toBe('No route found.');
    expect(v.fixes.map(f => f.kind)).toEqual(['change-destination', 'open-limits']);
  });
  it('every failure text is plain: no em-dash, no planner jargon', () => {
    const texts = [
      explainFailure({ ...base, diagnostics: diagnose(terrain(), { x: 0, y: 0 }, { x: 50, y: 0 }) }),
      explainFailure({ ...base, message: 'x' }),
    ].flatMap(v => [v.title, v.reason, ...v.fixes.map(fixLabel)]);
    for (const t of texts) { expect(t).not.toContain(EM_DASH); expect(t).not.toMatch(/exclusion|endpoint|corridor|diagnostic/i); }
  });
});

describe('result warning', () => {
  it('says when the walk is too long for the suit time limit, with real numbers', () => {
    const w = resultWarning({ roundTripS: 100 * 60, conditions: { status: 'exceeds' } as never }, { maxDurationMin: 90 });
    expect(w?.text).toBe('Too long for the suit time limit: 1 h 40 min there and back, limit 90 min.');
    expect(w?.fix).toEqual({ kind: 'open-limits' });
    expect(resultWarning({ roundTripS: 600, conditions: { status: 'within' } as never }, { maxDurationMin: 90 })).toBeUndefined();
  });
});

describe('stop reason for every stop cause', () => {
  const d = terrain();
  for (let y = -10; y <= 10; y++) { d.valid[at(d, -6, y)] = 0; d.slopes[at(d, 6, y)] = 35; }
  const s = { maxSlopeDeg: 20, exclusions: [{ x: 0, y: 6, radius: 1 }] };
  const cases: [StopReason, Point, Point][] = [
    ['edge', { x: 0, y: 9.5 }, { x: 0, y: 10.6 }], ['gap', { x: -3, y: 0 }, { x: -6, y: 0 }],
    ['nogo', { x: 0, y: 3 }, { x: 0, y: 6 }], ['slope', { x: 3, y: 0 }, { x: 6, y: 0 }],
  ];
  it.each(cases)('%s', (reason, a, b) => {
    expect(moveBlock(d, a, b, s)).toBe(reason);
    const text = stopText(reason, 20);
    expect(text).toMatch(/^Stopped: /);
    expect(text).not.toContain(EM_DASH);
    expect(describeNotice({ text, kind: 'warning' }).short).toBe(text);
  });
  it('a free step has no reason, and advanceWalk reports the reason it stopped for', () => {
    expect(moveBlock(d, { x: 0, y: 0 }, { x: 1, y: 0 }, s)).toBeNull();
    const r = advanceWalk(d, { x: 3, y: 0, heading: Math.PI / 2, elapsed: 0 }, { ...s, speedMps: 1 }, Math.PI / 2, 1, 0, 10);
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('slope');
  });
  it('the slope line carries the real limit', () => {
    expect(stopText('slope', 25)).toBe('Stopped: slope ahead is above your 25° limit. Turn, or raise the limit on the tablet.');
    expect(stopText('edge', 20)).toBe('Stopped: edge of the mapped area. Turn back.');
  });
});

describe('blocked controls say why and offer the fix', () => {
  it('top tabs before a region is chosen', () => {
    const none = { region: false, plannable: false, data: false };
    expect(tabletTabBlock(none)).toEqual({ reason: 'Choose a region first.', fix: 'choose-suggested', more: 'show-regions' });
    expect(surfaceTabBlock(none)?.reason).toBe('Choose a region first.');
    expect(surfaceTabBlock({ region: true, plannable: false, data: false })?.fix).toBe('choose-suggested');
    expect(surfaceTabBlock({ region: true, plannable: true, data: false, dataError: true })?.fix).toBe('retry-terrain');
    expect(surfaceTabBlock({ region: true, plannable: true, data: true })).toBeUndefined();
    expect(tabletTabBlock({ region: true, plannable: false, data: false })).toBeUndefined();
    expect(toolTabBlock({ region: true, plannable: false, data: false })?.reason).toBe('Not available in this region.');
  });
  const state = { data: true, goal: false, busy: false, previewable: false, workflow: 'new' as const, hasPaths: true };
  it('Plan route with no destination starts map picking', () => {
    expect(planBlock(state)).toEqual({ reason: 'Pick a destination on the map first.', fix: 'pick-destination' });
    expect(planBlock({ ...state, goal: true })).toBeUndefined();
    expect(planBlock({ ...state, data: false })?.reason).toBe('The terrain is still loading.');
  });
  it('Preview and Walk with no route', () => {
    expect(previewBlock(state)).toEqual({ reason: 'Plan or load a route first.', fix: 'pick-destination' });
    expect(previewBlock({ ...state, workflow: 'saved' })).toEqual({ reason: 'Show a path from the list first.', fix: 'show-first-path' });
    expect(previewBlock({ ...state, previewable: true })).toBeUndefined();
    expect(walkBlock({ data: false })?.reason).toBe('The terrain is still loading.');
    expect(walkBlock({ data: true })).toBeUndefined();
  });
  it('Guide to habitat with no way back', () => {
    expect(returnBlock({ route: false, error: true, onSurface: false })?.fix).toBe('retry-return');
    expect(returnBlock({ route: false, error: false, onSurface: false })?.fix).toBe('go-surface');
    expect(returnBlock({ route: true, error: false, onSurface: false })).toBeUndefined();
  });
});
