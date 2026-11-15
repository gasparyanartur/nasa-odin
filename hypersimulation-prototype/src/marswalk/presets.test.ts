import { describe, expect, it } from 'vitest';
import { REGIONS as TEAM_REGIONS, canPlan } from '../datasets/catalog';
import { SCIENCE } from '../datasets/geology';
import { DEFAULT_SETUP, FEATURES, GROUPS, MISSIONS, REGIONS, applyMission, availableIn, effective, hudPatch, isOn, normal, overlaysFor, pickMission, pickRegion, summary, toggleFeature } from './presets';

describe('Marswalk presets in the team app', () => {
  it('ports every Marswalk feature with info, source field and a grouped place', () => {
    expect(FEATURES).toHaveLength(28);
    expect(new Set(FEATURES.map(f => f.id)).size).toBe(28);
    for (const f of FEATURES) { expect(GROUPS.some(g => g.id === f.group)).toBe(true); expect(f.info).toBeTruthy(); expect(typeof f.source).toBe('string'); }
    expect(FEATURES.filter(f => f.locked).map(f => f.id)).toEqual(['light_ground', 'light_time', 'light_radiation', 'return_now', 'way_back']);
    expect(FEATURES.every(f => !/in this app yet/.test(f.info))).toBe(true);
  });

  it('uses the three team regions and their real planning capability', () => {
    expect(REGIONS.map(r => r.id).sort()).toEqual(TEAM_REGIONS.map(r => r.id).sort());
    for (const r of REGIONS) expect(r.walk).toBe(canPlan(TEAM_REGIONS.find(t => t.id === r.id)));
    for (const f of FEATURES) for (const r of REGIONS) if (!f.availability[r.id].available) expect(f.availability[r.id].note).toBeTruthy();
  });

  it('judges availability against the team data', () => {
    expect(availableIn('geo', 'gale-bradbury')).toBe(Boolean(SCIENCE.regions['gale-bradbury']));
    expect(availableIn('geo', 'jezero')).toBe(Boolean(SCIENCE.regions.jezero));
    expect(availableIn('geo', 'gale-boxwork')).toBe(Boolean(SCIENCE.regions['gale-boxwork']));
    for (const r of REGIONS) { expect(availableIn('comp', r.id)).toBe(true); expect(availableIn('global', r.id)).toBe(true); }
    for (const id of ['area', 'chem', 'vnotes'] as const) for (const r of REGIONS) expect(availableIn(id, r.id)).toBe(false);
    expect(['stops', 'drill', 'path', 'nogo'].every(id => availableIn(id as 'stops', 'gale-boxwork'))).toBe(true);
    expect(FEATURES.filter(f => availableIn(f.id, 'jezero')).map(f => f.id)).toEqual(['geo', 'comp', 'global']);
  });

  it('applies a mission only where its features exist', () => {
    const box = applyMission('geology', 'gale-boxwork');
    expect(box.stops && box.drill && box.path && !box.geo).toBe(true);
    const brad = applyMission('geology', 'gale-bradbury');
    expect(brad.geo && !brad.stops && !brad.path).toBe(true);
    const water = applyMission('water', 'gale-boxwork');
    expect(water.comp && !water.chem && !water.vnotes).toBe(true);
    expect(applyMission('safety', 'gale-bradbury').hist).toBe(true);
    expect(applyMission('safety', 'gale-boxwork').hist).toBe(false);
  });

  it('a switch flipped and flipped back returns to the walk choice, without re-applying anything else', () => {
    const once = toggleFeature(DEFAULT_SETUP, 'stops');
    expect(once.mission).toBe('custom');
    expect(once.features.stops).toBe(false);
    const twice = toggleFeature(once, 'stops');
    expect(twice.mission).toBe('geology');
    expect(twice.features).toEqual(DEFAULT_SETUP.features);
    expect(toggleFeature(toggleFeature(DEFAULT_SETUP, 'stops'), 'drill').mission).toBe('custom');
  });

  it('changes features only when the user picks a mission, region or switch', () => {
    const s = pickMission(DEFAULT_SETUP, 'safety');
    expect(s.mission).toBe('safety');
    expect(isOn(s, 'slope')).toBe(true);
    const t = toggleFeature(s, 'slope');
    expect(t.mission).toBe('custom');
    expect(isOn(t, 'slope')).toBe(false);
    expect(toggleFeature(t, 'light_time')).toEqual(t);
    expect(toggleFeature(t, 'chem')).toEqual(t);
    const moved = pickRegion(t, 'gale-bradbury');
    expect(moved.mission).toBe('custom');
    expect(isOn(moved, 'slope')).toBe(false);
    expect(isOn(moved, 'stops')).toBe(false);
    const back = pickRegion(moved, 'gale-boxwork');
    expect(isOn(back, 'stops')).toBe(true);
    expect(isOn(pickRegion(pickMission(DEFAULT_SETUP, 'geology'), 'jezero'), 'light_ground')).toBe(false);
    expect(effective(pickRegion(DEFAULT_SETUP, 'gale-bradbury')).geo).toBe(true);
  });

  it('reads any stored value as a safe setup', () => {
    expect(normal(null)).toEqual(normal(DEFAULT_SETUP));
    expect(normal({ region: 'mars', mission: 'nope', features: { slope: 'yes' } })).toEqual(normal(DEFAULT_SETUP));
    expect(normal({ ...DEFAULT_SETUP, features: { ...DEFAULT_SETUP.features, light_ground: false } }).features.light_ground).toBe(true);
    expect(MISSIONS.map(m => m.id)).toEqual(['geology', 'safety', 'water', 'custom']);
  });

  it('maps a setup onto the team overlays and HUD switches and sums it up', () => {
    expect(overlaysFor(DEFAULT_SETUP)).toEqual(['imagery']);
    expect(overlaysFor(pickMission(DEFAULT_SETUP, 'safety'))).toEqual(['imagery', 'elevation', 'slope']);
    expect(hudPatch(DEFAULT_SETUP)).toEqual({ visor: true, waypoints: true, next: true, marsTime: true, earthTime: true });
    const sum = summary(DEFAULT_SETUP);
    expect(sum.alwaysOn).toHaveLength(5);
    expect(sum.unavailable.map(u => u.label)).toContain('Geology units (USGS map)');
    expect(sum.turnsOn.length + sum.off.length + sum.alwaysOn.length + sum.unavailable.length).toBe(FEATURES.length);
  });
});
