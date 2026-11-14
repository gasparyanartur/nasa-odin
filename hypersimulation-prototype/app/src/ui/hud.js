// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Helmet display (spec 5a), drawn from state.walk. Six items in fixed places, in priority order: warning; bearing and
// distance to the next station (or to base); suit time left of 14 h; distance to rover left of 2 km; partner left
// of 100 m (the three margins as one compact block); science line. Three actions: Next (N), Acknowledge (A), Return to
// rover (R). "SIMULATION" always shows, with one fixed line about the assumed walking speed.
// hudModel is pure; mount() builds the DOM once per mode and then only swaps changed values.
import { num } from "../provenance.js";
import { LIMITS, LIMIT_SOURCES } from "../constraints.js";
import { marginLevel } from "../hazard.js";
import { stationCardModel, buildWalkCard, arrivalTimes } from "./station-card.js";

// The visor keeps the scenario short; the event id and the "measured near Earth, arrival at Mars not claimed" sentence
// are in the plan view (Layers, space weather). The lit Acknowledge button with its key cap is the prompt, so a lit
// warning carries no note.
export const SCENARIO_TEXT = "Scenario - not a measured Mars event";
const NOTE_LIT = null;
const NOTE_ACK = "Acknowledged - still in force";
// The one fixed line beside SIMULATION (no digits): times and distances on the visor follow assumptions.
export const SIM_LINE = "Times and distances follow assumed walking speed.";
// Names of the three margins in the compact block, top right.
const MARGIN_NAMES = { suit: "Suit time left", rover: "Rover range left", partner: "Partner range left" };
// Caution alert ids of the controller and the margin each one names.
const HELD_MARGIN = { suit_time: "suit", rover_range: "rover", partner: "partner" };

const finite = (v) => (Number.isFinite(v) ? v : null);
const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function fmtBearing(deg) {
  if (!Number.isFinite(deg)) return null;
  const d = Math.round(((deg % 360) + 360) % 360) % 360;
  return String(d).padStart(3, "0");
}

export function fmtInt(v) {
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return r < 0 ? `-${s}` : s;
}

// {value, unit} so num() keeps the last unit apart: "12 h 56" + "min", "17 min 27" + "s", "20" + "min".
export function fmtDuration(s, { seconds = false } = {}) {
  if (!Number.isFinite(s)) return { value: null, unit: "min" };
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h > 0) return { value: `${h} h ${String(m).padStart(2, "0")}`, unit: "min" };
  if (seconds) return { value: m > 0 ? `${m} min ${String(sec).padStart(2, "0")}` : String(sec), unit: "s" };
  return { value: String(m), unit: "min" };
}

export function fmtUtc(iso) {
  if (typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : iso;
}

function stationName(stations, id) {
  if (id === null || id === undefined) return null;
  const s = stations.find((x) => x.id === id);
  const kind = s && s.kind ? ` ${String(s.kind).toUpperCase()}` : "";
  return `S${id}${kind}`;
}

function workLeft(walk, inputs, timeline, snap) {
  const total = inputs && inputs.work_time_min_per_station ? finite(inputs.work_time_min_per_station.value) : null;
  if (total === null || !snap || snap.at_station === null || snap.at_station === undefined) return { left_s: null, total_s: total === null ? null : total * 60 };
  const arrive = arrivalTimes(timeline)[snap.at_station];
  if (!Number.isFinite(arrive) || !Number.isFinite(walk.t_s)) return { left_s: null, total_s: total * 60 };
  return { left_s: Math.max(0, total * 60 - (walk.t_s - arrive)), total_s: total * 60 };
}

// walkState = state.walk; opts: {sol, timeline, seen: levels acknowledged earlier in this walk}.
export function hudModel(walkState, inputs, limits = LIMITS, opts = {}) {
  const walk = walkState || {};
  const snap = walk.snapshot || null;
  const stations = inputs && Array.isArray(inputs.stations) ? inputs.stations : [];
  const timeline = opts.timeline || walk.timeline || walk.schedule || null;
  const seen = new Set(opts.seen || []);
  const mode = snap && snap.mode ? snap.mode : "walk";
  const speed = inputs && inputs.walking_speed_m_s ? finite(inputs.walking_speed_m_s.value) : null;
  const get = (k) => (snap ? finite(snap[k]) : null);

  // Slot 2: bearing and distance
  const nav = { kind: "station", target: "", bearing: null, distance_m: null, walk_back_s: null, values: true };
  if (mode === "return") {
    nav.kind = "base";
    nav.target = "BASE - CREW ROVER";
    nav.bearing = get("bearing_to_next_deg");
    nav.distance_m = get("dist_to_next_m");
    if (timeline && Number.isFinite(timeline.duration_s) && Number.isFinite(walk.t_s)) nav.walk_back_s = Math.max(0, timeline.duration_s - walk.t_s);
    else if (nav.distance_m !== null && speed > 0) nav.walk_back_s = nav.distance_m / speed;
  } else if (mode === "done") {
    nav.kind = "done";
    nav.target = "AT BASE - WALK COMPLETE";
    nav.values = false;
  } else {
    const next = snap ? stationName(stations, snap.next_station) : null;
    const where = next || "BASE - CREW ROVER";
    nav.target = mode === "work" ? `AFTER WORK: ${where}` : `NEXT ${where}`;
    nav.bearing = get("bearing_to_next_deg");
    nav.distance_m = get("dist_to_next_m");
  }

  // Slots 3 to 5: margins
  const suitLimit = limits.suit_time_max_h * 3600;
  const suit = get("suit_time_left_s");
  const toBase = get("dist_to_base_m");
  const rover = toBase === null ? null : limits.rover_range_m - toBase;
  const partnerDist = get("dist_to_partner_m");
  const partner = partnerDist === null ? null : limits.partner_max_m - partnerDist;
  const margins = [
    { id: "suit", label: "Suit time", value: suit, limit: suitLimit, left: clamp01(suit / suitLimit), level: marginLevel(suit, suitLimit),
      limit_num: { value: limits.suit_time_max_h, unit: "h", source: LIMIT_SOURCES.suit_time_max_h } },
    { id: "rover", label: "Rover", value: rover, limit: limits.rover_range_m, left: clamp01(rover / limits.rover_range_m), level: marginLevel(rover, limits.rover_range_m),
      limit_num: { value: limits.rover_range_m / 1000, unit: "km", source: LIMIT_SOURCES.rover_range_m } },
    { id: "partner", label: "Partner", value: partner, limit: limits.partner_max_m, left: clamp01(partner / limits.partner_max_m), level: marginLevel(partner, limits.partner_max_m),
      limit_num: { value: limits.partner_max_m, unit: "m", source: LIMIT_SOURCES.partner_max_m } },
  ];

  // Slot 1: warning. Held alerts stay lit until acknowledged; after that a compact state stays while the condition lasts.
  const held = Array.isArray(walk.held) ? walk.held : [];
  const heldReturn = held.find((h) => h.level === "return") || null;
  const heldCaution = held.find((h) => h.level === "caution") || null;
  const hazard = walk.hazard || null;
  const hazardOn = !!(hazard && hazard.active);
  const cautionMargin = margins.find((m) => m.level === "caution") || null;
  const stateFor = (lit, level) => (lit ? "lit" : seen.has(level) ? "acknowledged" : "lit");
  let warning = null;
  if (hazardOn || heldReturn) {
    const state = stateFor(!!heldReturn, "return");
    warning = {
      level: "return", word: "RETURN NOW", state, note: state === "lit" ? NOTE_LIT : NOTE_ACK,
      detail: hazardOn ? "Solar particle event" : (heldReturn && (heldReturn.detail || heldReturn.label)) || "Return to the crew rover",
      margin: null,
      scenario: hazardOn ? { event_id: hazard.event_id || null, event_utc: fmtUtc(hazard.event_date), text: SCENARIO_TEXT } : null,
    };
  } else if (cautionMargin || heldCaution) {
    const state = stateFor(!!heldCaution, "caution");
    const heldMargin = heldCaution ? HELD_MARGIN[heldCaution.id] || null : null;
    const marginId = heldMargin || (cautionMargin ? cautionMargin.id : null);
    const named = marginId ? margins.find((m) => m.id === marginId) : null;
    warning = {
      level: "caution", word: "CAUTION", state, note: state === "lit" ? NOTE_LIT : NOTE_ACK,
      detail: (heldCaution && heldCaution.detail) || (named ? `${named.label} margin low` : (heldCaution && heldCaution.label) || "Margin low"),
      margin: marginId,
      scenario: null,
    };
  }

  // Slot 6: science line
  let lead;
  let stationId = null;
  if (mode === "work") {
    stationId = snap ? snap.at_station : null;
    lead = `AT ${stationName(stations, stationId) || "STATION"}`;
  } else if (mode === "walk") {
    stationId = snap ? snap.next_station ?? null : null;
    lead = stationId === null ? "TOWARD BASE" : stationName(stations, stationId);
  } else if (mode === "return") lead = "ON THE WAY BACK";
  else lead = "AT BASE";
  const lmst = snap && Number.isFinite(snap.lmst_hour) ? Math.floor(snap.lmst_hour) : null;
  const temp = snap && snap.conditions ? finite(snap.conditions.ground_brightness_temp_c) : null;
  const work = mode === "work" ? workLeft(walk, inputs, timeline, snap) : { left_s: null, total_s: null };
  const science = {
    lead: `${lead} - ground brightness temperature`,
    station_id: stationId,
    temp_c: temp,
    lmst_hour: lmst,
    sol: Number.isFinite(opts.sol) ? opts.sol : null,
    work_left_s: work.left_s,
    work_total_s: work.total_s,
  };

  const heldAttr = held.length ? "lit" : warning && warning.state === "lit" ? "lit" : warning ? "acknowledged" : "none";
  const cardOpen = walk.card !== null && walk.card !== undefined;
  return {
    visible: !!walk.active,
    mode,
    held: heldAttr,
    warning,
    nav,
    margins,
    science,
    card: cardOpen ? walk.card : null,
    actions: {
      next: { disabled: mode === "return" || mode === "done" },
      ack: { disabled: !(held.length || cardOpen || (warning && warning.state === "lit")), lit: heldAttr === "lit" },
      ret: { pressed: mode === "return", disabled: mode === "done" },
    },
  };
}

// What the status region says when the walk changes state; null when nothing new happened. The controller already
// announces the return and the end of the walk, so those are not repeated here.
export function announcement(prev, next) {
  if (!next || !next.visible) return null;
  const p = prev || {};
  if (next.mode === "work" && (p.mode !== "work" || p.science.station_id !== next.science.station_id) && next.science.station_id !== null) {
    return `Arrived at Station ${next.science.station_id}. Work at the station starts.`;
  }
  const pw = p.warning;
  const nw = next.warning;
  if (nw && nw.level === "caution" && nw.state === "lit" && (!pw || pw.level !== nw.level || pw.state !== "lit")) return `Caution: ${nw.detail}.`;
  return null;
}

// ---- DOM

const SVG = "http://www.w3.org/2000/svg";
function icon(doc, level) {
  const s = doc.createElementNS(SVG, "svg");
  s.setAttribute("class", `icon ${level === "return" ? "icon--octagon" : "icon--triangle"}`);
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  const shape = doc.createElementNS(SVG, "path");
  shape.setAttribute("class", "icon__shape");
  shape.setAttribute("d", level === "return" ? "M8 2h8l6 6v8l-6 6H8l-6-6V8z" : "M12 2.5 22.5 21h-21z");
  const bar = doc.createElementNS(SVG, "path");
  bar.setAttribute("class", "icon__bar");
  bar.setAttribute("d", level === "return" ? "M7 12h10" : "M12 9v6M12 17v2");
  s.append(shape, bar);
  return s;
}

// "Suit time left": the first word stays at every width; the rest hides on narrow screens (app.css), so the
// label never runs into its value.
function marginLabel(doc, name) {
  const i = name.indexOf(" ");
  if (i < 0) return el(doc, "span", { class: "hud__label" }, name);
  return el(doc, "span", { class: "hud__label" }, name.slice(0, i), el(doc, "span", { class: "hud__label-rest" }, name.slice(i)));
}

function el(doc, tag, attrs = {}, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

// Swaps the number in a holder only when what it shows changes. When only the value changed and the element has a
// single .num__value child that holds exactly the old value text, that text changes in place; any other markup gets
// a fresh num() element, so nothing here relies on the inner markup being one way.
function setNum(doc, holder, value, unit, prov, detail) {
  const rest = JSON.stringify([unit, prov, detail]);
  const shown = value === null || value === undefined ? null : String(value);
  if (holder._rest === rest && holder._shown === shown) return;
  const old = holder.firstElementChild;
  const vals = old && holder._rest === rest && holder._shown !== null && shown !== null && typeof old.querySelectorAll === "function" ? old.querySelectorAll(".num__value") : [];
  const inPlace = vals.length === 1 && vals[0].textContent === holder._shown ? vals[0] : null;
  if (inPlace) inPlace.textContent = shown;
  else holder.replaceChildren(num(value ?? null, unit, prov, detail, doc));
  holder._rest = rest;
  holder._shown = shown;
}

const ASSUMED = { name: "walking speed and work time" };

function buildSection(doc, model, actions) {
  const r = {};
  const section = el(doc, "section", { class: "hud", "data-mode": model.mode, "data-held": model.held, "aria-label": `Helmet display, ${model.mode === "work" ? "working at a station" : model.mode === "return" ? "return to rover" : model.mode === "done" ? "walk complete" : "walking"}` });
  section.append(el(doc, "div", { class: "hud__sim-row" }, el(doc, "div", { class: "hud__sim hud-rule" }, "SIMULATION"), el(doc, "span", { class: "hud__sim-line" }, SIM_LINE)));
  r.warning = el(doc, "div", { class: "hud__warning", role: "alert" });
  section.append(r.warning);

  r.target = el(doc, "span", { class: "hud__target", "data-nonmetric": true, "data-kind": model.nav.kind === "base" ? "base" : null });
  r.bearing = el(doc, "span", { class: "hud-slot" });
  r.distance = el(doc, "span", { class: "hud-slot" });
  r.navRow = el(doc, "div", { class: "hud__nav-row" }, r.bearing, r.distance);
  r.walkBack = el(doc, "span", { class: "hud-slot" });
  r.sub = el(doc, "span", { class: "hud__sub", hidden: model.mode !== "return" }, "walk back ", r.walkBack);
  section.append(el(doc, "div", { class: "hud__nav" }, r.target, r.navRow, r.sub));

  const margins = el(doc, "div", { class: "hud__margins" });
  r.margins = model.margins.map((m) => {
    const value = el(doc, "span", { class: "hud-slot" });
    const limit = el(doc, "span", { class: "hud-slot" });
    const bar = el(doc, "span", { class: "hud-margin__bar", "aria-hidden": "true" });
    const box = el(doc, "div", { class: "hud-margin", "data-margin": m.id },
      marginLabel(doc, MARGIN_NAMES[m.id] || m.label),
      el(doc, "span", { class: "hud-margin__line" }, value, el(doc, "span", { class: "hud-margin__of" }, "of ", limit)),
      bar);
    margins.append(box);
    setNum(doc, limit, m.limit_num.value, m.limit_num.unit, "source", { source: m.limit_num.source });
    return { box, value, bar };
  });
  section.append(margins);

  r.lead = el(doc, "span", { "data-nonmetric": true });
  r.temp = el(doc, "span", { class: "hud-slot" });
  r.work = el(doc, "span", { class: "hud-slot hud__work" });
  r.science = el(doc, "div", { class: "hud__science" }, r.lead, r.temp, r.work);
  section.append(r.science);

  const btn = (cls, key, label, fn) => {
    const b = el(doc, "button", { type: "button", class: `hud-btn ${cls}`, "data-key": key.toLowerCase(), "aria-keyshortcuts": key },
      el(doc, "span", { class: "hud-btn__key", "aria-hidden": "true" }, key), label);
    b.addEventListener("click", fn);
    return b;
  };
  const returning = model.mode === "return";
  r.ret = btn("hud-btn--return", "R", returning ? "Returning to rover" : "Return to rover", actions.ret);
  if (returning) {
    r.ret.prepend(icon(doc, "return"));
    r.ret.setAttribute("aria-pressed", "true");
  }
  r.ack = btn("hud-btn--ack", "A", "Acknowledge", actions.ack);
  r.next = btn("hud-btn--next", "N", "Next", actions.next);
  // The three actions in one row at the bottom right; Return keeps its own slot at the left of the row.
  section.append(el(doc, "div", { class: "hud__bottom" }, el(doc, "div", { class: "hud__return" }, r.ret), el(doc, "div", { class: "hud__acts" }, r.ack, r.next)));
  return { section, r };
}

function warningKey(w) {
  return w ? JSON.stringify([w.level, w.state, w.detail, w.margin, w.scenario]) : "";
}

function fillWarning(doc, box, w, model) {
  box.replaceChildren();
  if (!w) {
    box.removeAttribute("data-level");
    box.removeAttribute("data-held");
    return;
  }
  box.setAttribute("data-level", w.level);
  box.setAttribute("data-held", w.state);
  const detail = el(doc, "span", { class: "hud__warning-detail" });
  if (w.scenario) {
    detail.append(`${w.detail} - scenario`);
    if (w.scenario.event_utc) detail.append(" ", num(w.scenario.event_utc, "UTC", "scenario", {}, doc));
  } else {
    detail.append(w.detail);
    const m = w.margin ? model.margins.find((x) => x.id === w.margin) : null;
    if (m) {
      const holder = el(doc, "span", { class: "hud-slot" });
      detail.append(": ", holder);
      marginNum(doc, holder, m);
    }
  }
  const notes = [];
  if (w.note) notes.push(el(doc, "span", { class: "hud__ack-note" }, w.note));
  if (w.scenario && w.state === "acknowledged") notes.push(el(doc, "span", { class: "hud__ack-note" }, w.scenario.text));
  box.append(icon(doc, w.level), el(doc, "span", {}, el(doc, "span", { class: "hud__warning-word" }, w.word), detail, ...notes));
}

// A suit time past the limit shows as a negative margin ("-1 h 00 min"), never as a silent zero.
export function marginDuration(s) {
  if (Number.isFinite(s) && s < 0) {
    const d = fmtDuration(-s);
    return { value: `-${d.value}`, unit: d.unit };
  }
  return fmtDuration(s);
}

function marginNum(doc, holder, m) {
  if (m.id === "suit") {
    const d = marginDuration(m.value);
    setNum(doc, holder, d.value, d.unit, "assumption", ASSUMED);
  } else {
    setNum(doc, holder, fmtInt(m.value), "m", "assumption", m.id === "partner" ? { name: "partner spacing" } : ASSUMED);
  }
}

function isTyping(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

export function mount(ctx) {
  const doc = globalThis.document;
  const root = ctx.regions && ctx.regions.hud;
  if (!doc || !root) return () => {};
  const { store } = ctx;
  const data = ctx.data || {};
  const status = ctx.regions.status || null;
  const actions = ctx.actions || {};

  let built = null;
  let mode = null;
  let wKey = null;
  let prevModel = null;
  let prevHeld = new Set();
  const seen = new Set();
  let card = null; // {id, key, root, workSlot}
  let current = null;

  const say = (text) => {
    if (!status || !text) return;
    status.replaceChildren(el(doc, "span", { "data-nonmetric": true }, text));
  };

  const act = {
    next: () => {
      if (current && !current.actions.next.disabled && typeof actions.next === "function") actions.next();
    },
    ack: () => {
      if (!current) return;
      // Acknowledge closes an open card first; only with no card open does it acknowledge the lit warning.
      if (current.card === null && current.warning && current.warning.state === "lit") seen.add(current.warning.level);
      if (typeof actions.acknowledge === "function") actions.acknowledge();
      update(store.getState());
    },
    ret: () => {
      if (current && current.mode !== "return" && current.mode !== "done" && typeof actions.returnToRover === "function") actions.returnToRover();
    },
  };

  function closeCard() {
    if (!card) return;
    const hadFocus = card.root.contains(doc.activeElement);
    card.root.remove();
    card = null;
    if (built) built.r.science.hidden = false;
    if (hadFocus && built) built.r.ack.focus({ preventScroll: true });
  }

  function syncCard(state, model) {
    if (model.card === null) return closeCard();
    const inputs = state.inputs || data.inputs;
    const stations = inputs && Array.isArray(inputs.stations) ? inputs.stations : [];
    const station = stations.find((s) => s.id === model.card);
    if (!station) return closeCard();
    const key = JSON.stringify([model.card, model.science.lmst_hour, model.mode]);
    // The card opens on arrival while the walk runs on: it never takes the focus (the status region announces the
    // arrival), so the operator's Next button keeps it.
    if (!card || card.key !== key) {
      if (card) card.root.remove();
      const cm = stationCardModel(station, { conditions: data.conditions, dose: data.dose, lmst_hour: model.science.lmst_hour });
      const w = buildWalkCard(doc, cm, { working: model.mode === "work" });
      card = { id: model.card, key, ...w };
      built.r.science.hidden = true;
      built.r.science.after(card.root);
    }
    if (model.science.work_left_s !== null) {
      const d = fmtDuration(model.science.work_left_s);
      const total = fmtDuration(model.science.work_total_s);
      setNum(doc, card.workSlot, d.value, `${d.unit} work left of ${total.value} ${total.unit}`, "assumption", ASSUMED);
    } else card.workSlot.replaceChildren();
  }

  function fill(model) {
    const r = built.r;
    const s = built.section;
    s.setAttribute("data-held", model.held);
    if (r.target.textContent !== model.nav.target) r.target.textContent = model.nav.target;
    r.navRow.hidden = !model.nav.values;
    if (model.nav.values) {
      setNum(doc, r.bearing, fmtBearing(model.nav.bearing), "°", "assumption", ASSUMED);
      setNum(doc, r.distance, fmtInt(model.nav.distance_m), "m", "assumption", ASSUMED);
    }
    if (model.mode === "return") {
      const d = fmtDuration(model.nav.walk_back_s, { seconds: true });
      setNum(doc, r.walkBack, d.value, d.unit, "assumption", { name: "walking speed" });
    }
    model.margins.forEach((m, i) => {
      const slot = r.margins[i];
      marginNum(doc, slot.value, m);
      const st = m.level === "caution" ? "caution" : "ok";
      if (slot.box.getAttribute("data-state") !== st) slot.box.setAttribute("data-state", st);
      const left = m.left.toFixed(3);
      if (slot.bar._left !== left) {
        slot.bar.style.setProperty("--left", left);
        slot.bar._left = left;
      }
    });
    const k = warningKey(model.warning);
    if (k !== wKey) {
      fillWarning(doc, r.warning, model.warning, model);
      wKey = k;
    } else if (model.warning && model.warning.margin) {
      const holder = r.warning.querySelector(".hud-slot");
      const m = model.margins.find((x) => x.id === model.warning.margin);
      if (holder && m) marginNum(doc, holder, m);
    }
    if (r.lead.textContent !== model.science.lead) r.lead.textContent = model.science.lead;
    const sc = model.science;
    if (sc.lmst_hour !== null && sc.sol !== null) setNum(doc, r.temp, sc.temp_c, "°C", "measured", { sol: sc.sol, lmst: sc.lmst_hour, source: "rems", digits: 1 });
    else setNum(doc, r.temp, null, "°C", "source", { source: "rems" });
    if (sc.work_left_s !== null) {
      const d = fmtDuration(sc.work_left_s);
      const total = fmtDuration(sc.work_total_s);
      setNum(doc, r.work, d.value, `${d.unit} work left of ${total.value} ${total.unit}`, "assumption", ASSUMED);
    } else if (r.work.firstChild) {
      r.work.replaceChildren();
      r.work._rest = undefined;
    }
    r.next.disabled = model.actions.next.disabled;
    r.ack.disabled = model.actions.ack.disabled;
    r.ret.disabled = model.actions.ret.disabled;
  }

  function update(state) {
    const walk = state.walk;
    if (!walk || !walk.active) {
      if (built) {
        closeCard();
        built.section.remove();
        built = null;
      }
      mode = null;
      wKey = null;
      prevModel = null;
      prevHeld = new Set();
      seen.clear();
      current = null;
      return;
    }
    const heldNow = new Set((Array.isArray(walk.held) ? walk.held : []).map((h) => h.level));
    for (const lvl of prevHeld) if (!heldNow.has(lvl)) seen.add(lvl);
    prevHeld = heldNow;
    const inputs = state.inputs || data.inputs;
    const model = hudModel(walk, inputs, LIMITS, {
      sol: data.conditions ? data.conditions.sol : null,
      timeline: walk.timeline || walk.schedule || null,
      seen: [...seen],
    });
    current = model;
    if (!built || model.mode !== mode) {
      const hadFocus = built && built.section.contains(doc.activeElement);
      closeCard();
      if (built) built.section.remove();
      built = buildSection(doc, model, act);
      root.append(built.section);
      mode = model.mode;
      wKey = null;
      if (hadFocus) built.r.next.disabled ? built.r.ack.focus({ preventScroll: true }) : built.r.next.focus({ preventScroll: true });
    }
    fill(model);
    syncCard(state, model);
    // The visor keeps three actions in the tab order: its provenance codes carry the full words as title and
    // aria-label, but take no tab stop here (the plan view has the focusable notes).
    if (typeof root.querySelectorAll === "function") for (const p of root.querySelectorAll(".num__prov[tabindex]")) p.removeAttribute("tabindex");
    say(announcement(prevModel, model));
    prevModel = model;
  }

  const onKey = (e) => {
    if (!current || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (isTyping(e.target)) return;
    const modal = doc.querySelector('[aria-modal="true"]') || (doc.getElementById("layer-modal") && doc.getElementById("layer-modal").hasAttribute("data-open"));
    if (modal) return;
    const k = e.key.toLowerCase();
    if (k !== "n" && k !== "a" && k !== "r") return;
    e.preventDefault();
    if (k === "n") act.next();
    else if (k === "a") act.ack();
    else act.ret();
  };
  doc.addEventListener("keydown", onKey);
  const unsub = store.subscribe(update);
  update(store.getState());
  return () => {
    unsub();
    doc.removeEventListener("keydown", onKey);
    closeCard();
    if (built) built.section.remove();
    built = null;
  };
}
