import raw from '../../public/marswalk/science-route.json';
import { localToGeo, type Alternative, type Meta, type Point, type Route, type Settings, type TerrainData } from '../mission/data';

export interface PreparedLeg { from: string; to: string; distanceM: number; maxSlopeDeg: number; climbM: number | null; descentM: number | null; pointRange: [number, number] }
export interface ReadmeLine { line: number; text: string }
export interface PreparedAssumption { id: string; value: number; unit: string; readme: ReadmeLine }

export interface PreparedRoute {
  schema: 'marswalk-science-route'; version: 1; origin: string;
  planner: { files: string[]; grid: string };
  marswalk: { commit: string; uncommittedChangesInPlannerOrData: boolean; inputs: string; inputsSameAsCommittedDefault: boolean };
  frame: { team: string; rule: string; groundScaleX: number };
  base: Point & { label: string; marswalk: Point };
  stops: (Point & { id: number; marswalk: Point })[];
  points: { unit: 'm'; columns: string[]; values: [number, number, number | null][] };
  legs: PreparedLeg[];
  totals: {
    distanceM: number; timeInSuitS: number;
    parts: { walkingS: number; stopsS: number; stopCount: number; workMinPerStop: number; walkingSpeedMps: number };
    method: string; steepestSlopeDeg: number; steepestLeg: string | null; slopeLimitDeg: number; roverRangeLimitM: number; farthestFromBaseM: number;
  };
  assumptions: PreparedAssumption[];
  noGoZones: string[];
}

export function parsePrepared(input: unknown): PreparedRoute {
  const p = input as PreparedRoute;
  if (!p || p.schema !== 'marswalk-science-route' || p.version !== 1) throw new Error('Not a Marswalk science route (schema marswalk-science-route, version 1).');
  if (p.points.values.length < 2 || p.points.values.some(v => !Number.isFinite(v[0]) || !Number.isFinite(v[1]))) throw new Error('The prepared route needs two or more finite points.');
  return p;
}

export const PREPARED: PreparedRoute = parsePrepared(raw);

export const PREPARED_NAME = 'Science walk, 8 stops';

/** Hours and minutes as the Marswalk app shows time in the suit. */
export function hoursMinutes(s: number): string {
  const total = Math.round(s / 60), h = Math.floor(total / 60), m = total % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

export const kilometres = (m: number) => `${(m / 1000).toFixed(1)} km`;

const assumption = (id: string, r: PreparedRoute = PREPARED) => r.assumptions.find(a => a.id === id);

/** One source line per figure, quoted from the Marswalk README assumptions table. */
export function sourceLine(id: string, r: PreparedRoute = PREPARED): string {
  const a = assumption(id, r);
  if (!a) return 'No source line recorded.';
  const cells = a.readme.text.split('|').map(c => c.trim()).filter(Boolean);
  return `${cells.join(', ')} (Marswalk README.md line ${a.readme.line})`;
}

/**
 * The prepared walk in the shape of a team route, so the map, the HUD and Look closer draw it like the planner's
 * routes. Its time is the Marswalk time in the suit (walking plus the time at the stops); no conditions were
 * evaluated for it, so they read unknown.
 */
export function preparedAlternative(meta: Meta, settings: Pick<Settings, 'doseRateMicroGyH'>, r: PreparedRoute = PREPARED): Alternative {
  const points: Route['points'] = r.points.values.map(([x, y, z]) => [x, y, z ?? NaN]);
  const geographic: Route['geographic'] = points.map(([x, y, z]) => { const [lon, lat] = localToGeo(meta, { x, y }); return [lon, lat, z]; });
  const ascentM = r.legs.reduce((s, l) => s + (l.climbM ?? 0), 0), descentM = r.legs.reduce((s, l) => s + (l.descentM ?? 0), 0);
  const durationS = r.totals.timeInSuitS, doseMicroGy = durationS / 3600 * settings.doseRateMicroGyH;
  const metrics = { distanceM: r.totals.distanceM, durationS, ascentM, descentM, maxSlopeDeg: r.totals.steepestSlopeDeg, doseMicroGy, terrainCost: r.totals.distanceM };
  const home: Route = { mode: 'shortest', points: points.slice(-1), geographic: geographic.slice(-1), metrics: { ...metrics, distanceM: 0, durationS: 0, ascentM: 0, descentM: 0, doseMicroGy: 0, terrainCost: 0 } };
  return {
    mode: 'shortest', points, geographic, metrics, returnRoute: home, roundTripS: durationS, roundTripDoseMicroGy: doseMicroGy, warnings: [],
    conditions: { departureHour: 0, arrivalHour: 0, minTemperatureK: null, coldSeconds: 0, unknownSeconds: 0, doseMicroGy, warnings: [], status: 'unknown' },
    departures: [],
  };
}

export const preparedEnd = (r: PreparedRoute = PREPARED): Point => { const v = r.points.values.at(-1)!; return { x: v[0], y: v[1] }; };

/** A Marswalk slope cell value (5 m baseline on the 1 m grid), as src/terrain.js slopeAt reads it, at a team-frame point. */
export interface SlopeCells { cells: number; sizeM: number; scaleDeg: number; nodata: number; groundScaleX: number; values: Uint8Array }

export function cellSlope(g: SlopeCells, p: Point): number | null {
  const x = p.x / g.groundScaleX, y = p.y, half = g.sizeM / 2, cell = g.sizeM / g.cells;
  if (!(Math.abs(x) <= half && Math.abs(y) <= half)) return null;
  const i = Math.min(Math.floor((x + half) / cell), g.cells - 1), j = Math.min(Math.floor((half - y) / cell), g.cells - 1);
  const v = g.values[j * g.cells + i];
  return v === g.nodata ? null : v * g.scaleDeg;
}

/**
 * The 1 m walking grid used while the prepared route is followed: heights from the full 1 m height grid and slopes
 * from the Marswalk 1 m slope cells, on 1 m team-frame nodes over the team area. The walk then checks the same
 * slope map the route was planned on, against the walker's own slope limit.
 */
export function walkTerrain(data: TerrainData, height: (x: number, y: number) => number | null, slope: SlopeCells): TerrainData {
  const extentM = data.meta.extentM, stepM = 1, size = Math.round(extentM / stepM) + 1, n = size * size;
  const heights = new Float32Array(n), slopes = new Float32Array(n), valid = new Uint8Array(n);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const i = r * size + c, p = { x: c * stepM - extentM / 2, y: extentM / 2 - r * stepM };
    const z = height(p.x, p.y), s = cellSlope(slope, p);
    heights[i] = z ?? NaN; slopes[i] = s ?? NaN; valid[i] = z !== null && s !== null ? 1 : 0;
  }
  return { ...data, meta: { ...data.meta, size, stepM }, heights, slopes, valid };
}
