// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Pure, immutable edits of the walk inputs. Every result passes validateInputs. An edit clears only the flag of the
// field it touched (plan A5).
import { validateInputs } from "../inputs.js";

// UI guards for the steppers. They keep a tap from making an input the validator would refuse. They are not science.
export const BOUNDS = {
  walking_speed_m_s: { min: 0.1, max: 2, step: 0.1, unit: "m/s", digits: 1 },
  work_time_min_per_station: { min: 0, max: 120, step: 5, unit: "min", digits: 0 },
  partner_trail_m: { min: 5, max: 200, step: 5, unit: "m", digits: 0 },
  hazard_start_min: { min: 0, max: 600, step: 10, unit: "min", digits: 0 },
  start_lmst_hour: { min: 0, max: 23.5, step: 0.5, unit: "LMST", digits: 1 },
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const round3 = (v) => Math.round(v * 1000) / 1000;

function checked(next) {
  const r = validateInputs(next);
  if (!r.ok) throw new Error(`${r.field}: ${r.problem}`);
  return r.inputs;
}

function renumber(stations) {
  stations.forEach((s, i) => {
    s.id = i + 1;
  });
}

function indexOf(inputs, id) {
  const i = inputs.stations.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`no station with id ${id}`);
  return i;
}

export function addStation(inputs, { x, y, kind = "ridge" }) {
  const next = clone(inputs);
  next.stations.push({
    id: next.stations.length + 1,
    x: round3(x),
    y: round3(y),
    kind: kind === "hollow" ? "hollow" : "ridge",
    on_path: false,
    task: "",
    photo: null,
    placeholder: { position: false, kind: false, task: false },
  });
  renumber(next.stations);
  return checked(next);
}

function place(station, x, y) {
  station.x = round3(x);
  station.y = round3(y);
  station.on_path = false;
  delete station.relief_m;
  delete station.relief_note;
  station.placeholder.position = false;
}

export function moveStation(inputs, id, { x, y }) {
  const next = clone(inputs);
  place(next.stations[indexOf(next, id)], x, y);
  return checked(next);
}

export function nudgeStation(inputs, id, dx, dy) {
  const next = clone(inputs);
  const s = next.stations[indexOf(next, id)];
  place(s, s.x + dx, s.y + dy);
  return checked(next);
}

export function setStationKind(inputs, id, kind) {
  if (kind !== "ridge" && kind !== "hollow") throw new Error('kind must be "ridge" or "hollow"');
  const next = clone(inputs);
  const s = next.stations[indexOf(next, id)];
  s.kind = kind;
  s.placeholder.kind = false;
  return checked(next);
}

export function setStationTask(inputs, id, task) {
  const next = clone(inputs);
  const s = next.stations[indexOf(next, id)];
  s.task = String(task);
  s.placeholder.task = false;
  return checked(next);
}

export function removeStation(inputs, id) {
  const next = clone(inputs);
  next.stations.splice(indexOf(next, id), 1);
  renumber(next.stations);
  return checked(next);
}

// dir +1 moves the station later in the order, -1 earlier. Ids are renumbered to match the new order. At the end of
// the list the inputs come back unchanged.
export function reorderStation(inputs, id, dir) {
  const next = clone(inputs);
  const i = indexOf(next, id);
  const j = i + (dir > 0 ? 1 : -1);
  if (j < 0 || j >= next.stations.length) return checked(next);
  [next.stations[i], next.stations[j]] = [next.stations[j], next.stations[i]];
  renumber(next.stations);
  return checked(next);
}

export function addNoGo(inputs, polygon, label) {
  if (!Array.isArray(polygon) || polygon.length < 3) throw new Error("a no-go zone needs at least 3 corners");
  const next = clone(inputs);
  let n = next.no_go.length + 1;
  const used = new Set(next.no_go.map((z) => String(z.id)));
  while (used.has(`zone-${n}`)) n++;
  next.no_go.push({
    id: `zone-${n}`,
    label: typeof label === "string" && label.trim() !== "" ? label : `No-go zone ${next.no_go.length + 1}`,
    polygon: polygon.map(([x, y]) => [round3(x), round3(y)]),
    placeholder: false,
  });
  return checked(next);
}

export function setNoGoLabel(inputs, id, label) {
  const next = clone(inputs);
  const z = next.no_go.find((q) => q.id === id);
  if (!z) throw new Error(`no zone with id ${id}`);
  z.label = String(label);
  z.placeholder = false;
  return checked(next);
}

export function removeNoGo(inputs, id) {
  const next = clone(inputs);
  next.no_go = next.no_go.filter((z) => z.id !== id);
  return checked(next);
}

export function clampValue(key, value) {
  const b = BOUNDS[key];
  if (!b) throw new Error(`unknown value "${key}"`);
  const v = Math.min(b.max, Math.max(b.min, Number(value)));
  const snapped = Math.round(v / b.step) * b.step;
  return Number(Math.min(b.max, Math.max(b.min, snapped)).toFixed(3));
}

export function setValue(inputs, key, value) {
  if (!BOUNDS[key]) throw new Error(`unknown value "${key}"`);
  if (!Number.isFinite(Number(value))) throw new Error(`${key}: must be a number`);
  const next = clone(inputs);
  next[key].value = clampValue(key, value);
  next[key].placeholder = false;
  return checked(next);
}

export function stepValue(inputs, key, dir) {
  return setValue(inputs, key, inputs[key].value + dir * BOUNDS[key].step);
}
