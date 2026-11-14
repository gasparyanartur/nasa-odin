// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The ordered station list in #panel-stations. A row flies the view to its station and selects it in the store.
import { num } from "../provenance.js";
import { keepFocus } from "./focus.js";

// The leg that arrives at a station: from the plan route (a list of legs or {legs}). null when none is planned.
export function legTo(route, stationId) {
  const legs = Array.isArray(route) ? route : route && Array.isArray(route.legs) ? route.legs : [];
  return legs.find((l) => l && l.to && l.to.id === stationId) || null;
}

export function firstLine(task) {
  const t = String(task || "").trim();
  if (t === "") return "TASK NOT SET";
  const cut = t.search(/[.!?](\s|$)/);
  return cut < 0 ? t : t.slice(0, cut + 1);
}

function h(doc, tag, attrs = {}, ...kids) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined) el.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return el;
}

export function mount(ctx, doc = globalThis.document) {
  const dock = ctx.regions && ctx.regions.dock;
  const root = (dock && dock.querySelector && dock.querySelector("#panel-stations")) || doc.getElementById("panel-stations");
  if (!root) return () => {};
  const { store, host } = ctx;

  const METHOD = { method: "path length over the 1 m terrain from the previous stop", sources: ["dem_1m"] };

  function row(s, leg, selected) {
    const b = h(doc, "button", {
      type: "button",
      class: "btn btn--block",
      "aria-pressed": String(selected),
      "aria-label": `Station ${s.id}, fly to it`,
      "data-nonmetric": true,
      style: "justify-content: flex-start; text-align: left; height: auto;",
    });
    const dist = leg
      ? num(leg.distance_m, "m", "derived", METHOD, doc)
      : num(null, "m", "derived", METHOD, doc);
    const bearing = leg
      ? num(leg.bearing_deg, "deg", "derived", { method: "compass bearing from the previous stop, north 0, east 90", sources: ["dem_1m"], digits: 0 }, doc)
      : num(null, "deg", "derived", { method: "compass bearing from the previous stop", sources: ["dem_1m"] }, doc);
    b.append(
      h(doc, "span", { class: "caps", "data-nonmetric": true }, `S${s.id}`),
      h(doc, "span", { "data-nonmetric": true }, ` ${s.kind === "hollow" ? "Hollow" : "Ridge"} - ${firstLine(s.task)} `),
      dist,
      bearing,
    );
    b.addEventListener("click", () => {
      store.setState({ selectedStation: s.id });
      host.flyTo(s.x, s.y);
      const again = root.querySelector(`[aria-label="Station ${s.id}, fly to it"]`);
      if (again && typeof again.focus === "function") again.focus();
    });
    return h(doc, "li", { style: "list-style: none; border-bottom: var(--rule);" }, b);
  }

  function render() {
    const st = store.getState();
    const stations = (st.inputs && st.inputs.stations) || [];
    const route = st.plan && st.plan.route;
    const list = h(doc, "ul", { class: "editor-list", style: "margin: 0; padding: 0;" },
      ...stations.map((s) => row(s, legTo(route, s.id), st.selectedStation === s.id)));
    keepFocus(root, () => root.replaceChildren(
      h(doc, "section", { class: "plate plate--flush", "aria-labelledby": "stl-h" },
        h(doc, "h2", { class: "plate__label", id: "stl-h" }, "Stations"),
        stations.length ? list : h(doc, "p", { class: "plate__note" }, "No stations yet. Add one in the editor."))), doc);
  }

  let lastKey = null;
  const unsubscribe = store.subscribe((st) => {
    const key = [st.inputs, st.plan && st.plan.route, st.selectedStation];
    if (lastKey && key.every((v, i) => Object.is(v, lastKey[i]))) return;
    lastKey = key;
    render();
  });
  render();
  const st0 = store.getState();
  lastKey = [st0.inputs, st0.plan && st0.plan.route, st0.selectedStation];
  return () => {
    unsubscribe();
    root.replaceChildren();
  };
}
