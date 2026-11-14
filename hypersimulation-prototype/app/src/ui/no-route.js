// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The planner states at the top of #panel-limits (design/states.html): planning, no route (one limit, one station,
// two ways forward) and the empty walk (no stations yet). Hidden while a route exists.
import { num } from "../provenance.js";
import { LIMITS, LIMIT_SOURCES } from "../constraints.js";
import { planningPlate } from "./progress.js";
import { keepFocus } from "./focus.js";

const SVG = "http://www.w3.org/2000/svg";

// Pure: words for the blocking limit. blocking = {limit, station_id, detail} from planner.js.
export function describeBlocking(blocking, inputs) {
  const b = blocking || {};
  const stations = (inputs && inputs.stations) || [];
  const st = stations.find((s) => s.id === b.station_id);
  const detail = String(b.detail || "");
  const atPoint = /^Point /.test(detail);
  const cutOff = /even with every limit lifted/.test(detail);
  const station = st
    ? { id: `S${st.id}`, kind: st.kind, text: "cannot be reached" }
    : b.station_id === "base" || b.station_id === "from"
      ? { id: "BASE", kind: "crew rover", text: "cannot be reached on the way back" }
      : { id: null, kind: "", text: "The planner did not name a station" };
  const L = {
    slope_cap: {
      name: "Slope cap", limit: { value: LIMITS.slope_cap_deg, unit: "°", source: LIMIT_SOURCES.slope_cap_deg, label: "Moon, Pena-Asensio 2024" },
      why: atPoint ? "The station sits on ground steeper than the cap. Move it a few metres in the editor."
        : "Every way to the station crosses ground steeper than the cap. With the cap lifted, a path exists.",
      showSlope: true,
    },
    no_go: {
      name: "No-go zone", limit: null,
      why: atPoint ? "The station sits inside a no-go zone." : "Every way to the station crosses a no-go zone. Without the zones, a path exists.",
      showSlope: false,
    },
    rover_range: {
      name: "From crew rover", limit: { value: LIMITS.rover_range_m, unit: "m", source: LIMIT_SOURCES.rover_range_m, label: "Earth analog, D-RATS 2022" },
      why: atPoint ? "The station is farther from the crew rover than the limit." : "Every way to the station leaves the circle around the crew rover.",
      showSlope: false,
    },
    no_data: {
      name: "Terrain data", limit: null,
      why: atPoint ? "The station sits outside the terrain cut or on a cell with no data." : "Every way to the station crosses cells with no terrain data.",
      showSlope: false,
    },
    error: { name: "Planner", limit: null, why: "The planner stopped with an error. Reload the page; if it stays, the inputs file may be damaged.", showSlope: false },
  };
  const out = { station, ...(L[b.limit] || L.no_data) };
  if (cutOff) {
    out.name = "Cut off";
    out.limit = null;
    out.why = "No path exists even with every limit lifted: the ground around the station is cut off in the terrain data.";
    out.showSlope = true;
  }
  return out;
}

function el(doc, tag, cls, ...kids) {
  const e = doc.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

function btn(doc, text, primary, onClick) {
  const b = el(doc, "button", primary ? "btn btn--primary" : "btn", text);
  b.setAttribute("type", "button");
  b.addEventListener("click", onClick);
  return b;
}

function crossIcon(doc) {
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("class", "icon icon--lg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ["M3 3h18v18H3z", "M8 8l8 8M16 8l-8 8"]) {
    const p = doc.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

function noRoutePlate(doc, info, actions) {
  const plate = el(doc, "div", "plate no-route planner-state");
  plate.setAttribute("role", "alert");
  const stationDd = el(doc, "dd", "");
  if (info.station.id) {
    const strong = el(doc, "strong", "", `${info.station.id} ${info.station.kind}`.trim());
    strong.setAttribute("data-nonmetric", "");
    stationDd.append(strong, ` ${info.station.text}`);
  } else stationDd.append(info.station.text);
  const limitDd = el(doc, "dd", "", info.name);
  if (info.limit) limitDd.append(" ", num(info.limit.value, info.limit.unit, "source", { source: info.limit.source, label: info.limit.label }, doc));
  const facts = el(doc, "dl", "no-route__facts",
    el(doc, "dt", "", "Station"), stationDd,
    el(doc, "dt", "", "Limit"), limitDd,
    el(doc, "dt", "", "Why"), el(doc, "dd", "", info.why));
  const row = el(doc, "div", "btn-row", btn(doc, "Open the editor", true, () => actions.setPanel("editor")));
  if (info.showSlope) row.appendChild(btn(doc, "Show the blocked ground", false, () => actions.setLayer("slope", true)));
  plate.append(el(doc, "h2", "plate__label", "Planner"), el(doc, "div", "no-route__head", crossIcon(doc), "NO ROUTE"), facts, row);
  return plate;
}

function emptyPlate(doc, actions) {
  const plate = el(doc, "div", "plate empty planner-state");
  const steps = el(doc, "ol", "empty__steps",
    el(doc, "li", "", "Open the editor and press Add a station."),
    el(doc, "li", "", "Click a ridge or a hollow on the image."),
    el(doc, "li", "", "Mark it ridge or hollow and write its task."));
  plate.append(
    el(doc, "h2", "plate__label", "No stations"),
    el(doc, "p", "plate__title", "No stations yet"),
    el(doc, "p", "", "A walk needs at least one station. The planner then finds a path from the crew rover through each one and back."),
    steps,
    btn(doc, "Open the editor", true, () => actions.setPanel("editor")),
  );
  return plate;
}

export function mount(ctx) {
  const panel = (ctx.regions.drawer || ctx.regions.dock).querySelector("#panel-limits");
  const doc = panel.ownerDocument || globalThis.document;
  const { store, actions } = ctx;
  const host = el(doc, "div", "planner-host");
  panel.insertBefore(host, panel.firstChild);
  let seen = null;
  const render = (s) => {
    const p = s.plan;
    const key = [p.status, p.empty, p.waiting, p.blocking, s.inputs];
    if (seen && key.every((k, i) => k === seen[i])) return;
    seen = key;
    keepFocus(host, () => {
      if (p.status === "planning") host.replaceChildren(planningPlate(doc, { waiting: !!p.waiting }));
      else if (p.status === "no_route") host.replaceChildren(noRoutePlate(doc, describeBlocking(p.blocking, s.inputs), actions));
      else if (p.status === "idle" && p.empty) host.replaceChildren(emptyPlate(doc, actions));
      else host.replaceChildren();
    }, doc);
  };
  render(store.getState());
  const off = store.subscribe(render);
  return () => {
    off();
    host.remove();
  };
}
