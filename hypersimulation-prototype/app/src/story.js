// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The guided story: five steps, one thing per screen. Pure: what each step shows (view, camera, layers, overlays,
// walk time, hazard, play state) and what its caption says (headline, text, at most four key numbers, the Next label).
// Numbers are specs {value, unit, prov, detail}; the screen builds them with num(). No DOM here.
import { minimumRows } from "./ui/minimums.js";
import { fmtDuration } from "./provenance.js";
import { LIMITS, LIMIT_SOURCES } from "./constraints.js";
import { STEP_COUNT } from "./state.js";

export const STEPS = [
  { n: 1, id: "place", name: "Place" },
  { n: 2, id: "plan", name: "Plan" },
  { n: 3, id: "walk", name: "Walk" },
  { n: 4, id: "hazard", name: "Hazard" },
  { n: 5, id: "check", name: "Check" },
];

// Step 1 camera: the middle of the boxwork ridges, tilted, close enough that the ridges fill the view.
export const PLACE_VIEW = { x: -120, y: -240, tilt_deg: 57, heading_deg: 0, span_m: 430 };
// One slow turn around the centre takes this long.
export const TURN_S = 90;
export const WALK_SPEED = 60;

const TIME_NOTE = "computed from the walking speed and the work time per station, both assumptions with no source";
const LIMIT_SOURCE_IDS = ["dem_1m", "pena_asensio_2024", "drats_2022", "nasa_std_3001_v2", "nasa_std_3001_v1"];

export function clampStep(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(STEP_COUNT, Math.max(1, v));
}
export const nextStep = (n) => clampStep(clampStep(n) + 1);
export const prevStep = (n) => clampStep(clampStep(n) - 1);
export const stepName = (n) => STEPS[clampStep(n) - 1].name;

// "Step 2 of 5 - Plan"
export function stepLabel(n) {
  const s = clampStep(n);
  return `Step ${s} of ${STEP_COUNT} - ${stepName(s)}`;
}

// The story step an address asks for. ?step= wins; the older options map onto steps: ?view=walk or ?t= to the walk
// (paused at t when t is given; a t at or after the hazard start, hazard_s, goes to the hazard step), ?hazard=1 to the
// hazard, ?panel= to the plan (rover check: step 5) with the drawer open on that tab, ?sheet=route-card to the plan.
// No option: step 1. The controller clamps t to the end of the walk.
export function storyStart(opts = {}, { hazard_s = null } = {}) {
  const t = Number.isFinite(opts.t) && opts.t > 0 ? opts.t : null;
  let step = 1;
  if (opts.hazard) step = 4;
  else if (opts.view === "walk" || t !== null) step = t !== null && Number.isFinite(hazard_s) && t >= hazard_s ? 4 : 3;
  else if (opts.panel === "rover") step = 5;
  else if (opts.panel || opts.sheet) step = 2;
  if (Number.isInteger(opts.step) && opts.step >= 1 && opts.step <= STEP_COUNT) step = opts.step;
  return {
    step,
    t: step === 3 || step === 4 ? t : null,
    drawer: !!opts.panel,
    panel: opts.panel || null,
    showSources: !!opts.showSources,
  };
}

// The address of a step, with every other option kept (for history.replaceState; the page never reloads). panel: the
// open drawer tab, or null while the drawer is closed (then the address names no panel).
export function stepSearch(search, step, sources, panel = null) {
  const q = new URLSearchParams(typeof search === "string" ? search : "");
  const twoD = q.get("view") === "2d";
  for (const k of ["step", "view", "t", "hazard", "sources", "sheet", "panel"]) q.delete(k);
  if (twoD) q.set("view", "2d");
  q.set("step", String(clampStep(step)));
  if (sources) q.set("sources", "1");
  if (panel) q.set("panel", panel);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// Small numbers in words, so a caption line needs no digits ("one at the limit").
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export function countWord(n) {
  return Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : null;
}

// The station counts of the plan caption: {total, pairs} (a pair is one ridge and one hollow), or null without inputs.
export function stationCounts(inputs) {
  const list = inputs && Array.isArray(inputs.stations) ? inputs.stations : null;
  if (!list) return null;
  const ridge = list.filter((s) => s.kind === "ridge").length;
  const hollow = list.filter((s) => s.kind === "hollow").length;
  return { total: list.length, pairs: Math.min(ridge, hollow) };
}

const capital = (w) => w.charAt(0).toUpperCase() + w.slice(1);

// "One walk, eight stations" and "Four ridge and hollow pairs." from the counts; counts in words, never digits.
// Without counts the caption keeps the committed walk: eight stations, four pairs.
function planWords(counts) {
  const c = counts || { total: 8, pairs: 4 };
  const total = countWord(c.total);
  const headline = total === null ? "One walk, many stations" : `One walk, ${total} station${c.total === 1 ? "" : "s"}`;
  const pairWord = countWord(c.pairs);
  const pairs = c.pairs === 0
    ? ""
    : pairWord === null ? "Ridge and hollow pairs." : `${capital(pairWord)} ridge and hollow pair${c.pairs === 1 ? "" : "s"}.`;
  return { headline, pairs };
}

// "2025-05-13T18:14Z" -> "13 May 2025"
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function dateWords(iso) {
  const m = typeof iso === "string" ? iso.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}

// The plan facts the captions use, from state.plan. limits: the limits with a value (the walk dose has none).
export function planFacts(plan) {
  const p = plan || {};
  const ok = p.status === "ok" && p.route;
  const rows = minimumRows(p.constraints).filter((r) => !r.info);
  const kept = rows.filter((r) => r.state === "pass" || r.state === "caution" || r.state === "limit").length;
  const atLimit = rows.filter((r) => r.state === "limit").length;
  const known = rows.filter((r) => r.state !== "nodata").length;
  const slope = (p.constraints || []).find((r) => r.id === "slope_cap");
  return {
    status: p.status || "idle",
    empty: !!p.empty,
    total_m: ok ? p.route.total_m : null,
    duration_s: p.schedule && Number.isFinite(p.schedule.duration_s) ? p.schedule.duration_s : null,
    hazard_s: p.schedule && Number.isFinite(p.schedule.hazard_start_s) ? p.schedule.hazard_start_s : null,
    steepest_deg: ok && slope && Number.isFinite(slope.value) ? slope.value : null,
    limits_total: rows.length,
    limits_known: known,
    limits_kept: ok ? kept : null,
    at_limit: ok ? atLimit : 0,
  };
}

const derived = (method, sources = ["dem_1m"]) => ({ method, sources });

// What each step shows. facts: {renderer, plan: planFacts(), rover: {n, under_pct, median_deg} | null, sep_date,
// core_m, stations: stationCounts()}. A caption part {nodata: true} is the NO DATA mark. Returns {step, id, name, view, camera, layers: {on, off}, overlays: {route, marks, legs}, walk:
// {t: 0 | "hazard" | null, hazard, playing, speed}, chips, minimap, caption: {headline, text, short?, numbers, key,
// links, next_label, back, end, bar}}. short: the one short sentence narrow screens show instead of text.
export function stepConfig(step, facts = {}) {
  const n = clampStep(step);
  const plan = facts.plan || planFacts(null);
  const ready = plan.status === "ok";
  const base = { step: n, id: STEPS[n - 1].id, name: STEPS[n - 1].name, chips: false, minimap: false };
  const waitText = plan.status === "no_route"
    ? ["No route was found. Open Details to see the limit that blocks it."]
    : plan.empty
      ? ["There are no stations yet. Open Details and add one in the editor."]
      : ["Planning the route. One moment."];

  if (n === 1) {
    const core = Number.isFinite(facts.core_m) ? Math.round(facts.core_m / 100) / 10 : null;
    return {
      ...base,
      view: "plan",
      camera: { mode: "orbit", ...PLACE_VIEW, turn: facts.renderer !== "2d" },
      layers: { on: ["image"], off: ["stations", "no_go", "rover_path", "drill_sites"] },
      overlays: { route: false, marks: false, legs: false },
      walk: { t: null, hazard: false, playing: false },
      caption: {
        headline: "The boxwork ridges of Mount Sharp",
        text: [
          "Gale crater, Mars. Real terrain at ",
          { value: 1, unit: "m", prov: "source", detail: { source: "dem_1m", label: "USGS terrain" } },
          " and a real orbit image at ",
          { value: 25, unit: "cm", prov: "source", detail: { source: "image_25cm", label: "USGS image" } },
          ", cut from USGS and NASA files.",
        ],
        numbers: core === null ? [] : [
          { id: "area", label: "Area shown", value: `${core} x ${core}`, unit: "km", prov: "source", detail: { source: "dem_1m", label: "USGS terrain, our cut" } },
        ],
        key: [],
        links: [],
        next_label: "See the plan",
        back: false,
        end: false,
        bar: false,
      },
    };
  }

  if (n === 2) {
    const numbers = !ready ? [] : [
      { id: "distance", label: "Distance", value: plan.total_m === null ? null : plan.total_m / 1000, unit: "km", prov: "derived", detail: { ...derived("sum of the leg lengths of the planned route, in ground metres"), digits: 1 } },
      { id: "time", label: "Time in suit", value: fmtDuration(plan.duration_s), unit: null, prov: "assumption", detail: { note: TIME_NOTE } },
      {
        id: "steepest", label: "Steepest slope", value: plan.steepest_deg, unit: "°", prov: "derived",
        detail: { ...derived("steepest 1 m slope cell the route crosses"), digits: 1 },
        sub: ["limit ", { value: LIMITS.slope_cap_deg, unit: "°", prov: "source", detail: { source: LIMIT_SOURCES.slope_cap_deg } }],
      },
      {
        id: "limits", label: "Limits kept", value: plan.limits_kept === null ? null : `${plan.limits_kept} of ${plan.limits_total}`, unit: "", prov: "derived",
        detail: { ...derived("count of the limits the planned route keeps, from the limits table", LIMIT_SOURCE_IDS), count: true },
        sub: plan.at_limit > 0 ? [`${countWord(plan.at_limit) || "some"} at the limit`] : ["all with room to spare"],
      },
    ];
    const words = planWords(facts.stations);
    const keeps = "The route stays at or under the slope limit and out of the no-go zones.";
    return {
      ...base,
      chips: true,
      view: "plan",
      camera: { mode: "fit" },
      layers: { on: ["image", "stations", "no_go"], off: ["rover_path"] },
      overlays: { route: true, marks: true, legs: false },
      walk: { t: null, hazard: false, playing: false },
      caption: {
        headline: words.headline,
        text: ready ? [words.pairs ? `${words.pairs} ${keeps}` : keeps] : waitText,
        short: ready ? [words.pairs || keeps] : null,
        numbers,
        key: ["ridge", "hollow", "route", "nogo"],
        links: [{ id: "limits", label: "See the limits" }],
        next_label: "Start the walk",
        back: true,
        end: false,
        bar: false,
      },
    };
  }

  if (n === 3) {
    return {
      ...base,
      minimap: true,
      view: "walk",
      camera: { mode: "eye" },
      layers: { on: ["image", "stations", "no_go"], off: ["rover_path"] },
      overlays: { route: true, marks: true, legs: false },
      walk: { t: 0, hazard: false, playing: true, speed: WALK_SPEED },
      caption: {
        headline: "Walk the route",
        text: ready ? [facts.renderer === "2d" ? "A heading-up map, with the helmet display." : "Eye height, with the helmet display."] : waitText,
        numbers: [],
        key: [],
        links: [],
        next_label: "Go to the hazard",
        back: true,
        end: false,
        bar: true,
      },
    };
  }

  if (n === 4) {
    const date = dateWords(facts.sep_date);
    return {
      ...base,
      minimap: true,
      view: "walk",
      camera: { mode: "eye" },
      layers: { on: ["image", "stations", "no_go"], off: ["rover_path"] },
      overlays: { route: true, marks: true, legs: false },
      walk: { t: "hazard", hazard: true, playing: false },
      caption: {
        headline: "Return now",
        text: ready
          ? ["Scenario: a solar particle event recorded near Earth", date ? " on " : "", date ? { words: date } : "", ", replayed. Arrival at Mars is not claimed."]
          : waitText,
        numbers: [],
        key: [],
        links: [],
        next_label: "See the rover check",
        back: true,
        end: false,
        bar: true,
      },
    };
  }

  const r = facts.rover || null;
  const roverMethod = (m) => derived(m, ["dem_1m", "msl_waypoints"]);
  return {
    ...base,
    view: "plan",
    camera: { mode: "fit" },
    layers: { on: ["image", "stations", "no_go", "rover_path"], off: [] },
    overlays: { route: true, marks: true, legs: false },
    walk: { t: null, hazard: false, playing: false },
    caption: {
      headline: "Checked against Curiosity",
      // The "agrees" sentence only stands with the rover numbers under it.
      text: r
        ? ["The rover drove here in ", { words: "2025" }, ". Its measured tilt agrees with our slope map."]
        : ["The rover drove here in ", { words: "2025" }, ". Rover check: ", { nodata: true }],
      short: r ? ["Curiosity's measured tilt agrees with our slope map."] : ["Rover check: ", { nodata: true }],
      numbers: !r ? [] : [
        { id: "share", label: "Within the slope cap", value: r.under_pct, unit: "%", prov: "derived", detail: roverMethod("share of the rover positions where our slope map is at or under the cap") },
        { id: "median", label: "Median difference", value: r.median_deg, unit: "°", prov: "derived", detail: { ...roverMethod("median of the absolute difference between our slope and the rover tilt"), digits: 1 } },
        { id: "count", label: "Rover positions", value: r.n, unit: "", prov: "source", detail: { source: "msl_waypoints", count: true } },
      ],
      key: ["route", "rover"],
      links: [{ id: "rover", label: "Open the full check" }],
      next_label: null,
      back: true,
      end: true,
      bar: false,
    },
  };
}

// What the aria-live region says on a step change.
export function stepAnnouncement(config) {
  return `${stepLabel(config.step)}. ${config.caption.headline}.`;
}

// The layer list after a step: the step's own layers on and off, the rest as the visitor left them.
export function applyLayers(current, layers) {
  const out = (current || []).filter((id) => !layers.off.includes(id));
  for (const id of layers.on) if (!out.includes(id)) out.push(id);
  return out;
}

// What the chart linework shows now: the step's own choice; everything (with leg labels) while exploring freely; the
// route and the marks whenever the drawer is open on the editor or the stations, so an edit is never made blind.
export function overlayFlags(s) {
  if (s.explore) return { route: true, marks: true, legs: true };
  const o = { ...stepConfig(s.step).overlays };
  if (s.drawer && (s.panel === "editor" || s.panel === "stations")) {
    o.route = true;
    o.marks = true;
  }
  return o;
}
