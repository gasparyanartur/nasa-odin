// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The walk editor in #panel-editor: stations, no-go zones, the five walk values, export, import, reset.
// Every change is a pure edit from editor-model.js handed to ctx.actions.updateInputs.
import { num } from "../provenance.js";
import { validateInputs, exportJson } from "../inputs.js";
import { LIMITS } from "../constraints.js";
import {
  BOUNDS, addStation, moveStation, nudgeStation, setStationKind, setStationTask, removeStation, reorderStation,
  addNoGo, setNoGoLabel, removeNoGo, stepValue,
} from "./editor-model.js";

const ICON_ERR = "M4 4h16v16H4z M8 8l8 8 M16 8l-8 8";
const ICON_MINUS = "M5 12h14";
const ICON_PLUS = "M5 12h14M12 5v14";
const ICON_UP = "M12 16V4M7 9l5-5 5 5M4 20h16";
const ICON_DOWN = "M12 4v12M7 11l5 5 5-5M4 20h16";

const SETTINGS = [
  { key: "walking_speed_m_s", label: "Walking speed", less: "Slower", more: "Faster", hint: "Steps of 0.1 m/s" },
  { key: "work_time_min_per_station", label: "Work time per station", less: "Less", more: "More", hint: "Steps of 5 min" },
  { key: "partner_trail_m", label: "Partner spacing", less: "Closer", more: "Farther", limit: true },
  { key: "hazard_start_min", label: "Hazard scenario starts", less: "Earlier", more: "Later", hint: "Minutes after the walk starts" },
  { key: "start_lmst_hour", label: "Walk starts", less: "Earlier", more: "Later", hint: "Local Mars time on sol 4600" },
];

const NUDGES = [["N", 0, 1, "north"], ["S", 0, -1, "south"], ["E", 1, 0, "east"], ["W", -1, 0, "west"]];
const LIMIT_WORDS = { slope_cap: "slope cap", rover_range: "rover range", no_go: "no-go zone", no_data: "no data" };

export function limitWord(limit) {
  return LIMIT_WORDS[limit] || String(limit || "limit");
}

// The one line under the station list. state.plan = {status, blocking}.
export function routeLine(plan) {
  const status = plan && plan.status;
  if (status === "ok") return "Route: planned";
  if (status === "planning") return "Route: planning";
  if (status === "no_route") {
    const b = plan.blocking || {};
    const at = Number.isInteger(b.station_id) ? ` at Station ${b.station_id}` : "";
    return `No route - ${limitWord(b.limit)}${at}`;
  }
  return "Route: not planned yet";
}

export function lmstText(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Fields whose edits are typed in place. A change that only touches these must not rebuild the lists, or the field
// that holds the focus would be replaced.
export function structureSignature(inputs) {
  return JSON.stringify([
    inputs.stations.map((s) => [s.id, s.x, s.y, s.kind, s.on_path, s.relief_m ?? null]),
    inputs.no_go.map((z) => [z.id, z.polygon]),
    Object.keys(BOUNDS).map((k) => inputs[k].value),
  ]);
}

function h(doc, tag, attrs = {}, ...kids) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return el;
}

// replaceChildren turns null into the text "null", so empty slots are dropped first.
function fill(el, ...kids) {
  el.replaceChildren(...kids.filter((k) => k !== null && k !== undefined && k !== false));
}

function icon(doc, d) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = doc.createElementNS(NS, "path");
  p.setAttribute("d", d);
  svg.appendChild(p);
  return svg;
}

function findPanel(ctx, doc, id) {
  const dock = ctx.regions && ctx.regions.dock;
  return (dock && dock.querySelector && dock.querySelector(`#${id}`)) || doc.getElementById(id);
}

export function mount(ctx, doc = globalThis.document) {
  const root = findPanel(ctx, doc, "panel-editor");
  if (!root) return () => {};
  const { store, host, actions } = ctx;
  const win = doc.defaultView || globalThis;
  const R = ctx.regions || {};

  let mode = null; // null | "add" | "draw"
  let draft = [];
  let message = null; // {kind: "error" | "info", text}
  let pendingFocus = null;
  let lastSig = null;
  let down = null;
  const disposers = [];

  const inputs = () => store.getState().inputs;

  function commit(next, focusKey = null) {
    pendingFocus = focusKey;
    try {
      actions.updateInputs(next);
      message = null;
    } catch (err) {
      message = { kind: "error", text: `The change was refused. ${err && err.message ? err.message : ""}`.trim() };
      render();
    }
  }

  // ---- skeleton
  const stationsBox = h(doc, "div", { class: "editor-list", id: "editor-stations" });
  const addBox = h(doc, "div", { style: "padding: var(--sp-3); display: grid; gap: var(--sp-2);" });
  // The route line names a station by its id only, never a measured value.
  const routeBox = h(doc, "p", { class: "plate__note", id: "editor-route", role: "status", "aria-live": "polite", "data-nonmetric": true });
  const settingsBox = h(doc, "div", { class: "settings", style: "margin-top: 0;" });
  const zonesBox = h(doc, "div", { class: "editor-list" });
  const zoneAddBox = h(doc, "div", { style: "padding: var(--sp-3); display: grid; gap: var(--sp-2);" });
  const fileBox = h(doc, "div", { style: "padding: var(--sp-3); display: grid; gap: var(--sp-2);" });
  const fileInput = h(doc, "input", { type: "file", accept: ".json,application/json", hidden: true, "data-keys": "off", "aria-label": "Inputs file" });

  const plate = (id, title, aside, ...kids) =>
    h(doc, "section", { class: "plate plate--flush", "aria-labelledby": id, style: "margin-bottom: var(--sp-4);" },
      h(doc, "h2", { class: "plate__label", id }, title),
      aside ? h(doc, "span", { class: "plate__aside", "data-nonmetric": true }, aside) : null,
      ...kids);

  root.replaceChildren(
    h(doc, "p", { class: "plate__note" },
      "Place stations on the scene or with the buttons. Walking speed, work time, partner spacing, hazard start and walk start are assumptions. Each one is tagged."),
    plate("ed-st", "Stations", "fixed order", stationsBox, addBox, routeBox),
    plate("ed-set", "Walk settings", null, settingsBox),
    plate("ed-ng", "No-go zones", null, zonesBox, zoneAddBox),
    plate("ed-file", "Inputs file", null, fileBox, fileInput),
  );

  function btn(label, onClick, { fk, primary, disabled, aria, block, pressed } = {}) {
    const b = h(doc, "button", {
      type: "button",
      class: `btn${primary ? " btn--primary" : ""}${block ? " btn--block" : ""}`,
      "data-fk": fk,
      "aria-label": aria,
      "data-nonmetric": aria ? true : null,
      "aria-pressed": pressed === undefined ? null : String(pressed),
      disabled,
    }, ...(Array.isArray(label) ? label : [label]));
    b.addEventListener("click", onClick);
    return b;
  }

  // ---- stations
  function stationRow(s, i, all) {
    const fk = (k) => `${k}-${s.id}`;
    const kindBtn = (kind, text) => {
      const b = h(doc, "button", { type: "button", class: "segmented__opt", role: "radio", "aria-checked": String(s.kind === kind), "data-fk": `${kind}-${s.id}` }, text);
      b.addEventListener("click", () => commit(setStationKind(inputs(), s.id, kind), `${kind}-${s.id}`));
      return b;
    };
    const relief = typeof s.relief_m === "number"
      ? num(`${s.relief_m >= 0 ? "+" : ""}${s.relief_m.toFixed(1)}`, "m", "derived", { method: s.relief_note || "height against the mean of a 31 m box, from the 1 m terrain", sources: ["dem_1m"] }, doc)
      : num(null, "m", "derived", { method: "relief is not known until the position matches the terrain cut", sources: ["dem_1m"] }, doc);

    const nudgeRow = (step) =>
      h(doc, "div", { class: "btn-row", role: "group", "data-nonmetric": true, "aria-label": `Move station ${s.id} in steps of ${step} m` },
        h(doc, "span", { class: "caps", "data-nonmetric": true }, `${step} m`),
        ...NUDGES.map(([letter, dx, dy, word]) =>
          btn(letter, () => commit(nudgeStation(inputs(), s.id, dx * step, dy * step), fk(`n${letter}${step}`)),
            { fk: fk(`n${letter}${step}`), aria: `Move station ${s.id} ${word} ${step} m` })));

    const taskEmpty = s.task.trim() === "";
    const ta = h(doc, "textarea", { class: "field__input", rows: 2, "data-keys": "off", "data-fk": fk("task"), "data-task": s.id });
    ta.value = s.task;
    ta.addEventListener("change", () => {
      const cur = inputs();
      if (cur.stations.some((q) => q.id === s.id)) commit(setStationTask(cur, s.id, ta.value));
    });

    const err = h(doc, "span", { class: "field__error", hidden: !taskEmpty }, icon(doc, ICON_ERR), "Task is empty. The route card prints an empty task as TASK NOT SET.");
    const field = h(doc, "label", { class: "field", "data-error": taskEmpty || null },
      h(doc, "span", { class: "field__label" }, "Task - one thing a human does here"), ta, err);
    ta.addEventListener("input", () => {
      const empty = ta.value.trim() === "";
      err.toggleAttribute ? err.toggleAttribute("hidden", !empty) : null;
      if (empty) field.setAttribute("data-error", ""); else if (field.removeAttribute) field.removeAttribute("data-error");
    });
    return h(doc, "div", { class: "editor-row", "data-station": s.id },
      h(doc, "div", { class: "editor-row__id", "data-nonmetric": true }, `S${s.id}`),
      h(doc, "div", { class: "editor-row__body" },
        h(doc, "div", { class: "editor-row__line" },
          h(doc, "div", { class: "segmented", role: "radiogroup", "data-nonmetric": true, "aria-label": `Kind of station ${s.id}` },
            h(doc, "span", { class: "segmented__label" }, "Kind"), kindBtn("ridge", "Ridge"), kindBtn("hollow", "Hollow")),
          s.on_path ? h(doc, "span", { class: "caps", style: "color: var(--ink-2);" }, "on the Curiosity path") : null,
          h(doc, "span", {}, "relief ", relief)),
        h(doc, "div", { class: "editor-row__line" },
          h(doc, "span", {}, "east ", num(s.x, "m", "derived", { method: "local metres east of the scene centre", sources: ["dem_1m"], digits: 1 }, doc)),
          h(doc, "span", {}, "north ", num(s.y, "m", "derived", { method: "local metres north of the scene centre", sources: ["dem_1m"], digits: 1 }, doc))),
        nudgeRow(1),
        nudgeRow(10),
        field,
        h(doc, "div", { class: "btn-row" },
          btn([icon(doc, ICON_UP), "Earlier"], () => commit(reorderStation(inputs(), s.id, -1), `up-${Math.max(1, s.id - 1)}`), { fk: fk("up"), disabled: i === 0, aria: `Move station ${s.id} earlier in the order` }),
          btn([icon(doc, ICON_DOWN), "Later"], () => commit(reorderStation(inputs(), s.id, +1), `down-${Math.min(all.length, s.id + 1)}`), { fk: fk("down"), disabled: i === all.length - 1, aria: `Move station ${s.id} later in the order` }),
          btn("Remove", () => commit(removeStation(inputs(), s.id), "add-btn"), { fk: fk("rm"), aria: `Remove station ${s.id}` }))));
  }

  function renderStations() {
    const inp = inputs();
    stationsBox.replaceChildren(...(inp.stations.length
      ? inp.stations.map((s, i, all) => stationRow(s, i, all))
      : [h(doc, "p", { class: "plate__note" }, "No stations yet. Add one on the scene or at the view centre.")]));

    fill(addBox, 
      btn(mode === "add" ? "Cancel adding" : "Add a station", () => setMode(mode === "add" ? null : "add"), { fk: "add-btn", block: true, pressed: mode === "add" }),
      mode === "add"
        ? h(doc, "p", { class: "field__hint" }, "Click or tap the scene to place the station. Escape cancels.")
        : null,
      btn("Add at the view centre", () => addAtCentre(), { fk: "add-centre", block: true }));
    routeBox.textContent = routeLine(store.getState().plan);
  }

  // ---- settings
  function renderSettings() {
    const inp = inputs();
    settingsBox.replaceChildren(...SETTINGS.map((cfg) => {
      const b = BOUNDS[cfg.key];
      const v = inp[cfg.key].value;
      const shown = cfg.key === "start_lmst_hour" ? lmstText(v) : v;
      const less = h(doc, "button", { type: "button", class: "stepper__btn", "aria-label": cfg.less, "data-fk": `${cfg.key}-less`, disabled: v <= b.min }, icon(doc, ICON_MINUS));
      const more = h(doc, "button", { type: "button", class: "stepper__btn", "aria-label": cfg.more, "data-fk": `${cfg.key}-more`, disabled: v >= b.max }, icon(doc, ICON_PLUS));
      less.addEventListener("click", () => commit(stepValue(inputs(), cfg.key, -1), `${cfg.key}-less`));
      more.addEventListener("click", () => commit(stepValue(inputs(), cfg.key, +1), `${cfg.key}-more`));
      return h(doc, "div", { class: "field" },
        h(doc, "span", { class: "field__label" }, cfg.label),
        h(doc, "div", { class: "stepper" }, less,
          h(doc, "span", { class: "stepper__value" }, num(shown, b.unit, "assumption", { digits: cfg.key === "start_lmst_hour" ? undefined : b.digits }, doc)),
          more),
        cfg.limit
          ? h(doc, "span", { class: "field__hint" }, "Limit ", num(LIMITS.partner_max_m, "m", "source", { source: "drats_2022" }, doc))
          : h(doc, "span", { class: "field__hint", "data-nonmetric": true }, cfg.hint));
    }));
  }

  // ---- no-go zones
  function renderZones() {
    const inp = inputs();
    zonesBox.replaceChildren(...inp.no_go.map((z) => {
      const input = h(doc, "input", { type: "text", class: "field__input", "data-keys": "off", "data-fk": `zl-${z.id}`, "aria-label": `Label of ${z.label}` });
      input.value = z.label;
      input.addEventListener("change", () => commit(setNoGoLabel(inputs(), z.id, input.value)));
      return h(doc, "div", { class: "editor-row" },
        h(doc, "div", { class: "editor-row__id" }, h(doc, "span", { class: "swatch swatch--nogo", style: "width: 1.75rem;" })),
        h(doc, "div", { class: "editor-row__body" },
          h(doc, "label", { class: "field" }, h(doc, "span", { class: "field__label" }, "Zone label"), input),
          h(doc, "span", { class: "field__hint", "data-nonmetric": true }, `${z.polygon.length} corners`),
          h(doc, "div", { class: "btn-row" },
            btn("Remove", () => commit(removeNoGo(inputs(), z.id), "zone-draw"), { fk: `zr-${z.id}`, aria: `Remove ${z.label}` }))));
    }));
    if (!inp.no_go.length) zonesBox.replaceChildren(h(doc, "p", { class: "plate__note" }, "No no-go zones."));

    if (mode === "draw") {
      zoneAddBox.replaceChildren(
        h(doc, "p", { class: "field__hint", "data-nonmetric": true },
          `${draft.length} corners placed. Click or tap the scene to add a corner. Escape cancels.`),
        btn("Add corner at the view centre", () => addCorner(centrePoint()), { fk: "zone-centre", block: true }),
        h(doc, "div", { class: "btn-row" },
          btn("Close the zone", closeZone, { fk: "zone-close", primary: true, disabled: draft.length < 3 }),
          btn("Cancel", () => setMode(null), { fk: "zone-cancel" })));
    } else {
      zoneAddBox.replaceChildren(btn("Draw a no-go zone", () => setMode("draw"), { fk: "zone-draw", block: true }));
    }
  }

  // ---- file
  function renderFile() {
    const exportBtn = btn([icon(doc, ICON_DOWN), "Export inputs"], doExport, { fk: "export", block: true });
    const importBtn = btn([icon(doc, ICON_UP), "Import inputs"], () => fileInput.click(), { fk: "import", block: true });
    const resetBtn = btn("Reset to the built-in inputs", () => {
      pendingFocus = "reset";
      try {
        actions.resetInputs();
        message = { kind: "info", text: "Built-in inputs restored." };
      } catch (err) {
        message = { kind: "error", text: `Reset failed. ${err && err.message ? err.message : ""}`.trim() };
      }
      render();
    }, { fk: "reset", block: true });
    const msg = message
      ? h(doc, "p", { class: message.kind === "error" ? "field__error" : "field__hint", role: message.kind === "error" ? "alert" : "status", "data-nonmetric": true },
        message.kind === "error" ? icon(doc, ICON_ERR) : null, message.text)
      : null;
    fill(fileBox, exportBtn, importBtn, resetBtn, msg);
  }

  function doExport() {
    const url = win.URL.createObjectURL(exportJson(inputs()));
    const a = h(doc, "a", { href: url, download: "marswalk-walk-inputs.json" });
    doc.body.appendChild(a);
    a.click();
    a.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      message = { kind: "error", text: "The file is not valid JSON. The current inputs are kept." };
      render();
      return;
    }
    const r = validateInputs(parsed);
    if (!r.ok) {
      message = { kind: "error", text: `Field ${r.field}: ${r.problem}. The current inputs are kept.` };
      render();
      return;
    }
    pendingFocus = "import";
    commit(r.inputs, "import");
    if (!message) message = { kind: "info", text: "Inputs imported." };
    render();
  });

  // ---- placing on the scene
  function setMode(next) {
    mode = next;
    draft = [];
    syncDraft();
    render();
  }

  function centrePoint() {
    const rect = (e) => (e && e.isConnected !== false && e.getBoundingClientRect ? e.getBoundingClientRect() : null);
    const drawer = rect(R.drawer || R.dock);
    const head = rect(R.head);
    const foot = rect(R.story);
    const w = win.innerWidth || 1000;
    const hgt = win.innerHeight || 700;
    const right = drawer && drawer.width > 0 && drawer.left > w * 0.4 ? drawer.left : w;
    const top = head && head.bottom < hgt / 2 ? head.bottom : 0;
    const bottom = foot && foot.height > 0 && foot.top > hgt / 2 ? foot.top : hgt;
    return host.pick(right / 2, (top + bottom) / 2);
  }

  function noPoint() {
    message = { kind: "error", text: "That spot is outside the terrain data." };
    render();
  }

  function addAtCentre() {
    const p = centrePoint();
    if (!p) return noPoint();
    placeStation(p);
  }

  function placeStation(p) {
    const n = inputs().stations.length + 1;
    mode = null;
    commit(addStation(inputs(), { x: p.x, y: p.y, kind: "ridge" }), `task-${n}`);
    render();
  }

  function addCorner(p) {
    if (!p) return noPoint();
    draft.push([p.x, p.y]);
    message = null;
    syncDraft();
    render();
  }

  function closeZone() {
    if (draft.length < 3) return;
    const poly = draft;
    mode = null;
    draft = [];
    syncDraft();
    commit(addNoGo(inputs(), poly), "zone-draw");
    render();
  }

  function syncDraft() {
    if (draft.length >= 3) host.setOverlay("editor-draft", { kind: "polygon", coords: draft, style: {} });
    else if (draft.length === 2) host.setOverlay("editor-draft", { kind: "line", coords: draft, style: {} });
    else host.setOverlay("editor-draft", null);
    if (draft.length) host.setOverlay("editor-draft-corners", { kind: "points", coords: draft, style: { shape: "circle", size: 6 } });
    else host.setOverlay("editor-draft-corners", null);
  }

  // A click is a press and a release that stay close together. A drag moves the camera and places nothing.
  const inChrome = (t) => ["drawer", "dock", "head", "story", "modal", "hud"].some((k) => R[k] && R[k].contains && R[k].contains(t))
    || !!(t && typeof t.closest === "function" && t.closest(".map-cluster, .station-pop, .minimap"));
  const onDown = (e) => {
    down = mode && !inChrome(e.target) ? { x: e.clientX, y: e.clientY, t: Date.now() } : null;
  };
  const onUp = (e) => {
    const d = down;
    down = null;
    if (!d || !mode || inChrome(e.target)) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || Date.now() - d.t > 600) return;
    const p = host.pick(e.clientX, e.clientY);
    if (!p) return noPoint();
    if (mode === "add") placeStation(p);
    else addCorner(p);
  };
  const onKey = (e) => {
    if (e.key !== "Escape" || !mode) return;
    // This Escape only cancels the mode; the drawer stays open (main.js skips a handled key).
    e.preventDefault();
    setMode(null);
  };
  doc.addEventListener("pointerdown", onDown, true);
  doc.addEventListener("pointerup", onUp, true);
  doc.addEventListener("keydown", onKey);
  disposers.push(() => {
    doc.removeEventListener("pointerdown", onDown, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("keydown", onKey);
  });

  // ---- render
  function render() {
    const active = doc.activeElement;
    const key = pendingFocus || (active && root.contains && root.contains(active) && active.getAttribute ? active.getAttribute("data-fk") : null);
    pendingFocus = null;
    if (!inputs()) return;
    renderStations();
    renderSettings();
    renderZones();
    renderFile();
    lastSig = structureSignature(inputs());
    if (key) {
      const el = root.querySelector(`[data-fk="${key}"]`);
      if (el && typeof el.focus === "function") el.focus();
    }
  }

  let sigInputs = null;
  const unsubscribe = store.subscribe((state) => {
    if (state.panel && state.panel !== "editor" && mode) {
      mode = null;
      draft = [];
      syncDraft();
    }
    if (!state.inputs) return;
    // The walk clock changes the store every frame: an unchanged inputs object and route line touch no DOM.
    if (lastSig !== null && (state.inputs === sigInputs || structureSignature(state.inputs) === lastSig)) {
      sigInputs = state.inputs;
      const line = routeLine(state.plan);
      if (routeBox.textContent !== line) routeBox.textContent = line;
      return;
    }
    render();
  });
  disposers.push(unsubscribe);

  render();
  return () => {
    for (const fn of disposers) fn();
    host.setOverlay("editor-draft", null);
    host.setOverlay("editor-draft-corners", null);
    root.replaceChildren();
  };
}
