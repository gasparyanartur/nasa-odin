import type { OverlayId, RegionId } from '../datasets/catalog';
import type { HudSettings } from '../mission/HudSettings';

export type GroupId = 'safety' | 'map' | 'air' | 'rocks' | 'records' | 'routes' | 'helmet' | 'notes';
export type MissionId = 'geology' | 'safety' | 'water' | 'custom';
export type FeatureId =
  | 'light_ground' | 'light_time' | 'light_radiation' | 'return_now' | 'way_back'
  | 'orbit' | 'height' | 'slope' | 'nogo'
  | 'airt' | 'groundt' | 'dose' | 'spacewx'
  | 'stops' | 'drill' | 'geo' | 'comp' | 'path'
  | 'hist' | 'lapse'
  | 'routes' | 'area' | 'global'
  | 'nav' | 'clocks' | 'chem'
  | 'fnotes' | 'vnotes';

export interface Availability { available: boolean; note: string }

export interface Feature {
  id: FeatureId;
  group: GroupId;
  label: string;
  info: string;
  source: string;
  locked: boolean;
  overlays: OverlayId[];
  availability: Record<RegionId, Availability>;
}

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'safety', label: 'Safety' },
  { id: 'map', label: 'Map and terrain' },
  { id: 'air', label: 'Air and sky' },
  { id: 'rocks', label: 'Rocks and science' },
  { id: 'records', label: 'Records' },
  { id: 'routes', label: 'Routes and wider area' },
  { id: 'helmet', label: 'Helmet view' },
  { id: 'notes', label: 'Notes' },
];

type Cell = boolean | [boolean, string];
const cell = (c: Cell): Availability => (typeof c === 'boolean' ? { available: c, note: '' } : { available: c[0], note: c[1] });
const where = (bradbury: Cell, boxwork: Cell, jezero: Cell): Record<RegionId, Availability> =>
  ({ 'gale-bradbury': cell(bradbury), 'gale-boxwork': cell(boxwork), jezero: cell(jezero) });

const NO_WALK: Cell = [false, 'No prepared terrain here, so no planning and no walk in the team app.'];
const WALK = (bradbury: Cell = true, boxwork: Cell = true) => where(bradbury, boxwork, NO_WALK);
const NOWHERE = (why: string) => where([false, why], [false, why], [false, why]);

const f = (id: FeatureId, group: GroupId, label: string, info: string, source: string, availability: Record<RegionId, Availability>, overlays: OverlayId[] = []): Feature =>
  ({ id, group, label, info, source, locked: false, overlays, availability });
const lock = (id: FeatureId, label: string, info: string, source: string, availability = WALK()): Feature =>
  ({ id, group: 'safety', label, info, source, locked: true, overlays: [], availability });

export const FEATURES: Feature[] = [
  lock('light_ground', 'Ground light', 'Shows if the ground under you is clear, steep or blocked. Always on.', 'Slope from the USGS Gale 1 m DEM mosaic; slope cap after Pena-Asensio et al. 2024'),
  lock('light_time', 'Time light', 'Shows how much of your suit time is left. Always on.', 'NASA-STD-3001 Vol 2 Rev C, note under Table 35'),
  lock('light_radiation', 'Radiation light', 'Shows if the radiation dose is inside the limit. Always on.', 'NASA Planetary Data System: MSL RAD RDR',
    WALK([true, 'RAD detector E mean of sol 10.'], [true, 'RAD detector B, sol 4600.'])),
  lock('return_now', 'RETURN NOW warning', 'Tells you to go back when a limit is reached. In this app it is a scenario, not a measured Mars event. Always on.', 'NASA CCMC DONKI: solar energetic particle event of 2025-05-13, replayed as a scenario'),
  lock('way_back', 'Way back to the crew rover', 'Keeps the line home to the crew rover in view. Always on.', ''),

  f('orbit', 'map', 'Orbit image 25 cm, colour or grey',
    'Shows the walk area as a picture taken from orbit, 25 cm per pixel, in colour or grey.',
    'USGS Astrogeology: MSL Gale 25 cm orthophoto mosaic and HiRISE colour mosaic (HiRISE: NASA/JPL-Caltech/University of Arizona; HRSC: ESA/DLR/FU Berlin)',
    where([true, 'Greyscale USGS orthophoto only, prepared for display.'], [true, 'HiRISE colour or greyscale.'], [false, 'Only the global CTX image, about 5 m per pixel (see Global maps).']), ['imagery']),
  f('height', 'map', 'Height 1 m',
    'Shows how high the ground is, in metres, from a 1 m terrain model.',
    'USGS Astrogeology: MSL Gale 1 m DEM mosaic (HRSC, CTX and HiRISE, tied to MOLA)',
    WALK([true, '5 m prepared grid from the 1 m DEM mosaic.'], [true, '1 m core height posts, 5 m analytical grid.']), ['elevation']),
  f('slope', 'map', 'Slope',
    'Shows how steep the ground is, in degrees, and marks the steep parts.',
    'Derived from the USGS Astrogeology 1 m DEM mosaic; slope cap after Pena-Asensio 2024',
    WALK(), ['slope']),
  f('nogo', 'map', 'No-go zones',
    'Marks the areas the route planner will not enter: marked areas and ground above the slope cap.',
    'Slope cap after Pena-Asensio 2024; marked areas drawn by the Marswalk team',
    WALK([false, 'No marked zones for this region. The planner slope limit still applies.'], [true, 'Two marked zones from Marswalk plus the slope cap.'])),

  f('airt', 'air', 'Air temperature, pressure and UV',
    'Shows air temperature, air pressure and ultraviolet light for the chosen sol.',
    'NASA Planetary Data System: MSL REMS RDR (Rover Environmental Monitoring Station)',
    where([true, 'Air temperature and pressure of sol 10; no UV in the bundled record.'], [true, 'Sol 4600; UV is a lower bound.'], [false, 'No local weather record is bundled.'])),
  f('groundt', 'air', 'Ground temperature',
    'Shows the ground brightness temperature for the chosen sol. It is not a contact temperature.',
    'NASA Planetary Data System: MSL REMS RDR (thermopile)',
    where([false, 'The bundled sol 10 record has no ground temperature. MRO MCS surface soundings are a separate orbital layer.'], [true, 'Sol 4600.'], [false, 'No local weather record is bundled.'])),
  f('dose', 'air', 'Radiation dose',
    'Shows the radiation dose rate for the chosen sol, in microGray per hour.',
    'NASA Planetary Data System: MSL RAD RDR; fallback Hassler et al. 2014',
    where([true, 'Detector E mean of sol 10.'], [true, 'Detector B, sol 4600.'], [false, 'No local radiation record is bundled.'])),
  f('spacewx', 'air', 'Space weather',
    'Replays a recorded solar particle event as a scenario. It does not claim an arrival at Mars.',
    'NASA CCMC DONKI: solar energetic particle event of 2025-05-13',
    WALK()),

  f('stops', 'rocks', 'Science stops with tasks',
    'Shows the stops on the walk and the task to do at each one.',
    'Stops and tasks chosen by the Marswalk team (assumption)',
    where([false, 'The team app science targets Rocknest and Yellowknife Bay serve this region instead.'], [true, 'Eight stops from Marswalk.'], [false, 'No stops for this region.'])),
  f('drill', 'rocks', 'Drill sites',
    'Marks where Curiosity drilled in the boxwork area. The positions are approximate.',
    'NASA Curiosity blog and NASA/JPL MSL waypoints',
    where([false, 'Boxwork drill sites only.'], [true, 'Two of three placed; the Valle de la Luna position is not published.'], [false, 'Boxwork drill sites only.'])),
  f('geo', 'rocks', 'Geology units (USGS map)',
    'Colours the ground by rock unit from the USGS geology map, at 1:20,000,000. Too coarse for single outcrops.',
    'Tanaka et al. (2014), Geologic map of Mars, USGS SIM 3292',
    where([true, 'Six units and eight contacts in the bundled extract.'], [false, 'The bundled extract is keyed to Bradbury and Jezero; the team app says it does not cover this site.'], [true, 'Seven units and thirteen contacts in the bundled extract.'])),
  f('comp', 'rocks', 'Ground composition (Mars Odyssey)',
    'Shows hydrogen, potassium and thorium in the ground from orbit. One value covers an area far larger than this walk.',
    'NASA Planetary Data System, PDS Geosciences node: Mars Odyssey GRS, unsmoothed 5 x 5 degree bins, 2002-06-04 to 2005-04-03',
    where([true, 'One 5 x 5 degree bin covers the whole region.'], [true, 'One 5 x 5 degree bin covers the whole region.'], [true, 'One 5 x 5 degree bin covers the whole region.'])),
  f('path', 'rocks', 'Curiosity path',
    'Draws the path Curiosity drove on sols 4534 to 4805.',
    'NASA/JPL MMGIS: MSL waypoints',
    where([false, 'The bundled path covers the boxwork campaign only.'], true, [false, 'Curiosity did not drive here.'])),

  f('hist', 'records', '19 sols of records, next-sol outlook',
    'Shows 19 sols of weather and radiation records and a simulated outlook for the next sol.',
    'NASA Planetary Data System: MSL REMS and RAD, sols 10 to 28; simulated sol 29 outlook (seven-sol same-hour median)',
    where([true, 'Curiosity site record, sols 10 to 28, outlook for sol 29.'], [false, 'Only sol 4600 is bundled for this site.'], [false, 'No local record is bundled.'])),
  f('lapse', 'records', 'Day timelapse',
    'Plays the readings of one day as a timelapse.', 'NASA Planetary Data System: MSL REMS RDR, hourly means',
    WALK([true, 'Sol 10.'], [true, 'Sol 4600.'])),

  f('routes', 'routes', 'Route comparison and replan',
    'Compares routes, shows the height profile and blocked area, and plans again when you change the map.', '',
    WALK()),
  f('area', 'routes', 'Larger area and corridors',
    'Shows the wider area and regional corridors around the walk.', '',
    NOWHERE('Not built yet in the team app (backlog FR-021, requested).')),
  f('global', 'routes', 'Global maps: Viking, MOLA, CTX',
    'Shows planet-wide maps: Viking colour, MOLA height and CTX image.',
    'NASA/JPL-Caltech/USGS Mars Trek: Viking MDIM 2.1 colour mosaic, MGS MOLA relief, MRO CTX imagery',
    where(true, true, true)),

  f('nav', 'helmet', 'Compass and next stop',
    'Shows the compass and the direction to the next stop in the helmet view.', '', WALK()),
  f('clocks', 'helmet', 'Mars and Earth clocks',
    'Shows Mars solar time and the Earth clock in the helmet view.', '', WALK()),
  f('chem', 'helmet', 'Chemical and moisture markers',
    'Shows chemical and moisture markers in the helmet view.', '',
    NOWHERE('Not built yet in the team app (backlog FR-020, requested).')),

  f('fnotes', 'notes', 'Field notes: text, readings, obstacles',
    'Lets you write notes, keep readings and draw obstacles on the map.', '', WALK()),
  f('vnotes', 'notes', 'Voice notes, "Note here"',
    'Lets you record a voice note from the helmet view.', '',
    NOWHERE('Not built yet in the team app (backlog FR-022, requested).')),
];

const IDS = FEATURES.map(x => x.id);
const BY_ID = new Map(FEATURES.map(x => [x.id, x]));

// Marswalk keeps Height and Slope off for Geology: both paint the whole map and Geology is the default walk.
const ON: Record<Exclude<MissionId, 'custom'>, string> = {
  geology: 'orbit nogo stops drill geo path nav clocks fnotes vnotes',
  safety: 'orbit height slope nogo airt groundt dose spacewx stops hist lapse routes nav clocks vnotes',
  water: 'orbit slope nogo groundt stops drill geo comp nav clocks chem fnotes vnotes',
};

export type FeatureMap = Record<FeatureId, boolean>;

function mapFor(onList: string): FeatureMap {
  const on = new Set(onList.split(' '));
  return Object.fromEntries(IDS.map(id => [id, BY_ID.get(id)!.locked || on.has(id)])) as FeatureMap;
}

export interface Mission { id: MissionId; label: string; sentence: string; turnsOn: string[]; features: FeatureMap }

export const MISSIONS: Mission[] = [
  { id: 'geology', label: 'Geology walk', sentence: 'Walk the ridges, stop at the rocks, and record what you find.',
    turnsOn: ['Science stops with tasks', 'Drill sites', 'Geology units (USGS map)', 'Curiosity path'], features: mapFor(ON.geology) },
  { id: 'safety', label: 'Safety watch', sentence: 'Keep the crew inside the limits: slope, radiation and weather first.',
    turnsOn: ['Slope and no-go zones', 'Radiation dose and space weather', '19 sols of records', 'Route comparison and replan'], features: mapFor(ON.safety) },
  { id: 'water', label: 'Water and chemistry search', sentence: 'Look for signs of water and the chemistry in the ground.',
    turnsOn: ['Ground composition', 'Moisture markers in the helmet', 'Geology units', 'Ground temperature'], features: mapFor(ON.water) },
  { id: 'custom', label: 'Custom', sentence: 'Choose every feature yourself.', turnsOn: [], features: mapFor(ON.geology) },
];

export interface PresetRegion { id: RegionId; label: string; note: string; walk: boolean }

export const REGIONS: PresetRegion[] = [
  { id: 'gale-boxwork', label: 'Gale · Mount Sharp Boxwork', note: 'The Marswalk walk: eight stops, two no-go zones, the Curiosity path.', walk: true },
  { id: 'gale-bradbury', label: 'Gale · Bradbury landing area', note: 'Curiosity landing area: 19 sols of records, USGS geology, science targets.', walk: true },
  { id: 'jezero', label: 'Jezero · Perseverance landing area', note: 'Orbital context only: global maps, geology and composition. No walk.', walk: false },
];

export interface Setup { region: RegionId; mission: MissionId; features: FeatureMap }

export const feature = (id: FeatureId) => BY_ID.get(id);
export const availableIn = (id: FeatureId, region: RegionId) => !!BY_ID.get(id)?.availability[region]?.available;

export function applyMission(missionId: MissionId, region: RegionId = 'gale-boxwork'): FeatureMap {
  const m = MISSIONS.find(x => x.id === missionId) ?? MISSIONS[0];
  return Object.fromEntries(IDS.map(id => [id, m.features[id] && availableIn(id, region)])) as FeatureMap;
}

export const DEFAULT_SETUP: Setup = { region: 'gale-boxwork', mission: 'geology', features: applyMission('geology', 'gale-boxwork') };

export function normal(setup: unknown): Setup {
  const s = (setup && typeof setup === 'object' ? setup : {}) as Partial<Setup>;
  const region = REGIONS.some(r => r.id === s.region) ? s.region! : DEFAULT_SETUP.region;
  const known = MISSIONS.some(m => m.id === s.mission);
  const mission = known ? s.mission! : DEFAULT_SETUP.mission;
  const base = applyMission(mission, region);
  const given = s.features && typeof s.features === 'object' ? s.features as Partial<Record<string, unknown>> : null;
  const features = Object.fromEntries(IDS.map(id => {
    const v = given && typeof given[id] === 'boolean' ? given[id] as boolean : base[id];
    return [id, BY_ID.get(id)!.locked || v];
  })) as FeatureMap;
  return { region, mission, features };
}

// A setup keeps the user's choices; a feature shows only where its data exists, so a Custom choice survives a region change.
export function effective(setup: unknown): FeatureMap {
  const cur = normal(setup);
  return Object.fromEntries(IDS.map(id => [id, cur.features[id] && availableIn(id, cur.region)])) as FeatureMap;
}

export const isOn = (setup: unknown, id: FeatureId) => BY_ID.has(id) && effective(setup)[id];

export function pickMission(setup: unknown, missionId: MissionId): Setup {
  const cur = normal(setup);
  const mission = MISSIONS.some(m => m.id === missionId) ? missionId : DEFAULT_SETUP.mission;
  return { region: cur.region, mission, features: mission === 'custom' ? cur.features : applyMission(mission, cur.region) };
}

export function pickRegion(setup: unknown, region: RegionId): Setup {
  const cur = normal(setup);
  if (!REGIONS.some(r => r.id === region)) return cur;
  return normal({ region, mission: cur.mission, features: cur.mission === 'custom' ? cur.features : applyMission(cur.mission, region) });
}

export function toggleFeature(setup: unknown, id: FeatureId): Setup {
  const cur = normal(setup);
  const feat = BY_ID.get(id);
  if (!feat || feat.locked || !availableIn(id, cur.region)) return cur;
  return { region: cur.region, mission: 'custom', features: { ...cur.features, [id]: !cur.features[id] } };
}

export function overlaysFor(setup: unknown): OverlayId[] {
  const on = effective(setup), out: OverlayId[] = [];
  for (const feat of FEATURES) if (on[feat.id]) for (const o of feat.overlays) if (!out.includes(o)) out.push(o);
  return out;
}

export function hudPatch(setup: unknown): Pick<HudSettings, 'visor' | 'waypoints' | 'next' | 'marsTime' | 'earthTime'> {
  const on = effective(setup);
  return { visor: on.nav, waypoints: on.nav, next: on.nav, marsTime: on.clocks, earthTime: on.clocks };
}

export interface Summary { turnsOn: string[]; off: string[]; alwaysOn: string[]; unavailable: { label: string; note: string }[] }

export function summary(setup: unknown): Summary {
  const cur = normal(setup), on = effective(cur);
  const out: Summary = { turnsOn: [], off: [], alwaysOn: [], unavailable: [] };
  for (const feat of FEATURES) {
    const a = feat.availability[cur.region];
    if (!a.available) out.unavailable.push({ label: feat.label, note: a.note });
    else if (feat.locked) out.alwaysOn.push(feat.label);
    else if (on[feat.id]) out.turnsOn.push(feat.label);
    else out.off.push(feat.label);
  }
  return out;
}
