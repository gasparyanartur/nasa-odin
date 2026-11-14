// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.

const STORAGE_KEY = "marswalk.team-inputs.v1";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string";

const fail = (field, problem) => ({ ok: false, field, problem });

function checkFlags(flags, names, field) {
  if (!isObj(flags)) return fail(field, "must be an object with true or false per field");
  for (const n of names) {
    if (typeof flags[n] !== "boolean") return fail(`${field}.${n}`, "must be true or false");
  }
  return null;
}

function checkParam(obj, key, test, rule) {
  const p = obj[key];
  if (!isObj(p)) return fail(key, "missing or not an object");
  if (!isNum(p.value)) return fail(`${key}.value`, "must be a number");
  if (!test(p.value)) return fail(`${key}.value`, rule);
  if (typeof p.placeholder !== "boolean") return fail(`${key}.placeholder`, "must be true or false");
  return null;
}

export function validateInputs(obj) {
  if (!isObj(obj)) return fail("(file)", "must be a JSON object");
  if (typeof obj.placeholder !== "boolean") return fail("placeholder", "must be true or false");
  if (obj.signed_off_by !== null && !isStr(obj.signed_off_by)) return fail("signed_off_by", "must be null or text");

  const b = obj.base;
  if (!isObj(b)) return fail("base", "missing or not an object");
  if (!isNum(b.x)) return fail("base.x", "must be a number");
  if (!isNum(b.y)) return fail("base.y", "must be a number");
  if (!isStr(b.label)) return fail("base.label", "must be text");
  if (typeof b.assumption !== "boolean") return fail("base.assumption", "must be true or false");
  if (b.placeholder !== undefined && typeof b.placeholder !== "boolean") return fail("base.placeholder", "must be true or false");

  const params = [
    ["walking_speed_m_s", (v) => v > 0, "must be above 0"],
    ["work_time_min_per_station", (v) => v >= 0, "must be 0 or more"],
    ["partner_trail_m", (v) => v > 0, "must be above 0"],
    ["hazard_start_min", (v) => v >= 0, "must be 0 or more"],
    ["start_lmst_hour", (v) => v >= 0 && v < 24, "must be at least 0 and below 24"],
  ];
  for (const [key, test, rule] of params) {
    const err = checkParam(obj, key, test, rule);
    if (err) return err;
  }

  if (!Array.isArray(obj.stations)) return fail("stations", "missing or not a list");
  const ids = new Set();
  for (let i = 0; i < obj.stations.length; i++) {
    const s = obj.stations[i];
    const f = `stations[${i}]`;
    if (!isObj(s)) return fail(f, "must be an object");
    if (!Number.isInteger(s.id)) return fail(`${f}.id`, "must be a whole number");
    if (ids.has(s.id)) return fail(`${f}.id`, "duplicate station id");
    ids.add(s.id);
    if (!isNum(s.x)) return fail(`${f}.x`, "must be a number");
    if (!isNum(s.y)) return fail(`${f}.y`, "must be a number");
    if (s.kind !== "ridge" && s.kind !== "hollow") return fail(`${f}.kind`, 'must be "ridge" or "hollow"');
    if (typeof s.on_path !== "boolean") return fail(`${f}.on_path`, "must be true or false");
    if (!isStr(s.task)) return fail(`${f}.task`, "must be text");
    if (s.photo !== null && !isStr(s.photo)) return fail(`${f}.photo`, "must be null or a file name");
    const err = checkFlags(s.placeholder, ["position", "kind", "task"], `${f}.placeholder`);
    if (err) return err;
  }

  if (!Array.isArray(obj.no_go)) return fail("no_go", "missing or not a list");
  for (let i = 0; i < obj.no_go.length; i++) {
    const z = obj.no_go[i];
    const f = `no_go[${i}]`;
    if (!isObj(z)) return fail(f, "must be an object");
    if (!(isStr(z.id) || Number.isInteger(z.id))) return fail(`${f}.id`, "must be text or a whole number");
    if (!isStr(z.label)) return fail(`${f}.label`, "must be text");
    if (!Array.isArray(z.polygon) || z.polygon.length < 3) return fail(`${f}.polygon`, "needs at least 3 points");
    for (let k = 0; k < z.polygon.length; k++) {
      const p = z.polygon[k];
      if (!Array.isArray(p) || p.length !== 2 || !isNum(p[0]) || !isNum(p[1])) {
        return fail(`${f}.polygon[${k}]`, "must be a pair of numbers [x, y]");
      }
    }
    if (typeof z.placeholder !== "boolean") return fail(`${f}.placeholder`, "must be true or false");
  }

  if (!Array.isArray(obj.drill_sites)) return fail("drill_sites", "missing or not a list");
  for (let i = 0; i < obj.drill_sites.length; i++) {
    const d = obj.drill_sites[i];
    const f = `drill_sites[${i}]`;
    if (!isObj(d)) return fail(f, "must be an object");
    if (!isStr(d.name)) return fail(`${f}.name`, "must be text");
    if (d.x !== null && !isNum(d.x)) return fail(`${f}.x`, "must be a number or null");
    if (d.y !== null && !isNum(d.y)) return fail(`${f}.y`, "must be a number or null");
    for (const k of ["kind", "reported", "source_url", "position_note"]) {
      if (!isStr(d[k])) return fail(`${f}.${k}`, "must be text");
    }
  }

  return { ok: true, inputs: JSON.parse(JSON.stringify(obj)) };
}

// The browser's local storage, or null: reading window.localStorage itself throws where site data is blocked.
export function safeStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function saveLocal(inputs, storage = safeStorage()) {
  storage.setItem(STORAGE_KEY, JSON.stringify(inputs));
}

export function clearLocal(storage = safeStorage()) {
  storage.removeItem(STORAGE_KEY);
}

// Returns null when nothing is stored; otherwise the validateInputs result for the stored text.
export function loadLocal(storage = safeStorage()) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("(stored file)", "is not valid JSON");
  }
  return validateInputs(parsed);
}

// The start-up choice: a valid stored copy wins; a corrupt or invalid one shows the error screen (ask resolves when the user
// continues) and is then removed, so the next load is clean. Nothing stored (or no storage) returns the committed copy.
export async function chooseInputs(committed, ask, storage = safeStorage()) {
  let stored = null;
  try {
    stored = loadLocal(storage);
  } catch {
    stored = null;
  }
  if (stored === null) return committed;
  if (stored.ok) return stored.inputs;
  await ask({ field: stored.field, problem: stored.problem });
  try {
    clearLocal(storage);
  } catch {
    // storage is blocked; the screen may show again on the next load
  }
  return committed;
}

export function exportJson(inputs) {
  return new Blob([JSON.stringify(inputs, null, 2) + "\n"], { type: "application/json" });
}
