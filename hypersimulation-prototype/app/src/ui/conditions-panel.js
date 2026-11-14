// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// "Conditions on sol N": the four panel layers (thermal, atmosphere, radiation, space weather). Each section shows
// only while its layer is on. The thermal chart is an inline SVG with no numbers in it; its axis labels and the
// current-hour readout are DOM num() elements.
import { num } from "../provenance.js";
import { whenPanel, PANEL_LAYERS } from "../layers.js";
import { MARS_HOUR_S } from "../replay.js";
import { LIMITS, LIMIT_SOURCES } from "../constraints.js";

export const CHART = { w: 240, h: 100, pad: 4 };
const TABLE_HOURS = [6, 18];

const finite = (v) => (Number.isFinite(v) ? v : null);

export function thermalSeries(conditions) {
  const hours = conditions && Array.isArray(conditions.hours) ? conditions.hours : [];
  const series = [];
  for (let h = 0; h < 24; h++) {
    const e = hours.find((x) => x.lmst_hour === h);
    series.push({ hour: h, value: e ? finite(e.ground_brightness_temp_c) : null });
  }
  let min = null;
  let max = null;
  for (const s of series) {
    if (s.value === null) continue;
    if (!min || s.value < min.value) min = s;
    if (!max || s.value > max.value) max = s;
  }
  return { series, min, max };
}

// Step line over 24 hours; a null hour breaks the line (a gap, never a zero). Returns SVG path data in chart units.
export function stepPath(series, lo, hi, { w = CHART.w, h = CHART.h, pad = CHART.pad } = {}) {
  const span = hi - lo || 1;
  const x = (hour) => (hour / 24) * w;
  const y = (v) => pad + (1 - (v - lo) / span) * (h - 2 * pad);
  let d = "";
  let prev = null;
  for (const s of series) {
    if (s.value === null) {
      prev = null;
      continue;
    }
    const yy = y(s.value).toFixed(2);
    d += prev === null ? `M${x(s.hour).toFixed(2)} ${yy}` : `V${yy}`;
    d += `H${x(s.hour + 1).toFixed(2)}`;
    prev = s;
  }
  return d;
}

export function gapHours(series) {
  return series.filter((s) => s.value === null).map((s) => s.hour);
}

// Current local Mars hour: the replay position while walking, else the walk start hour; null when unknown.
export function currentLmst(state) {
  const walk = state && state.walk;
  if (walk && walk.snapshot && Number.isFinite(walk.snapshot.lmst_hour)) return { hour: walk.snapshot.lmst_hour, basis: "replay" };
  const inputs = state && state.inputs;
  const start = inputs && inputs.start_lmst_hour ? finite(inputs.start_lmst_hour.value) : null;
  return start === null ? { hour: null, basis: null } : { hour: start, basis: "start" };
}

// Hours of the planned walk (whole LMST hours touched), from the start hour and the timeline length.
export function walkHours(inputs, duration_s) {
  const start = inputs && inputs.start_lmst_hour ? finite(inputs.start_lmst_hour.value) : null;
  if (start === null) return [];
  const end = start + (Number.isFinite(duration_s) ? duration_s : 0) / MARS_HOUR_S;
  const out = [];
  for (let h = Math.floor(start); h <= Math.floor(end) && out.length < 24; h++) out.push(((h % 24) + 24) % 24);
  return out;
}

export function tableHours(walk) {
  const set = new Set();
  for (let h = TABLE_HOURS[0]; h <= TABLE_HOURS[1]; h++) set.add(h);
  for (const h of walk) set.add(h);
  return [...set].sort((a, b) => a - b);
}

// ---- DOM

function el(doc, tag, attrs = {}, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}
const SVG = "http://www.w3.org/2000/svg";
function svg(doc, tag, attrs = {}) {
  const e = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}
const hh = (h) => `${String(h).padStart(2, "0")}:00`;
// cell: in the hours table the row names the hour and the plate the sol, so the visible tag is left off (the
// full provenance stays in the element's title).
const measured = (doc, value, unit, sol, hour, source, digits, cell = false) =>
  Number.isFinite(sol) && Number.isFinite(hour)
    ? num(value, unit, "measured", { sol, lmst: hour, source, digits, ...(cell ? { suffix: false } : {}) }, doc)
    : num(null, unit, "source", { source, ...(cell ? { suffix: false } : {}) }, doc);

function section(doc, id, title) {
  const s = el(doc, "section", { class: "conditions-panel__section", "data-layer": id, "aria-labelledby": `cond-${id}-h`, hidden: true });
  s.append(el(doc, "h3", { class: "conditions-panel__title", id: `cond-${id}-h` }, title));
  return s;
}

function buildThermal(doc, conditions) {
  const s = section(doc, "thermal", "Thermal - ground brightness temperature");
  const sol = conditions ? conditions.sol : null;
  const { series, min, max } = thermalSeries(conditions);
  const lo = min ? Math.floor(min.value / 10) * 10 : -100;
  const hi = max ? Math.ceil(max.value / 10) * 10 : 0;
  const plot = el(doc, "div", { class: "chart__plot" });
  const chart = svg(doc, "svg", { class: "chart__svg", viewBox: `0 0 ${CHART.w} ${CHART.h}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  for (const g of [6, 12, 18]) chart.append(svg(doc, "line", { class: "chart__grid", x1: (g / 24) * CHART.w, x2: (g / 24) * CHART.w, y1: 0, y2: CHART.h }));
  for (const gap of gapHours(series)) {
    chart.append(svg(doc, "rect", { class: "chart__gap", x: (gap / 24) * CHART.w, y: 0, width: CHART.w / 24, height: CHART.h }));
  }
  chart.append(svg(doc, "path", { class: "chart__line-casing", d: stepPath(series, lo, hi) }));
  chart.append(svg(doc, "path", { class: "chart__line", d: stepPath(series, lo, hi) }));
  const now = svg(doc, "line", { class: "chart__now", x1: 0, x2: 0, y1: 0, y2: CHART.h, visibility: "hidden" });
  chart.append(now);
  plot.append(chart);
  const yAxis = el(doc, "div", { class: "chart__y" },
    el(doc, "span", {}, "highest ", max ? measured(doc, max.value, "°C", sol, max.hour, "rems", 1) : num(null, "°C", "source", { source: "rems" }, doc)),
    el(doc, "span", {}, "lowest ", min ? measured(doc, min.value, "°C", sol, min.hour, "rems", 1) : num(null, "°C", "source", { source: "rems" }, doc)));
  const xAxis = el(doc, "div", { class: "chart__x", "data-nonmetric": true, "aria-hidden": "true" });
  for (const t of [0, 6, 12, 18, 24]) {
    const tick = el(doc, "span", { class: "chart__tick" }, String(t).padStart(2, "0"));
    tick.style.left = `${(t / 24) * 100}%`;
    xAxis.append(tick);
  }
  const gaps = gapHours(series);
  const readout = el(doc, "p", { class: "chart__readout" });
  s.append(
    el(doc, "figure", { class: "chart", "aria-label": "Ground brightness temperature by local Mars hour" }, yAxis, plot, xAxis,
      el(doc, "figcaption", { class: "chart__caption" }, "Local Mars hour (LMST). Each step is the mean of one hour.",
        gaps.length ? el(doc, "span", { "data-nonmetric": true }, ` Gaps (no data): ${gaps.map(hh).join(", ")}.`) : null)),
    readout,
    el(doc, "p", { class: "plate__note" }, "Measured by REMS at Curiosity: a thermopile brightness temperature of the ground, not a contact temperature."),
  );
  let shown = undefined;
  return {
    root: s,
    setNow(cur) {
      const hour = Number.isFinite(cur.hour) ? Math.floor(cur.hour) : null;
      const key = `${hour}|${cur.basis}`;
      if (key === shown) return;
      shown = key;
      if (hour === null) {
        now.setAttribute("visibility", "hidden");
        readout.replaceChildren("Current hour: no start time is set.");
        return;
      }
      const x = ((cur.hour % 24) / 24) * CHART.w;
      now.setAttribute("x1", x.toFixed(2));
      now.setAttribute("x2", x.toFixed(2));
      now.setAttribute("visibility", "visible");
      const v = series[hour] ? series[hour].value : null;
      readout.replaceChildren(cur.basis === "replay" ? "At the replay hour: " : "At the walk start hour: ", measured(doc, v, "°C", sol, hour, "rems", 1));
    },
  };
}

function buildAtmosphere(doc, conditions) {
  const s = section(doc, "atmosphere", "Atmosphere");
  const sol = conditions ? conditions.sol : null;
  const units = (conditions && conditions.units) || {};
  const tableWrap = el(doc, "div", { class: "scroll-x" });
  s.append(
    el(doc, "p", { class: "plate__note" }, "Measured by REMS at Curiosity. Each row is the mean of one local Mars hour (LMST)."),
    tableWrap,
  );
  const hours = conditions && Array.isArray(conditions.hours) ? conditions.hours : [];
  const uvText = typeof units.uv_abc_w_m2 === "string" ? units.uv_abc_w_m2 : "";
  const uvInner = (uvText.match(/\(([^)]*)\)/) || [])[1] || "";
  const uvNote = /lower bound/.test(uvText)
    ? `UV values are lower bounds: dust on the sensor is not corrected (${uvInner.replace(/^UV_ABC;\s*/, "")}).`
    : "UV values as given in the file.";
  const allRhNull = hours.length === 0 || hours.every((h) => h.rel_humidity_pct === null || h.rel_humidity_pct === undefined);
  const rhFlag = conditions && conditions.flags && typeof conditions.flags.rel_humidity_pct === "string" ? conditions.flags.rel_humidity_pct : null;
  s.append(el(doc, "p", { class: "plate__note", "data-nonmetric": true }, uvNote));
  if (allRhNull) {
    s.append(el(doc, "dl", { class: "facts" },
      el(doc, "dt", {}, "Relative humidity"),
      el(doc, "dd", {},
        num(null, "%", "source", { source: "rems" }, doc),
        el(doc, "span", { class: "facts__reason", "data-nonmetric": true },
          ` No hour of this sol passed the humidity quality flags${rhFlag ? ` (${rhFlag})` : ""}, so the file holds no value.`))));
  }
  let key = null;
  return {
    root: s,
    setWalk(walk) {
      const k = walk.join(",");
      if (k === key) return;
      key = k;
      const table = el(doc, "table", { class: "hours" });
      table.append(el(doc, "thead", {}, el(doc, "tr", {},
        el(doc, "th", { scope: "col" }, "LMST"), el(doc, "th", { scope: "col" }, "Air"), el(doc, "th", { scope: "col" }, "Pressure"), el(doc, "th", { scope: "col" }, "UV"),
        allRhNull ? null : el(doc, "th", { scope: "col" }, "Humidity"))));
      const body = el(doc, "tbody", {});
      for (const h of tableHours(walk)) {
        const e = hours.find((x) => x.lmst_hour === h) || {};
        body.append(el(doc, "tr", { "data-walk": walk.includes(h) },
          el(doc, "th", { scope: "row", "data-nonmetric": true }, hh(h)),
          el(doc, "td", {}, measured(doc, finite(e.air_temp_c), "°C", sol, h, "rems", 1, true)),
          el(doc, "td", {}, measured(doc, finite(e.pressure_pa), "Pa", sol, h, "rems", 1, true)),
          el(doc, "td", {}, measured(doc, finite(e.uv_abc_w_m2), "W/m²", sol, h, "rems", 2, true)),
          allRhNull ? null : el(doc, "td", {}, measured(doc, finite(e.rel_humidity_pct), "%", sol, h, "rems", 1, true))));
      }
      table.append(body);
      tableWrap.replaceChildren(table);
    },
  };
}

function buildRadiation(doc, dose) {
  const s = section(doc, "radiation", "Radiation");
  const facts = el(doc, "dl", { class: "facts" });
  const add = (label, ...value) => facts.append(el(doc, "dt", {}, ...[].concat(label)), el(doc, "dd", {}, ...value));
  const d = dose || {};
  const rate = d.dose_rate || {};
  const sol = d.sol;
  const mean = "mean of the hourly means";
  const rateNum = (r) => (Number.isFinite(sol)
    ? num(finite(r.value), "µGy/h", "measured", { sol, lmst: mean, source: "rad", digits: 2 }, doc)
    : num(null, "µGy/h", "source", { source: "rad" }, doc));
  add(`Dose rate, detector ${rate.detector || "B"}`, rateNum(rate),
    Number.isFinite(rate.n_obs) ? el(doc, "span", { class: "facts__reason", "data-nonmetric": true }, ` ${rate.n_obs} observations`) : null);
  if (rate.derived_daily) {
    add("Per day", num(finite(rate.derived_daily.value), rate.derived_daily.unit || "mGy/day", "derived", { method: rate.derived_daily.method || "hourly mean x 24", sources: ["rad"], digits: 3 }, doc));
  }
  if (d.other_detector) add(`Detector ${d.other_detector.detector}`, rateNum(d.other_detector));
  if (d.fallback) {
    const f = d.fallback;
    add(el(doc, "span", { "data-nonmetric": true }, `Published rate, ${f.period}`),
      num(`${f.value.toFixed(3)} ± ${f.plus_minus.toFixed(3)}`, f.unit, "source", { source: "hassler_2014" }, doc));
  }
  if (d.dose_equivalent_rate) {
    const q = d.dose_equivalent_rate;
    add(el(doc, "span", { "data-nonmetric": true }, "Dose equivalent, Gale 2012 to 2013"),
      num(`${q.value.toFixed(2)} ± ${q.plus_minus.toFixed(2)}`, q.unit, "source", { source: "hassler_2014" }, doc));
  }
  add("Career limit", num(LIMITS.career_dose_msv, "mSv", "source", { source: LIMIT_SOURCES.career_dose_msv }, doc));
  s.append(facts,
    el(doc, "p", { class: "plate__note", "data-nonmetric": true }, "Measured by RAD at Curiosity on this sol; the per-day value is derived by us. The published values (Hassler 2014) are for comparison. The RAD guide does not rank the detectors; B shows first because the guide lists it first."));
  return { root: s };
}

function buildSpaceWeather(doc, sep, inputs) {
  const s = section(doc, "space_weather", "Space weather - scenario");
  const e = sep || {};
  s.append(el(doc, "div", { class: "banner conditions-panel__banner" },
    el(doc, "span", { class: "banner__word" }, "Scenario"),
    el(doc, "span", { class: "banner__text" }, e.note || "Measured near Earth. Arrival at Mars is not claimed. Replayed as a scenario.")));
  const facts = el(doc, "dl", { class: "facts" });
  const add = (label, value) => facts.append(el(doc, "dt", {}, label), el(doc, "dd", {}, value));
  add("Event", el(doc, "span", { "data-nonmetric": true }, e.sepID || e.activityID || "unknown"));
  const m = typeof e.eventTime === "string" ? e.eventTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/) : null;
  add("Event time", num(m ? `${m[1]} ${m[2]}` : null, "UTC", "scenario", {}, doc));
  const inst = Array.isArray(e.instruments) ? e.instruments : [];
  for (const i of inst) {
    const mm = String(i).match(/^(.*?)\s*([\d.]+-[\d.]+)\s*MeV$/);
    add("Instrument", mm ? num(`${mm[1].replace(/:$/, "")} ${mm[2]}`, "MeV", "source", { source: "donki" }, doc) : el(doc, "span", { "data-nonmetric": true }, String(i)));
  }
  if (Array.isArray(e.linkedEvents) && e.linkedEvents.length) add("Linked", el(doc, "span", { "data-nonmetric": true }, e.linkedEvents.join("; ")));
  if (e.link) add("Record", el(doc, "span", { class: "conditions-panel__link", "data-nonmetric": true }, String(e.link).replace(/^https?:\/\//, "")));
  const start = inputs && inputs.hazard_start_min ? finite(inputs.hazard_start_min.value) : null;
  add("Return starts", num(start, "min after the walk start", "assumption", { name: "hazard start time" }, doc));
  s.append(facts, el(doc, "p", { class: "plate__note" }, "Credit: NASA CCMC DONKI, provided as is, no NASA endorsement. The record link is listed in the credits."));
  return { root: s };
}

// panel: the element to append to (layer-panel passes #panel-layers); without it the panel waits for #panel-layers.
export function mount(ctx, panel = null) {
  const doc = globalThis.document;
  if (!doc) return () => {};
  const { store } = ctx;
  const data = ctx.data || {};
  let parts = null;
  let plate = null;
  let hint = null;

  function build(target) {
    if (target.querySelector('[data-owner="conditions"]')) return;
    const c = data.conditions;
    const sol = c && Number.isFinite(c.sol) ? c.sol : null;
    plate = el(doc, "section", { class: "plate conditions-panel", "data-owner": "conditions", "aria-labelledby": "cond-h" },
      el(doc, "h2", { class: "plate__label", id: "cond-h", "data-nonmetric": true }, sol !== null ? `Conditions on sol ${sol}` : "Conditions"),
      c && c.earth_date ? el(doc, "span", { class: "plate__aside", "data-nonmetric": true }, c.earth_date) : null);
    hint = el(doc, "p", { class: "plate__note conditions-panel__hint" }, "Switch on Thermal, Atmosphere, Radiation or Space weather to see the measured values of this sol.");
    const state = store.getState();
    parts = {
      thermal: buildThermal(doc, c),
      atmosphere: buildAtmosphere(doc, c),
      radiation: buildRadiation(doc, data.dose),
      space_weather: buildSpaceWeather(doc, data.sep, state.inputs || data.inputs),
    };
    plate.append(hint, ...PANEL_LAYERS.map((id) => parts[id].root));
    target.append(plate);
    update(state);
  }

  let lastLayers = null;
  function update(state) {
    if (!parts) return;
    const layers = Array.isArray(state.layers) ? state.layers : [];
    if (layers !== lastLayers) {
      lastLayers = layers;
      let any = false;
      for (const id of PANEL_LAYERS) {
        const on = layers.includes(id);
        parts[id].root.hidden = !on;
        any = any || on;
      }
      hint.hidden = any;
    }
    parts.thermal.setNow(currentLmst(state));
    const walk = state.walk || {};
    const inputs = state.inputs || data.inputs;
    const tl = walk.timeline || walk.schedule;
    parts.atmosphere.setWalk(walkHours(inputs, tl && Number.isFinite(tl.duration_s) ? tl.duration_s : 0));
  }

  const stop = panel ? (build(panel), () => {}) : whenPanel(doc, "panel-layers", build);
  const unsub = store.subscribe(update);
  return () => {
    stop();
    unsub();
    if (plate) plate.remove();
  };
}
