import type { RegionId } from '../datasets/catalog';
import type { IconName } from '../design/icons';
import { FEATURES, MISSIONS, availableIn, type FeatureId, type MissionId } from './presets';

export const FEATURE_ICON: Record<FeatureId, IconName> = {
  light_ground: 'ground', light_time: 'time', light_radiation: 'radiation', return_now: 'warning', way_back: 'back',
  orbit: 'photo', height: 'height', slope: 'ground', nogo: 'nogo',
  airt: 'thermo', groundt: 'thermo', dose: 'radiation', spacewx: 'sun',
  stops: 'stop', drill: 'drill', geo: 'geology', comp: 'layers', path: 'route',
  hist: 'history', lapse: 'play',
  routes: 'route', area: 'area', global: 'layers',
  nav: 'compass', clocks: 'clock', chem: 'water',
  fnotes: 'note', vnotes: 'mic',
};

export const MISSION_ICON: Record<MissionId, IconName> = { geology: 'geology', safety: 'safety', water: 'water', custom: 'custom' };

// The words each mission card lists (presets.ts `turnsOn`) and the features behind each word.
const WORD_FEATURES: Record<string, FeatureId[]> = {
  'Science stops with tasks': ['stops'], 'Drill sites': ['drill'], 'Geology units (USGS map)': ['geo'], 'Curiosity path': ['path'],
  'Slope and no-go zones': ['slope', 'nogo'], 'Radiation dose and space weather': ['dose', 'spacewx'], '19 sols of records': ['hist'], 'Route comparison and replan': ['routes'],
  'Ground composition': ['comp'], 'Moisture markers in the helmet': ['chem'], 'Geology units': ['geo'], 'Ground temperature': ['groundt'],
};

export type WordState = 'on' | 'not-here' | 'not-built';
export interface MissionWord { word: string; state: WordState; note: string }

const notBuilt = (id: FeatureId) => FEATURES.find(f => f.id === id)!.availability['gale-boxwork'].note.startsWith('Not built yet');

export function missionWords(mission: MissionId, region: RegionId): MissionWord[] {
  const m = MISSIONS.find(x => x.id === mission)!;
  return m.turnsOn.map(word => {
    const ids = WORD_FEATURES[word] ?? [];
    if (ids.some(id => availableIn(id, region))) return { word, state: 'on', note: '' };
    const feat = FEATURES.find(f => f.id === ids[0]);
    const note = feat?.availability[region]?.note ?? '';
    return { word, state: ids.length && ids.every(notBuilt) ? 'not-built' : 'not-here', note };
  });
}

export const WORD_STATE_TEXT: Record<Exclude<WordState, 'on'>, string> = { 'not-here': 'Not available in this region', 'not-built': 'Not built yet' };

export function stateWord(on: boolean, locked: boolean, available: boolean, note: string): string {
  if (!available) return note.startsWith('Not built yet') ? 'Not built yet' : 'Not available in this region';
  if (locked) return 'Always on';
  return on ? 'On' : 'Off';
}

export const fmt = (v: number | null, unit: string, digits = 0) => v === null ? 'No data' : `${v.toFixed(digits)} ${unit === 'deg' ? '°' : unit}`.replace(' °', '°');
