// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Legends of the 11 layers, with units. Every number goes through num(); labels that only carry sol numbers or
// dates are marked data-nonmetric. Hatch swatches use the .swatch classes, which draw the hatches.svg geometry.
import { num } from "../provenance.js";
import { imageLegendText } from "../layers.js";
import { CAUTION_SLOPE_DEG, CAP_SLOPE_DEG } from "../rasters.js";
import { LIMIT_SOURCES } from "../constraints.js";

function el(doc, tag, attrs = {}, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

function row(doc, swatchClass, label, unit) {
  return el(doc, "div", { class: "legend__row" },
    el(doc, "span", { class: `swatch ${swatchClass}`, "aria-hidden": "true" }),
    el(doc, "span", {}, el(doc, "span", { class: "legend__label" }, ...[].concat(label)), unit ? el(doc, "span", { class: "legend__unit" }, ...[].concat(unit)) : null));
}

const note = (doc, ...kids) => el(doc, "p", { class: "legend__note" }, ...kids);

const capNum = (doc) => num(CAP_SLOPE_DEG, "°", "source", { source: LIMIT_SOURCES.slope_cap_deg }, doc);
const cautionNum = (doc) => num(CAUTION_SLOPE_DEG, "°", "assumption", { name: "caution band, a design choice" }, doc);

function metres(v) {
  const r = Math.round(v);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return r < 0 ? `-${s}` : s;
}

// env: {imagery, height, slope, rover, drill, building, waiting}
export function buildLegend(doc, id, env = {}) {
  const box = el(doc, "div", { class: "legend layer-row__legend" });
  if (id === "image") {
    box.append(note(doc, el(doc, "span", { "data-nonmetric": true }, imageLegendText(env.imagery))));
  } else if (id === "height") {
    const h = env.height;
    if (h) {
      const ramp = el(doc, "div", { class: "ramp", "aria-hidden": "true" });
      for (const s of h.steps) {
        const step = el(doc, "span", { class: "ramp__step" });
        step.style.setProperty("--c", s.color);
        ramp.append(step);
      }
      const method = "lowest and highest 1 m cell of the core terrain cut";
      box.append(
        ramp,
        el(doc, "div", { class: "ramp-scale" },
          num(metres(h.min_m), "m", "derived", { method, sources: ["dem_1m"] }, doc),
          num(metres(h.max_m), "m", "derived", { method, sources: ["dem_1m"] }, doc)),
        note(doc, "Light is low, dark is high. Contour lines every ", num(h.step_m, "m", "assumption", { name: "contour interval, a design choice" }, doc), "."),
      );
    } else {
      box.append(note(doc, env.waiting ? "Waiting for the terrain to finish loading." : env.building ? "Building the height layer." : "Heights in metres on the terrain file's own datum. The colour steps show when the layer is on."));
    }
  } else if (id === "slope") {
    const share = (k) => {
      if (!env.slope || !env.slope.shares) return null;
      return num(env.slope.shares[k] * 100, "% of core cells", "derived", { method: "count of the 1 m slope cells in the class", sources: ["dem_1m"], digits: 1 }, doc);
    };
    const unit = (word, k) => {
      const s = share(k);
      return s ? [`${word} - `, s] : word;
    };
    box.append(
      row(doc, "swatch--clear", ["under ", cautionNum(doc)], unit("clear", "ok")),
      row(doc, "swatch--caution", [cautionNum(doc), " to ", capNum(doc)], unit("walkable, steep", "caution")),
      row(doc, "swatch--blocked", ["above ", capNum(doc)], unit("blocked for the planner", "blocked")),
      note(doc, el(doc, "span", { "data-nonmetric": true }, "Slope over a 5 m baseline, as in the study that gives the 15 degree limit.")),
    );
    if (env.waiting) box.append(note(doc, "Waiting for the slope grid to finish loading."));
    else if (env.building) box.append(note(doc, "Building the slope layer."));
  } else if (id === "rover_path") {
    const r = env.rover;
    const label = r ? `Curiosity positions, sols ${r.first} to ${r.last}` : "Curiosity positions";
    box.append(row(doc, "swatch--rover", el(doc, "span", { "data-nonmetric": true }, label), "blue line and points = measured by the rover"));
  } else if (id === "stations") {
    box.append(
      row(doc, "swatch--station", "Station", "ridge or hollow, numbered in walk order"),
      row(doc, "swatch--base", "Crew rover (base)", "start and end of the walk; its position is an assumption"),
    );
  } else if (id === "no_go") {
    box.append(
      row(doc, "swatch--nogo", "No-go zone", "grid hatch, dashed edge"),
      row(doc, "swatch--blocked", ["Cells above ", capNum(doc)], "blocked by the planner, also with the Slope layer off"),
    );
  } else if (id === "drill_sites") {
    for (const s of env.drill || []) {
      const placed = Number.isFinite(s.x) && Number.isFinite(s.y);
      const link = s.source_url
        ? el(doc, "a", { href: s.source_url, rel: "noopener noreferrer", target: "_blank" }, "release")
        : null;
      const reported = typeof s.reported === "string" ? s.reported.replace(/\s*-\s*see the release\s*$/, "") : "";
      box.append(
        el(doc, "div", { class: "legend__row" },
          el(doc, "span", { class: `swatch ${placed ? "swatch--drill" : "swatch--clear"}`, "aria-hidden": "true" }),
          el(doc, "span", { "data-nonmetric": true },
            el(doc, "span", { class: "legend__label" }, s.name),
            el(doc, "span", { class: "legend__unit" }, `${s.kind}; ${placed ? s.position_note : "position not published, no marker"}`),
            el(doc, "span", { class: "legend__unit" }, reported, link ? " - see the " : null, link))),
      );
    }
  } else if (id === "thermal") {
    box.append(note(doc, "Ground brightness temperature in °C by local Mars hour. The values show in Conditions below."));
  } else if (id === "atmosphere") {
    box.append(note(doc, "Air temperature in °C, pressure in Pa, UV in W/m². The values show in Conditions below."));
  } else if (id === "radiation") {
    box.append(note(doc, "Dose rate in µGy/h, with the per-day value and the published Gale values. The values show in Conditions below."));
  } else if (id === "space_weather") {
    box.append(note(doc, "A recorded solar particle event, time in UTC, replayed as a scenario. The values show in Conditions below."));
  }
  return box;
}

// ---- The map key at the foot of the Limits tab in the Details drawer: line symbols, the hatches and the two hazard
// marks. Hatch swatches fill with the real patterns of src/styles/hatches.svg (inlined once per page
// by inlineHatches); until they are in, the swatch shows its CSS twin underneath.
const SVGNS = "http://www.w3.org/2000/svg";
const HATCH_URL = new URL("../styles/hatches.svg", import.meta.url);

function svgEl(doc, tag, attrs) {
  const e = doc.createElementNS ? doc.createElementNS(SVGNS, tag) : doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

// A swatch filled with one hatches.svg pattern at about the scene's period (scale 0.7: 12 m dots every 8 px).
function hatchSwatch(doc, pattern, cls) {
  const s = svgEl(doc, "svg", { class: `map-key__hatch swatch ${cls}`, viewBox: "0 0 36 16", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
  const g = svgEl(doc, "g", { transform: "scale(0.7)" });
  g.appendChild(svgEl(doc, "rect", { width: 52, height: 23, fill: `url(#${pattern}) none` }));
  s.appendChild(g);
  return s;
}

function markIcon(doc, level) {
  const s = svgEl(doc, "svg", { class: `icon ${level === "return" ? "icon--octagon" : "icon--triangle"}`, viewBox: "0 0 24 24", "aria-hidden": "true" });
  const paths = level === "return"
    ? [["icon__shape", "M8 2h8l6 6v8l-6 6H8l-6-6V8z"], ["icon__bar", "M7 12h10"]]
    : [["icon__shape", "M12 2.5 22.5 21h-21z"], ["icon__bar", "M12 9v6M12 17v2"]];
  for (const [c, d] of paths) s.appendChild(svgEl(doc, "path", { class: c, d }));
  return s;
}

export function buildMapKey(doc) {
  const item = (swatch, ...label) => el(doc, "li", { class: "map-key__item" }, swatch, el(doc, "span", { class: "map-key__label" }, ...label));
  const line = (cls) => el(doc, "span", { class: `swatch ${cls}`, "aria-hidden": "true" });
  const list = el(doc, "ul", { class: "map-key" },
    item(line("swatch--route"), "Route"),
    item(line("swatch--return"), "Return path"),
    item(line("swatch--rover"), "Rover data"),
    item(hatchSwatch(doc, "hatch-nogo", "swatch--nogo"), "No-go zone"),
    item(hatchSwatch(doc, "hatch-caution", "swatch--caution"), "Steep slope"),
    item(hatchSwatch(doc, "hatch-blocked", "swatch--blocked"), "Over the cap"),
    el(doc, "li", { class: "map-key__item" }, el(doc, "span", { class: "state state--caution map-key__mark" }, markIcon(doc, "caution"), "Caution")),
    el(doc, "li", { class: "map-key__item" }, el(doc, "span", { class: "state state--return map-key__mark" }, markIcon(doc, "return"), "Return now")));
  return el(doc, "section", { class: "plate map-key-plate", "aria-labelledby": "map-key-h" },
    el(doc, "h2", { class: "plate__label", id: "map-key-h" }, "Legend"),
    list);
}

// Inlines the <defs> of hatches.svg once per page (a local file, same origin). Never throws.
export function inlineHatches(doc, load = (u) => fetch(u).then((r) => (r.ok ? r.text() : null))) {
  try {
    if (!doc || !doc.body || typeof doc.getElementById !== "function" || doc.getElementById("hatch-caution")) return Promise.resolve(false);
    return Promise.resolve(load(HATCH_URL))
      .then((text) => {
        if (typeof text !== "string" || !text.includes("hatch-caution") || doc.getElementById("hatch-caution")) return false;
        const host = doc.createElement("div");
        host.setAttribute("class", "hatch-defs");
        host.setAttribute("aria-hidden", "true");
        host.innerHTML = text;
        doc.body.appendChild(host);
        return true;
      })
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
