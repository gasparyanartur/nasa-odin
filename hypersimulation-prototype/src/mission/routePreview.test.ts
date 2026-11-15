import { describe, expect, it } from 'vitest';
import { PREVIEW_SECONDS, advancePreview, headingAt, liveWalk, pointAt, previewPath, previewPose, previewProgressText, previewReducer, startPreview, turnTowards, routeSubject } from './routePreview';

const L = [{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 300, y: 300 }];

describe('route preview path', () => {
  it('measures the route and finds points along it', () => {
    const path = previewPath(L)!;
    expect(path.totalM).toBe(600);
    expect(pointAt(path, 150)).toEqual({ x: 0, y: 150 });
    expect(pointAt(path, 450)).toEqual({ x: 150, y: 300 });
    expect(pointAt(path, 9999)).toEqual({ x: 300, y: 300 });
  });
  it('drops repeated points and refuses a route shorter than a metre', () => {
    expect(previewPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }])!.points).toHaveLength(2);
    expect(previewPath([{ x: 0, y: 0 }, { x: 0, y: .5 }])).toBeUndefined();
    expect(previewPath([{ x: 1, y: 1 }])).toBeUndefined();
  });
  it('faces along the route: north first, east after the corner, still east at the very end', () => {
    const path = previewPath(L)!;
    expect(headingAt(path, 10)).toBeCloseTo(0);
    expect(headingAt(path, 400)).toBeCloseTo(Math.PI / 2);
    expect(headingAt(path, 600)).toBeCloseTo(Math.PI / 2);
  });
  it('turns the short way round', () => {
    expect(turnTowards(3, -3, 1)).toBeCloseTo(3 + (2 * Math.PI - 6));
    expect(turnTowards(0, 1, 0)).toBe(0);
  });
});

describe('route preview pace', () => {
  it('runs a whole route in about 90 seconds at 1x, half that at 2x, a quarter at 4x', () => {
    for (const [speed, seconds] of [[1, PREVIEW_SECONDS], [2, PREVIEW_SECONDS / 2], [4, PREVIEW_SECONDS / 4]]) {
      let done = 0, t = 0;
      while (done < 600 && t < 1000) { done = advancePreview(done, 600, 1 / 60, speed); t += 1 / 60; }
      expect(t).toBeGreaterThan(seconds - .1);
      expect(t).toBeLessThan(seconds + .1);
    }
  });
  it('caps a long frame gap so a hidden tab does not jump to the end', () => {
    expect(advancePreview(0, 600, 30, 4)).toBeCloseTo(.5 * (600 / PREVIEW_SECONDS) * 4);
  });
  it('is 90 s, 45 s and 22.5 s whatever the route length', () => {
    expect(PREVIEW_SECONDS).toBe(90);
    for (const len of [50, 600, 1680, 9000]) {
      let done = 0, t = 0;
      while (done < len && t < 1000) { done = advancePreview(done, len, 1 / 30, 4); t += 1 / 30; }
      expect(Math.abs(t - 22.5)).toBeLessThan(.2);
    }
  });
  it('keeps pace at a low frame rate', () => {
    let done = 0, t = 0;
    while (done < 1680 && t < 1000) { done = advancePreview(done, 1680, .4, 1); t += .4; }
    expect(Math.abs(t - 90)).toBeLessThan(.5);
  });
});

describe('route subject', () => {
  it('uses the shown previous path for preview and walk when Load previous path is open', () => {
    expect(routeSubject('saved', { id: 'p' }, { id: 'r' }, { id: 'x' })).toBe('previous');
  });
  it('falls back to the route, then the prepared walk, when no previous path is shown', () => {
    expect(routeSubject('saved', undefined, { id: 'r' }, { id: 'x' })).toBe('route');
    expect(routeSubject('new', { id: 'p' }, undefined, { id: 'x' })).toBe('prepared');
    expect(routeSubject('new', undefined, undefined, undefined)).toBe('none');
  });
  it('ignores a shown path while Plan new route is open', () => {
    expect(routeSubject('new', { id: 'p' }, { id: 'r' }, { id: 'x' })).toBe('route');
  });
});

describe('route preview state', () => {
  const start = () => startPreview('Science walk, 8 stops', L)!;
  it('starts playing at 1x from the start', () => {
    expect(start()).toMatchObject({ phase: 'playing', speed: 1, doneM: 0, name: 'Science walk, 8 stops' });
    expect(startPreview('none', [{ x: 0, y: 0 }])).toBeUndefined();
  });
  it('pauses, plays, changes speed and ends at the end', () => {
    let s = previewReducer(start(), { type: 'toggle' });
    expect(s.phase).toBe('paused');
    s = previewReducer(s, { type: 'toggle' });
    expect(s.phase).toBe('playing');
    s = previewReducer(s, { type: 'speed', speed: 4 });
    expect(s.speed).toBe(4);
    s = previewReducer(s, { type: 'progress', doneM: 200 });
    expect(s).toMatchObject({ doneM: 200, phase: 'playing' });
    s = previewReducer(s, { type: 'progress', doneM: 100 });
    expect(s.doneM).toBe(200);
    s = previewReducer(s, { type: 'progress', doneM: 900 });
    expect(s).toMatchObject({ doneM: 600, phase: 'ended' });
    expect(previewReducer(s, { type: 'toggle' })).toBe(s);
  });
  it('saves nothing: the walk is not live during a preview, so no walk record, stop arrival or suit clock moves', () => {
    const s = start();
    expect(liveWalk('walk', false, s)).toBe(false);
    expect(liveWalk('walk', false, undefined)).toBe(true);
    expect(liveWalk('walk', true, undefined)).toBe(false);
    expect(liveWalk('plan', false, undefined)).toBe(false);
  });
  it('saves nothing: the preview camera keeps the walk clock and the walk pose stays untouched', () => {
    const walk = { x: 5, y: 6, heading: 1, pitch: -.12, elapsed: 42 };
    const frozen = { ...walk };
    let s = start();
    for (let i = 0; i < 50; i++) s = previewReducer(s, { type: 'progress', doneM: i * 13 });
    const camera = previewPose(s.path, s.doneM, walk);
    expect(camera.elapsed).toBe(42);
    expect(camera.pitch).toBe(-.12);
    expect(camera).not.toEqual(walk);
    expect(walk).toEqual(frozen);
  });
  it('writes progress as distance done of total', () => {
    expect(previewProgressText(120.4, 1432)).toBe('120 m of 1.43 km');
  });
});
