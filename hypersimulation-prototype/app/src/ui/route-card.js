// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The printable route card (design/route-card.html): one A4 page, black on white, a centre rail with one detent per
// stop, the arriving leg and the time left of the rail, station and task right of it, the limits and the notes below. It lives in a sheet
// that the limits panel and the last story step open (state.sheet = "route-card"); print.css and app.css print the card
// alone. The sheet is in the page only while it is open.
import { num, fmtDuration, fmtBearing, formatValue, lmstText } from "../provenance.js";
import { MARS_HOUR_S } from "../replay.js";
import { minimumRows } from "./minimums.js";
import { tPlus } from "./timeline.js";

// The printed card always shows the provenance in full words, small and inline (app.css, print.css).
const numW = (value, unit, prov, detail, doc) => num(value, unit, prov, detail || {}, doc);

const SVG = "http://www.w3.org/2000/svg";
const TIME_NOTE = "computed from the walking speed and the work time per station, both assumptions with no source";
const DERIVED = { method: "from the planned path on the 1 m terrain: bearing from true north, ground length, sum of rises, steepest 1 m cell", sources: ["dem_1m"] };

// Pure: walk values that the team has not set yet (flag true in team-inputs.json), as plain names.
export function unsetValues(inputs) {
  if (!inputs) return [];
  const out = [];
  const names = {
    walking_speed_m_s: "walking speed", work_time_min_per_station: "work time per station", partner_trail_m: "partner spacing",
    hazard_start_min: "hazard start time", start_lmst_hour: "walk start time",
  };
  for (const [k, label] of Object.entries(names)) if (inputs[k] && inputs[k].placeholder === true) out.push(label);
  if (inputs.base && inputs.base.placeholder === true) out.push("base position");
  for (const s of inputs.stations || []) {
    const p = s.placeholder || {};
    const fields = ["position", "kind", "task"].filter((f) => p[f] === true);
    if (fields.length) out.push(`station ${s.id} ${fields.join(", ")}`);
  }
  for (const z of inputs.no_go || []) if (z.placeholder === true) out.push(`no-go zone ${z.label || z.id}`);
  return out;
}

// Pure: the rail stops, from the route legs and the timeline schedule (arrival = start of the work block).
export function railStops(route, schedule, inputs) {
  if (!route || !route.legs) return [];
  const speed = inputs && inputs.walking_speed_m_s ? inputs.walking_speed_m_s.value : null;
  const start = inputs && inputs.start_lmst_hour ? inputs.start_lmst_hour.value : null;
  const arrive = new Map();
  for (const b of (schedule && schedule.blocks) || []) if (b.kind === "work") arrive.set(b.station_id, b.t0);
  const lmst = (t) => (Number.isFinite(start) && Number.isFinite(t) ? lmstText(start + t / MARS_HOUR_S) : null);
  const byId = new Map(((inputs && inputs.stations) || []).map((s) => [s.id, s]));
  const out = [{ type: "stop", base: true, id: "BASE", kind: "crew rover", t: 0, lmst: lmst(0) }];
  route.legs.forEach((leg, i) => {
    out.push({
      type: "leg",
      bearing: fmtBearing(leg.bearing_deg),
      distance_m: leg.distance_m,
      climb_m: leg.climb_m,
      steepest_deg: leg.max_slope_deg,
      time_s: speed > 0 ? leg.distance_m / speed : null,
    });
    const last = i === route.legs.length - 1;
    const st = byId.get(leg.to.id);
    const t = last ? (schedule ? schedule.duration_s : null) : arrive.has(leg.to.id) ? arrive.get(leg.to.id) : null;
    out.push(last
      ? { type: "stop", base: true, id: "BASE", kind: "end of walk", t, lmst: lmst(t) }
      : { type: "stop", base: false, id: `S${leg.to.id}`, kind: st ? st.kind : "", task: st ? st.task : "", t, lmst: lmst(t) });
  });
  return out;
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

function nm(doc, tag, cls, ...kids) {
  const e = el(doc, tag, cls, ...kids);
  e.setAttribute("data-nonmetric", "");
  return e;
}

function octagon(doc) {
  const s = doc.createElementNS(SVG, "svg");
  s.setAttribute("class", "icon icon--octagon");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  for (const [c, d] of [["icon__shape", "M8 2h8l6 6v8l-6 6H8l-6-6V8z"], ["icon__bar", "M7 12h10"]]) {
    const p = doc.createElementNS(SVG, "path");
    p.setAttribute("class", c);
    p.setAttribute("d", d);
    s.appendChild(p);
  }
  return s;
}

function stopTime(doc, stop) {
  const parts = stop.t === null || stop.t === undefined ? null : [{ value: tPlus(stop.t) }, { value: "-" }, { value: stop.lmst ?? "---", unit: "LMST" }];
  return numW(parts, "h:min", "assumption", { note: TIME_NOTE }, doc);
}

function legData(doc, leg) {
  const signed = (v) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${formatValue(v, { digits: 1 })}` : null);
  const course = el(doc, "span", "leg-data__course",
    numW([{ value: leg.bearing, unit: "°" }, { value: Number.isFinite(leg.distance_m) ? formatValue(leg.distance_m, { digits: 0 }) : null, unit: "m" }], null, "derived", DERIVED, doc));
  return el(doc, "span", "leg-data",
    course,
    numW(signed(leg.climb_m), "m", "derived", { ...DERIVED, short: "climb" }, doc),
    numW(Number.isFinite(leg.steepest_deg) ? leg.steepest_deg : null, "°", "derived", { ...DERIVED, short: "steepest", digits: 1 }, doc),
    numW(fmtDuration(leg.time_s), null, "assumption", { note: TIME_NOTE }, doc));
}

export function buildCard(doc, s, data) {
  const inputs = s.inputs;
  const plan = s.plan;
  const route = plan.status === "ok" ? plan.route : null;
  const schedule = plan.schedule;
  const cond = data && data.conditions;
  const nStations = inputs ? inputs.stations.length : 0;
  const card = el(doc, "article", "route-card");
  card.setAttribute("aria-label", "Route card for this walk");

  const sub = nm(doc, "div", "route-card__sub",
    `Gale crater, boxwork ridges on Mount Sharp. Conditions from sol ${cond && cond.sol ? cond.sol : "not known"}${cond && cond.earth_date ? ` (${cond.earth_date})` : ""}. ${nStations} ${nStations === 1 ? "station" : "stations"}.`);
  card.appendChild(el(doc, "header", "route-card__head", el(doc, "div", "", nm(doc, "div", "route-card__title", "MARSWALK - WALK 1 - ROUTE CARD"), sub), el(doc, "div", "route-card__sim", "SIMULATION")));

  const v = (k) => (inputs && inputs[k] && Number.isFinite(inputs[k].value) ? inputs[k].value : null);
  const start = v("start_lmst_hour");
  const field = (name, ...kids) => el(doc, "div", "", el(doc, "span", "route-card__field", name), ...kids);
  const baseText = nm(doc, "span", "", `${inputs && inputs.base ? inputs.base.label : "Crew rover"} `);
  if (inputs && inputs.base && inputs.base.assumption) baseText.appendChild(el(doc, "em", "", "(assumption)"));
  card.appendChild(el(doc, "div", "route-card__brief",
    field("Base", baseText),
    field("Start", numW(start === null ? null : lmstText(start), "LMST", "assumption", {}, doc)),
    field("Speed / work", numW(v("walking_speed_m_s"), "m/s", "assumption", { suffix: false }, doc), " / ", numW(v("work_time_min_per_station"), "min", "assumption", {}, doc)),
    field("Totals",
      numW(route ? route.total_m : null, "m", "derived", { method: "sum of the leg lengths in ground metres", sources: ["dem_1m"], digits: 0 }, doc), " ",
      numW(fmtDuration(schedule ? schedule.duration_s : null), null, "assumption", { note: TIME_NOTE }, doc))));

  card.appendChild(el(doc, "div", "route-card__cols", el(doc, "span", "", "Leg: bearing, distance, climb, steepest, time"), el(doc, "span", ""), el(doc, "span", "", "Station and task")));

  const rail = el(doc, "div", "rail");
  const stops = railStops(route, schedule, inputs);
  if (!stops.length) rail.appendChild(el(doc, "div", "rail__stop", el(doc, "span", "rail__left", ""), el(doc, "span", "rail__detent"), el(doc, "span", "rail__right", el(doc, "span", "rail__unset", "No route yet: the card fills in when the planner finds one."))));
  // One row per stop: the leg that arrives at it (bearing, distance, climb, steepest, time) and the arrival time on
  // the left of the rail, the station and its task on the right. This keeps the card to one A4 page.
  let legIn = null;
  for (const st of stops) {
    if (st.type === "leg") {
      legIn = st;
      continue;
    }
    const right = el(doc, "span", "rail__right", nm(doc, "span", "rail__id", st.id), el(doc, "span", "rail__kind", st.kind));
    if (!st.base) right.appendChild(st.task ? nm(doc, "span", "rail__task", st.task) : el(doc, "span", "rail__unset", "Task not written yet"));
    const left = el(doc, "span", "rail__left", legIn ? legData(doc, legIn) : null, el(doc, "span", "rail__time", stopTime(doc, st)));
    legIn = null;
    rail.appendChild(el(doc, "div", `rail__stop${st.base ? " rail__stop--base" : ""}`, left, el(doc, "span", "rail__detent"), right));
  }
  card.appendChild(rail);

  const limits = el(doc, "table", "route-card__limits");
  limits.appendChild(el(doc, "thead", "", el(doc, "tr", "", ...["Limit", "Value", "Margin", "Body, source"].map((t) => el(doc, "th", "", t)))));
  const tb = el(doc, "tbody", "");
  for (const r of minimumRows(plan.constraints)) {
    if (r.info) continue;
    const word = r.state === "pass" ? null : r.state === "nodata" ? " NO DATA" : r.state === "limit" ? " AT LIMIT" : ` ${r.state.toUpperCase()}`;
    tb.appendChild(el(doc, "tr", "",
      el(doc, "td", "", `${r.name} `, numW(r.limit.value, r.limit.unit, r.limit.prov, r.limit.detail, doc)),
      el(doc, "td", "", numW(r.value.value, r.value.unit, r.value.prov, r.value.detail, doc)),
      el(doc, "td", "", numW(r.margin.value, r.margin.unit, r.margin.prov, { ...r.margin.detail, suffix: false }, doc), word),
      nm(doc, "td", "", r.body)));
  }
  limits.appendChild(tb);

  const notes = el(doc, "div", "route-card__notes");
  const hs = schedule ? schedule.hazard_start_s : null;
  if (Number.isFinite(hs) && schedule && hs < schedule.duration_s) {
    notes.appendChild(el(doc, "div", "route-card__warn", octagon(doc),
      el(doc, "span", "", "RETURN NOW scenario at ", numW(tPlus(hs), "h:min", "assumption", { note: "hazard start time, an assumption" }, doc),
        ": the walk view plans the way back to the crew rover from the position at that time.")));
  }
  const unset = unsetValues(inputs);
  if (unset.length) notes.appendChild(nm(doc, "div", "", "Not set yet: ", el(doc, "strong", "", unset.join("; "))));
  const readme = nm(doc, "div", "", el(doc, "strong", "", "Read me"), "Bearings from true north. Times at the assumed speed. Climb is the sum of rises on the leg; steepest is the highest 1 m cell slope on the path.");
  const sources = nm(doc, "div", "", el(doc, "strong", "", "Sources"), "USGS MSL Gale image mosaics and 1 m terrain (Calef III and Parker 2016; ESA/DLR/FU Berlin HRSC, CC BY-SA 3.0 IGO). MSL REMS and RAD RDR, NASA PDS. NASA CCMC DONKI (scenario). Designed against named NASA human-systems rules.");
  notes.append(readme, sources);
  card.appendChild(el(doc, "footer", "route-card__foot", limits, notes));
  return card;
}

export function mount(ctx) {
  const doc = (ctx.regions.drawer || ctx.regions.dock).ownerDocument || globalThis.document;
  const { store, actions, data } = ctx;
  const sheet = el(doc, "section", "sheet");
  sheet.setAttribute("id", "route-card-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-labelledby", "route-card-title");
  sheet.hidden = true;
  const print = el(doc, "button", "btn btn--primary", "Print route card");
  print.setAttribute("type", "button");
  print.addEventListener("click", () => globalThis.print());
  const close = el(doc, "button", "btn", "Close");
  close.setAttribute("type", "button");
  close.addEventListener("click", () => actions.showSheet(null));
  const title = el(doc, "h1", "page__title", "Route card");
  title.setAttribute("id", "route-card-title");
  const head = el(doc, "header", "page__head", title,
    nm(doc, "p", "page__lead", "One A4 page, black on white. It works when every display has failed."),
    el(doc, "div", "btn-row", print, close));
  const slot = el(doc, "div", "");
  sheet.appendChild(el(doc, "main", "page", head, slot));

  let opener = null;
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      actions.showSheet(null);
    } else if (e.key === "Tab") {
      const all = sheet.querySelectorAll('button, [tabindex="0"]');
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  let seen = [];
  let open = false;
  const render = (s) => {
    const key = [s.inputs, s.plan.route, s.plan.schedule, s.plan.constraints, s.plan.status];
    if (key.some((k, i) => k !== seen[i])) {
      seen = key;
      slot.replaceChildren(buildCard(doc, s, data));
    }
    const want = s.sheet === "route-card";
    if (want !== open) {
      open = want;
      if (want) doc.body.appendChild(sheet);
      else sheet.remove();
      sheet.hidden = !want;
      // Only an open sheet is modal: main.js and the helmet display read aria-modal to hold their keys.
      if (want) sheet.setAttribute("aria-modal", "true");
      else sheet.removeAttribute("aria-modal");
      if (want) {
        opener = doc.activeElement;
        print.focus();
      } else if (opener && typeof opener.focus === "function") opener.focus();
    }
  };
  render(store.getState());
  const off = store.subscribe(render);
  return () => {
    off();
    sheet.remove();
  };
}
