// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The rover check in #panel-rover: our terrain slope at each campaign waypoint against the tilt Curiosity reported there.
import { num } from "../provenance.js";
import { roverCheck, scatterGeometry } from "../rovercheck.js";

export const SLOPE_CAP_DEG = 15;
const SOURCES = ["dem_1m", "msl_waypoints"];
const NS = "http://www.w3.org/2000/svg";

// Numbers from data-checks/alignment.md: horizontal match 0.003 m, height spread 0.107 m, 65 campaign positions.
export const ALIGNMENT = { horizontal_mm: 3, height_spread_m: 0.1, positions: 65 };

// Pure: everything the panel shows, from the waypoints and the terrain.
export function roverPanelModel(waypoints, terrain, cap = SLOPE_CAP_DEG) {
  const r = roverCheck(waypoints, terrain, cap);
  const geo = scatterGeometry(r.pairs, { width: 320, height: 320, pad: 32 });
  const pct = (v) => (v === null ? null : Math.round(v * 100));
  return {
    n: r.n,
    cap,
    slope_under_pct: pct(r.share_under_cap),
    tilt_under_pct: pct(r.share_tilt_under_cap),
    median_diff_deg: r.median_abs_diff_deg === null ? null : Math.round(r.median_abs_diff_deg * 10) / 10,
    note: r.note,
    geo,
  };
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

function s(doc, tag, attrs = {}, text) {
  const el = doc.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
}

function scatterSvg(doc, m) {
  const g = m.geo;
  const W = 320;
  const H = 320;
  const pad = 32;
  const svg = s(doc, "svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Scatter of rover tilt against terrain slope, one point per waypoint", style: "width: 100%; height: 100%;" });
  const capPx = pad + (m.cap / g.max_deg) * (W - 2 * pad);
  svg.append(s(doc, "rect", { x: pad, y: pad, width: W - 2 * pad, height: H - 2 * pad, fill: "none", stroke: "var(--ink)", "stroke-width": 1 }));
  const ticks = s(doc, "g", { "data-nonmetric": "" });
  for (const t of g.ticks) {
    svg.append(s(doc, "line", { x1: t.px, y1: H - pad, x2: t.px, y2: H - pad + 4, stroke: "var(--ink)" }));
    svg.append(s(doc, "line", { x1: pad - 4, y1: H - t.px, x2: pad, y2: H - t.px, stroke: "var(--ink)" }));
    ticks.append(s(doc, "text", { x: t.px, y: H - pad + 16, "text-anchor": "middle", "font-size": 11, fill: "var(--ink)" }, String(t.deg)));
    ticks.append(s(doc, "text", { x: pad - 7, y: H - t.px + 4, "text-anchor": "end", "font-size": 11, fill: "var(--ink)" }, String(t.deg)));
  }
  svg.append(ticks);
  if (m.cap <= g.max_deg) {
    svg.append(s(doc, "line", { x1: capPx, y1: pad, x2: capPx, y2: H - pad, stroke: "var(--ink)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
    svg.append(s(doc, "line", { x1: pad, y1: H - capPx, x2: W - pad, y2: H - capPx, stroke: "var(--ink)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
  }
  svg.append(s(doc, "line", { x1: g.diag[0], y1: g.diag[1], x2: g.diag[2], y2: g.diag[3], stroke: "var(--grey-3)", "stroke-width": 1 }));
  for (const p of g.points) {
    svg.append(s(doc, "circle", { cx: p.cx, cy: p.cy, r: 3.2, fill: "var(--blue)", stroke: "var(--paper)", "stroke-width": 0.8, "fill-opacity": 0.85 }));
  }
  return svg;
}

export function mount(ctx, doc = globalThis.document) {
  const dock = ctx.regions && ctx.regions.dock;
  const root = (dock && dock.querySelector && dock.querySelector("#panel-rover")) || doc.getElementById("panel-rover");
  if (!root) return () => {};

  const wp = ctx.data && ctx.data.waypoints;
  // The slope grid arrives after the first view: the panel is built again once it is in (the first planned route).
  let done = false;
  const build = () => {
    const m = wp && ctx.terrain ? roverPanelModel(wp.waypoints, ctx.terrain, SLOPE_CAP_DEG) : null;
    const method = (text) => ({ method: text, sources: SOURCES });
    const ok = m && m.n > 0;

    const plot = h(doc, "div", { class: "plot", style: "height: 21rem;" },
      h(doc, "div", { class: "plot__y" }, h(doc, "span", { "data-nonmetric": true }, "Terrain slope, deg - derived from the USGS 1 m terrain")),
      h(doc, "div", { class: "plot__area" },
        ok ? scatterSvg(doc, m) : h(doc, "div", { class: "plot__empty" }, num(null, "deg", "derived", method("no waypoints or no terrain to compare"), doc))),
      h(doc, "div", { class: "plot__x" }, "Rover tilt, deg - measured by the rover"));

    const capLine = h(doc, "p", { class: "plate__note" }, "Cap ", num(SLOPE_CAP_DEG, "deg", "source", { source: "pena_asensio_2024" }, doc), " (dashed lines).");

    const facts = h(doc, "dl", { class: "facts" },
      h(doc, "dt", {}, "Waypoints"),
      h(doc, "dd", {}, num(m ? m.n : null, "", "source", { source: "msl_waypoints", count: true }, doc)),
      h(doc, "dt", {}, "Terrain slope at or under the cap"),
      h(doc, "dd", {}, num(ok ? m.slope_under_pct : null, "%", "derived", method("share of the waypoints where our slope grid is at or under the cap"), doc)),
      h(doc, "dt", {}, "Rover tilt at or under the cap"),
      h(doc, "dd", {}, num(ok ? m.tilt_under_pct : null, "%", "derived", method("share of the waypoints where the rover's own tilt is at or under the cap"), doc)),
      h(doc, "dt", {}, "Median difference"),
      h(doc, "dd", {}, num(ok ? m.median_diff_deg : null, "deg", "derived", { ...method("median of the absolute difference between our slope and the rover tilt"), digits: 1 }, doc)));

    const alignment = h(doc, "p", { class: "plate__note" },
      "The orbit image is older than the rover's drive, so it shows no wheel tracks. Alignment is checked two ways: the rover's positions match the map grid within ",
      num(ALIGNMENT.horizontal_mm, "mm", "derived", method("largest difference between the raw easting and northing and our projection of longitude and latitude"), doc),
      ", and the rover's heights match the terrain with a spread of about ",
      num(ALIGNMENT.height_spread_m, "m", "derived", method("standard deviation of terrain height minus rover height over the campaign waypoints"), doc),
      " (",
      num(ALIGNMENT.positions, "positions", "source", { source: "msl_waypoints" }, doc),
      "). The heights may share a source with the terrain.");

    const tiltNote = (wp && wp.tilt_unit_note) || "unit not stated";
    const showPath = h(doc, "button", { type: "button", class: "btn" }, "Show the path on the map");
    showPath.addEventListener("click", () => ctx.actions.setLayer("rover_path", true));

    root.replaceChildren(
      h(doc, "section", { class: "plate", "aria-labelledby": "rov-plot" },
        h(doc, "h2", { class: "plate__label", id: "rov-plot" }, "Slope against rover tilt"),
        h(doc, "span", { class: "plate__aside", "data-nonmetric": true }, "one point per waypoint"),
        plot, capLine),
      h(doc, "section", { class: "plate", "aria-labelledby": "rov-res" },
        h(doc, "h2", { class: "plate__label", id: "rov-res" }, "Result"),
        facts,
        h(doc, "p", { class: "plate__note", "data-nonmetric": true }, m ? m.note : "No result."),
        h(doc, "p", { class: "plate__note", "data-nonmetric": true }, `Tilt unit: ${tiltNote}. Credit: NASA/JPL-Caltech MMGIS waypoints; USGS 1 m terrain (Parker and Calef III; ESA/DLR/FU Berlin).`),
        alignment,
        h(doc, "div", { class: "btn-row", style: "margin-top: var(--sp-3);" }, showPath)));
    done = ok;
  };
  build();
  const off = ctx.store && typeof ctx.store.subscribe === "function"
    ? ctx.store.subscribe((st) => {
      if (!done && st.plan && st.plan.status === "ok") build();
    })
    : () => {};

  return () => {
    off();
    root.replaceChildren();
  };
}
