// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Plans the default Marswalk science walk with the Marswalk planner itself and writes it in the team frame.
// Usage: node scripts/export_marswalk_route.mjs <path to the Marswalk app folder>
// The old Marswalk app (its src/planner.js) is no longer in this repository's tree; it remains in git history.
// In the repository root run: git worktree add ../marswalk-old 66ee212; then, in this folder, pass ../../marswalk-old/odin/app.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = process.argv[2] && resolve(process.argv[2]);
if (!app) { console.error('Give the Marswalk app folder (the one with src/planner.js) as the first argument.'); process.exit(2); }
const here = dirname(dirname(fileURLToPath(import.meta.url)));
const load = (rel) => import(pathToFileURL(join(app, rel)).href);

const { planRoute } = await load('src/planner.js');
const { buildConstraints, LIMITS } = await load('src/constraints.js');
const { gridPayload, PLANNER_LIMITS } = await load('src/controller.js');
const { createTerrain, toUint16, toUint8 } = await load('src/terrain.js');
const { validateInputs } = await load('src/inputs.js');

const data = join(app, 'public/data');
const bytes = (f) => { const b = readFileSync(join(data, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const scene = JSON.parse(readFileSync(join(data, 'scene.json'), 'utf8'));
// The app loads team-inputs.json first (src/loader.js SMALL_JSON); team-inputs.default.json is its committed fallback copy.
const inputsFile = 'team-inputs.json';
const checked = validateInputs(JSON.parse(readFileSync(join(data, inputsFile), 'utf8')));
if (!checked.ok) throw new Error(`Marswalk inputs rejected: ${checked.field} ${checked.problem}`);
const inputs = checked.inputs;
const sameAsDefault = readFileSync(join(data, inputsFile)).equals(readFileSync(join(data, 'team-inputs.default.json')));

// As src/main.js coreReady(): the core DEM and slope are set on the terrain, then the controller replans.
const terrain = createTerrain(scene, { surround: toUint16(bytes(scene.surround.dem), scene.surround.dem_samples ** 2, scene.surround.dem) });
terrain.setCore(toUint16(bytes(scene.core.dem), scene.core.dem_samples ** 2, scene.core.dem), toUint8(bytes(scene.core.slope), scene.core.slope_cells ** 2, scene.core.slope));
const grid = gridPayload(terrain, scene);
const route = planRoute({ grid, base: inputs.base, stations: inputs.stations, noGo: inputs.no_go, limits: PLANNER_LIMITS });
if (!route.ok) throw new Error(`The Marswalk planner refused the walk: ${route.blocking.limit}, ${route.blocking.detail}`);
const rows = buildConstraints({ route, inputs, dose: null });
const row = (id) => rows.find((r) => r.id === id);

const teamScene = JSON.parse(readFileSync(join(here, 'public/boxwork/detail/scene.json'), 'utf8'));
const groundScaleX = teamScene.ground_scale.x;
if (groundScaleX !== scene.ground_scale.x) throw new Error('The team and Marswalk scenes disagree on ground_scale.x.');
// src/marswalk/frame.ts marswalkToTeam: x_team = x_marswalk * groundScaleX, y_team = y_marswalk.
const toTeam = ([x, y]) => ({ x: x * groundScaleX, y });
const r3 = (v) => Math.round(v * 1000) / 1000;
const label = (id) => (id === 'base' ? 'Crew rover' : `Stop ${id}`);

const path = [];
const legs = route.legs.map((l) => {
  const start = path.length ? path.length - 1 : 0;
  l.path.forEach((p, k) => { if (k === 0 && path.length) return; const q = toTeam(p), z = terrain.heightAt(p[0], p[1]); path.push([r3(q.x), r3(q.y), z === null ? null : Math.round(z * 100) / 100]); });
  return { from: label(l.from.id), to: label(l.to.id), distanceM: l.distance_m, maxSlopeDeg: l.max_slope_deg, climbM: l.climb_m, descentM: l.descent_m, pointRange: [start, path.length - 1] };
});
const totalM = legs.reduce((s, l) => s + l.distanceM, 0);
const speed = inputs.walking_speed_m_s.value, workMin = inputs.work_time_min_per_station.value;
const walkingS = totalM / speed, stopsS = (legs.length - 1) * workMin * 60;

const readme = readFileSync(join(app, 'README.md'), 'utf8').split('\n');
const line = (prefix) => { const i = readme.findIndex((t) => t.startsWith(prefix)); if (i < 0) throw new Error(`README row not found: ${prefix}`); return { line: i + 1, text: readme[i] }; };
const git = (...a) => execFileSync('git', ['-C', app, ...a], { encoding: 'utf8' }).trim();
const commit = git('log', '-1', '--format=%H', '--', '.');
const dirty = git('status', '--porcelain', '--', 'src', 'public/data', 'README.md') !== '';

const out = {
  schema: 'marswalk-science-route',
  version: 1,
  origin: 'planned by the Marswalk planner on the 1 m terrain grid',
  planner: { files: ['src/planner.js planRoute', 'src/controller.js gridPayload and PLANNER_LIMITS', 'src/constraints.js buildConstraints'], grid: `${scene.core.slope_cells} x ${scene.core.slope_cells} slope cells of ${scene.core.size_m / scene.core.slope_cells} m, slope over a ${scene.slope.baseline_m} m baseline (${scene.slope.method})` },
  marswalk: { commit, uncommittedChangesInPlannerOrData: dirty, inputs: `public/data/${inputsFile}`, inputsSameAsCommittedDefault: sameAsDefault },
  frame: { team: 'ground metres east (x) and north (y) from the gale-boxwork-v1 origin', rule: 'x_team = x_marswalk * groundScaleX; y_team = y_marswalk (src/marswalk/frame.ts marswalkToTeam)', groundScaleX },
  base: { label: inputs.base.label, ...toTeam([inputs.base.x, inputs.base.y]), marswalk: { x: inputs.base.x, y: inputs.base.y } },
  stops: inputs.stations.map((s) => ({ id: s.id, ...toTeam([s.x, s.y]), marswalk: { x: s.x, y: s.y } })),
  points: { unit: 'm', columns: ['x east (team frame)', 'y north (team frame)', 'z areoid elevation from the Marswalk 1 m terrain'], values: path },
  legs,
  totals: {
    distanceM: totalM,
    timeInSuitS: walkingS + stopsS,
    parts: { walkingS, stopsS, stopCount: legs.length - 1, workMinPerStop: workMin, walkingSpeedMps: speed },
    method: row('suit_time').method,
    steepestSlopeDeg: row('slope_cap').value,
    steepestLeg: row('slope_cap').steepest_leg && legs[row('slope_cap').steepest_leg.index] ? `${legs[row('slope_cap').steepest_leg.index].from} to ${legs[row('slope_cap').steepest_leg.index].to}` : null,
    slopeLimitDeg: PLANNER_LIMITS.slope_cap_deg,
    roverRangeLimitM: PLANNER_LIMITS.rover_range_m,
    farthestFromBaseM: row('rover_range').value,
  },
  assumptions: [
    { id: 'walking_speed', value: speed, unit: 'm/s', readme: line('| Walking speed |') },
    { id: 'work_time_per_stop', value: workMin, unit: 'min', readme: line('| Work time per station |') },
    { id: 'slope_cap', value: PLANNER_LIMITS.slope_cap_deg, unit: 'deg', readme: line('| Slope cap |') },
    { id: 'rover_range', value: PLANNER_LIMITS.rover_range_m, unit: 'm', readme: line('| Distance from the crew rover |') },
    { id: 'suit_time_limit', value: LIMITS.suit_time_max_h, unit: 'h', readme: line('| Total time in suit |') },
  ],
  noGoZones: inputs.no_go.map((z) => z.label),
};
writeFileSync(join(here, 'public/marswalk/science-route.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`legs ${legs.length}, points ${path.length}, ${totalM.toFixed(1)} m, ${((walkingS + stopsS) / 60).toFixed(1)} min in suit (walking ${(walkingS / 60).toFixed(1)}, stops ${(stopsS / 60).toFixed(0)}), steepest ${out.totals.steepestSlopeDeg.toFixed(2)} deg, commit ${commit.slice(0, 8)}${dirty ? ' (dirty)' : ''}`);
