// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Station card: fixed furniture in the same order on every card (station and kind, task, measured conditions,
// photo, source). Plan view: a list of cards in the Stations dock panel. Walk view: the compact card that the
// helmet display places in its science slot (buildWalkCard), closed by Acknowledge.
import { num } from "../provenance.js";
import { whenPanel } from "../layers.js";
import { MARS_HOUR_S } from "../replay.js";

export const CONTEXT_PHOTO = {
  src: "./public/media/pia26559_1024.webp",
  width: 1024,
  height: 271,
  id: "PIA26559",
  caption: "Context: Mastcam panorama of the boxwork area, May 2025 - not this station",
  credit: "NASA/JPL-Caltech/MSSS",
};

const SOURCE_TEXT =
  "Conditions: MSL REMS RDR (Gomez-Elvira 2013) and MSL RAD RDR, NASA PDS. Measured at Curiosity, not at this station. " +
  "The ground value is a thermopile brightness temperature, not a contact temperature. Relief: USGS 1 m terrain. " +
  "Task and position: walk inputs.";

const ROWS = [
  { field: "ground_brightness_temp_c", label: "Ground brightness temperature", short: "ground", unit: "°C", digits: 1, source: "rems" },
  { field: "air_temp_c", label: "Air temperature", short: "air", unit: "°C", digits: 1, source: "rems" },
  { field: "pressure_pa", label: "Pressure", short: "pressure", unit: "Pa", digits: 1, source: "rems" },
  { field: "uv_abc_w_m2", label: "UV (A+B+C), lower bound", short: "UV", unit: "W/m²", digits: 2, source: "rems" },
];

const finite = (v) => (Number.isFinite(v) ? v : null);

// Local Mars time of day as "HH:MM".
export function clock(hour) {
  if (!Number.isFinite(hour)) return null;
  const h = ((hour % 24) + 24) % 24;
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    mm = 0;
    hh = (hh + 1) % 24;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function signed(v, digits = 1) {
  if (!Number.isFinite(v)) return null;
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return s;
  return `${v > 0 ? "+" : "-"}${s}`;
}

// Hour means of the chosen sol for one local Mars hour; null for every field that has no data.
export function conditionsAt(conditions, dose, lmstHour) {
  const hour = Number.isFinite(lmstHour) ? ((Math.floor(lmstHour) % 24) + 24) % 24 : null;
  const hours = conditions && Array.isArray(conditions.hours) ? conditions.hours : [];
  const entry = hour === null ? null : hours.find((h) => h.lmst_hour === hour) || null;
  const out = { hour };
  for (const r of ROWS) out[r.field] = entry ? finite(entry[r.field]) : null;
  const dh = dose && Array.isArray(dose.hourly) && hour !== null ? dose.hourly.find((h) => h.lmst_hour === hour) : null;
  out.dose_rate = dh ? finite(dh.value) : null;
  out.dose_detector = dose && dose.dose_rate ? dose.dose_rate.detector || null : null;
  return out;
}

// Arrival time at each station: {station_id: t_s}, from the timeline events or from the schedule blocks that the
// controller keeps in state.walk.schedule (a work block starts at the arrival).
export function arrivalTimes(timeline) {
  const out = {};
  const events = timeline && Array.isArray(timeline.events) ? timeline.events : [];
  for (const e of events) if (e.type === "arrive" && out[e.station_id] === undefined) out[e.station_id] = e.t_s;
  const blocks = timeline && Array.isArray(timeline.blocks) ? timeline.blocks : [];
  for (const b of blocks) if (b.kind === "work" && b.station_id !== null && out[b.station_id] === undefined) out[b.station_id] = b.t0;
  return out;
}

export function stationCardModel(station, { conditions = null, dose = null, lmst_hour = null, basis = null, arrive_lmst = null, credit = null } = {}) {
  const c = conditionsAt(conditions, dose, lmst_hour);
  const kind = station.kind === "hollow" ? "Hollow" : station.kind === "ridge" ? "Ridge" : "Kind not set";
  const rows = ROWS.map((r) => ({ ...r, value: c[r.field] }));
  rows.push({
    field: "dose_rate", label: `Dose rate, detector ${c.dose_detector || "B"}`, short: "dose", unit: "µGy/h", digits: 2, source: "rad",
    value: c.dose_rate,
  });
  const task = typeof station.task === "string" && station.task.trim() ? station.task.trim() : null;
  return {
    id: station.id,
    label: `S${station.id}`,
    aria: `Station ${station.id}`,
    kind,
    kind_word: kind.toUpperCase(),
    path: station.on_path ? "on the Curiosity path" : "off the path - new sample",
    relief: Number.isFinite(station.relief_m)
      ? { value: station.relief_m, note: station.relief_note || "height above (+) or below (-) the local mean, from the 1 m terrain" }
      : null,
    task,
    sol: conditions && Number.isFinite(conditions.sol) ? conditions.sol : null,
    hour: c.hour,
    basis,
    arrive_lmst: finite(arrive_lmst),
    rows,
    photo: { ...CONTEXT_PHOTO, credit: credit || CONTEXT_PHOTO.credit },
    source_text: SOURCE_TEXT,
  };
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

// A measured value with its sol and hour; with no hour known it falls back to the source tag, still NO DATA.
export function measuredNum(value, unit, model, row, doc) {
  if (model.sol !== null && model.hour !== null) {
    return num(value, unit, "measured", { sol: model.sol, lmst: model.hour, source: row.source, digits: row.digits }, doc);
  }
  return num(null, unit, "source", { source: row.source }, doc);
}

export function reliefNum(model, doc) {
  if (!model.relief) return num(null, "m", "derived", { method: "relief from the 1 m terrain", sources: ["dem_1m"] }, doc);
  return num(signed(model.relief.value, 1), "m", "derived", { method: model.relief.note, sources: ["dem_1m"] }, doc);
}

export function buildStationCard(doc, model, { domId = null } = {}) {
  const card = el(doc, "article", { class: "station-card", "aria-label": model.aria, tabindex: "-1", id: domId, "data-station-card": model.id });

  const where = el(doc, "span", { class: "station-card__where" }, "relief ", reliefNum(model, doc));
  if (model.arrive_lmst !== null) {
    where.append(el(doc, "br"), "arrive ", num(clock(model.arrive_lmst), "LMST", "assumption", { name: "walking speed, work time and start time" }, doc));
  }
  card.append(
    el(doc, "header", { class: "station-card__id" },
      el(doc, "span", { class: "station-card__num", "data-nonmetric": true }, model.label),
      el(doc, "span", {},
        el(doc, "span", { class: "station-card__kind" }, model.kind),
        el(doc, "br"),
        el(doc, "span", { class: "caps station-card__path" }, model.path)),
      where),
  );

  const task = el(doc, "section", { class: "station-card__slot" }, el(doc, "h3", { class: "plate__label" }, "Task"));
  if (model.task) task.append(el(doc, "p", { class: "station-card__task", "data-nonmetric": "task text" }, model.task));
  else task.append(el(doc, "p", { class: "station-card__unset" }, el(doc, "strong", {}, "NO TASK"), "No task is written for this station yet."));
  card.append(task);

  const head = model.sol !== null ? `Measured on sol ${model.sol}` : "Measured conditions";
  const dl = el(doc, "dl", { class: "conditions" });
  for (const r of model.rows) {
    dl.append(el(doc, "div", { class: "conditions__row" }, el(doc, "dt", {}, r.label), el(doc, "dd", {}, measuredNum(r.value, r.unit, model, r, doc))));
  }
  const cond = el(doc, "section", { class: "station-card__slot" }, el(doc, "h3", { class: "plate__label", "data-nonmetric": true }, head));
  if (model.basis) cond.append(el(doc, "p", { class: "station-card__basis" }, model.basis));
  cond.append(dl);
  card.append(cond);

  const img = el(doc, "img", {
    src: model.photo.src, width: model.photo.width, height: model.photo.height, loading: "lazy", decoding: "async",
    alt: "Mastcam panorama of the boxwork ridges, a context image not taken at this station",
  });
  card.append(
    el(doc, "figure", { class: "station-card__photo" }, img,
      el(doc, "figcaption", { "data-nonmetric": true },
        el(doc, "strong", {}, `${model.photo.caption}.`),
        ` ${model.photo.id}, ${model.photo.credit}. Resized.`)),
  );
  card.append(el(doc, "footer", { class: "station-card__source", "data-nonmetric": true }, model.source_text));
  return card;
}

// Compact card for the helmet display: it takes the science slot at the bottom edge, so the centre stays clear.
// Returns {root, workSlot}; the helmet display keeps workSlot to update the work time left in place.
export function buildWalkCard(doc, model, { working = false } = {}) {
  const root = el(doc, "div", { class: "hud__science hud-card", role: "group", "aria-label": `${model.aria} card`, tabindex: "-1", "data-station-card": model.id, "data-nonmetric": "station id" });
  const workSlot = el(doc, "span", { class: "hud-slot" });
  root.append(
    el(doc, "div", { class: "hud-card__head" },
      el(doc, "span", { "data-nonmetric": true }, `${working ? "AT " : ""}${model.label} ${model.kind_word}`),
      workSlot),
    el(doc, "p", { class: "hud-card__task", "data-nonmetric": "task text" }, model.task || "No task is written for this station yet."),
  );
  const row = el(doc, "div", { class: "hud-card__row" });
  const [ground, air, , uv] = model.rows;
  row.append(
    el(doc, "span", {}, "ground ", measuredNum(ground.value, ground.unit, model, ground, doc)),
    el(doc, "span", { class: "hud-card__extra" }, "air ", measuredNum(air.value, air.unit, model, air, doc)),
    el(doc, "span", { class: "hud-card__extra" }, "UV ", measuredNum(uv.value, uv.unit, model, uv, doc)),
  );
  root.append(row);
  return { root, workSlot };
}

// ---- plan view: the Stations dock panel

function lmstAt(inputs, t_s) {
  const start = inputs && inputs.start_lmst_hour ? finite(inputs.start_lmst_hour.value) : null;
  if (start === null) return null;
  return (((start + (Number.isFinite(t_s) ? t_s : 0) / MARS_HOUR_S) % 24) + 24) % 24;
}

let photoCredit = null;
function loadCredit(sources) {
  const row = Array.isArray(sources) ? sources.find((s) => s.id === "panorama") : null;
  if (row && row.credit) photoCredit = photoCredit || row.credit;
  if (typeof fetch !== "function") return Promise.resolve(photoCredit);
  return fetch("./public/media/credits.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((list) => {
      const hit = Array.isArray(list) ? list.find((c) => c.file === "pia26559_1024.webp") : null;
      if (hit && hit.credit) photoCredit = hit.credit;
      return photoCredit;
    })
    .catch(() => photoCredit);
}

export function mount(ctx) {
  const doc = globalThis.document;
  if (!doc) return () => {};
  const { store } = ctx;
  const data = ctx.data || {};
  let section = null;
  let list = null;
  let openId = null;
  let builtKey = null;
  let lastWalkCard = null;
  const items = new Map();

  const modelFor = (station, state) => {
    const inputs = state.inputs || data.inputs;
    const walk = state.walk || {};
    const arrivals = arrivalTimes(walk.timeline || walk.schedule);
    const t = arrivals[station.id];
    const arrive = Number.isFinite(t) ? lmstAt(inputs, t) : null;
    const hour = arrive !== null ? arrive : lmstAt(inputs, 0);
    const basis = arrive !== null ? "Hour of the planned arrival." : hour !== null ? "Hour of the walk start; plan the route to see the arrival hour." : null;
    return stationCardModel(station, { conditions: data.conditions, dose: data.dose, lmst_hour: hour, basis, arrive_lmst: arrive, credit: photoCredit });
  };

  function close(id, { focus = true } = {}) {
    const item = items.get(id);
    if (!item) return;
    item.toggle.setAttribute("aria-expanded", "false");
    item.slot.replaceChildren();
    item.slot.hidden = true;
    if (openId === id) openId = null;
    if (focus) item.toggle.focus();
  }

  function open(id, state, { focus = true } = {}) {
    if (openId !== null && openId !== id) close(openId, { focus: false });
    const item = items.get(id);
    if (!item) return;
    const card = buildStationCard(doc, modelFor(item.station, state), { domId: `station-card-${id}` });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(id);
      }
    });
    item.slot.replaceChildren(card);
    item.slot.hidden = false;
    item.toggle.setAttribute("aria-expanded", "true");
    openId = id;
    if (focus) card.focus({ preventScroll: false });
  }

  function build(state) {
    const inputs = state.inputs || data.inputs;
    const stations = inputs && Array.isArray(inputs.stations) ? inputs.stations : [];
    const walk = state.walk || {};
    const key = [inputs, walk.timeline || walk.schedule || null, photoCredit];
    if (builtKey && builtKey.every((v, i) => v === key[i])) return;
    builtKey = key;
    const keep = openId;
    items.clear();
    list.replaceChildren();
    for (const s of stations) {
      const slotId = `station-card-slot-${s.id}`;
      const toggle = el(doc, "button", { type: "button", class: "btn btn--block station-cards__toggle", "aria-expanded": "false", "aria-controls": slotId },
        el(doc, "span", { class: "station-cards__id", "data-nonmetric": true }, `S${s.id}`),
        el(doc, "span", { class: "station-cards__what" }, `${s.kind === "hollow" ? "Hollow" : "Ridge"} - ${s.on_path ? "on the Curiosity path" : "off the path"}`),
        el(doc, "span", { class: "station-cards__chev", "aria-hidden": "true" }));
      const slot = el(doc, "div", { class: "station-cards__slot", id: slotId, hidden: true });
      toggle.addEventListener("click", () => (openId === s.id ? close(s.id) : open(s.id, store.getState())));
      list.append(el(doc, "div", { class: "station-cards__item" }, toggle, slot));
      items.set(s.id, { station: s, toggle, slot });
    }
    section.querySelector(".plate__aside").textContent = `${stations.length} stations`;
    if (keep !== null && items.has(keep)) open(keep, state, { focus: false });
    else openId = null;
  }

  function update(state) {
    if (!list) return;
    build(state);
    const walk = state.walk || {};
    const inWalk = !!walk.active;
    // A card asked for in plan view (a station picked on the map) opens in the list.
    if (!inWalk && walk.card !== null && walk.card !== undefined && walk.card !== lastWalkCard && items.has(walk.card)) open(walk.card, state);
    lastWalkCard = walk.card ?? null;
  }

  const stopWait = whenPanel(doc, "panel-stations", (panel) => {
    if (panel.querySelector('[data-owner="station-cards"]')) return;
    section = el(doc, "section", { class: "plate plate--flush station-cards", "data-owner": "station-cards", "aria-labelledby": "station-cards-h" },
      el(doc, "h2", { class: "plate__label", id: "station-cards-h" }, "Station cards"),
      el(doc, "span", { class: "plate__aside", "data-nonmetric": true }, ""));
    list = el(doc, "div", { class: "station-cards__list" });
    section.append(list);
    panel.append(section);
    update(store.getState());
  });
  const unsub = store.subscribe(update);
  loadCredit(data.sources).then(() => {
    builtKey = null;
    update(store.getState());
  });
  return () => {
    stopWait();
    unsub();
    if (section) section.remove();
  };
}
