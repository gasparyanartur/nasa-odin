import { describe, expect, it } from 'vitest';
import { PLANET_VIEW_HEIGHT_M, globalLayerShown, layerKey, planetHint, surfaceGuard, zoomedIn } from './stationRules';

describe('planet-view hint', () => {
  const near = PLANET_VIEW_HEIGHT_M / 1000, far = 10_500_000;
  it('treats a region close-up as zoomed in and the home view as planet view', () => {
    expect(zoomedIn(3200)).toBe(true);
    expect(zoomedIn(near)).toBe(true);
    expect(zoomedIn(far)).toBe(false);
  });
  it('shows after a global layer change while zoomed in', () => {
    expect(planetHint(false, { type: 'layer', zoomedIn: zoomedIn(near), shown: true })).toBe(true);
  });
  it('never shows in planet view', () => {
    expect(planetHint(false, { type: 'layer', zoomedIn: zoomedIn(far), shown: true })).toBe(false);
  });
  it('does not show when the change leaves no global layer on screen', () => {
    expect(planetHint(true, { type: 'layer', zoomedIn: true, shown: false })).toBe(false);
  });
  it('disappears on zoom out or dismiss, and stays while still zoomed in', () => {
    expect(planetHint(true, { type: 'zoom', zoomedIn: false })).toBe(false);
    expect(planetHint(true, { type: 'zoom', zoomedIn: true })).toBe(true);
    expect(planetHint(true, { type: 'dismiss' })).toBe(false);
    expect(planetHint(false, { type: 'zoom', zoomedIn: true })).toBe(false);
  });
  it('keys a change on the basemap and environmental layer only', () => {
    const base = { basemapId: 'mola', basemapVisible: true, basemapOpacity: 1, environmentLayer: 'none', environmentOpacity: .65 };
    expect(layerKey(base)).not.toBe(layerKey({ ...base, basemapId: 'viking' }));
    expect(layerKey(base)).not.toBe(layerKey({ ...base, environmentLayer: 'grs-k' }));
    expect(globalLayerShown({ ...base, basemapVisible: false })).toBe(false);
    expect(globalLayerShown({ ...base, basemapVisible: false, environmentLayer: 'grs-k' })).toBe(true);
  });
});

describe('Enter surface guard', () => {
  it('asks first with no planned or chosen route, and enters directly with one', () => {
    expect(surfaceGuard(false)).toBe('confirm');
    expect(surfaceGuard(true)).toBe('enter');
  });
});
