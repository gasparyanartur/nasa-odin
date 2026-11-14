// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Layer logic with no DOM: the rows of app/layers.json with their credit lines, the one-raster-at-a-time rule,
// the overlay geometry for the rover path and the drill sites, and the legend models.

export const RASTER_LAYERS = ["height", "slope"];
export const PANEL_LAYERS = ["thermal", "atmosphere", "radiation", "space_weather"];
// Drawn by the plan view (route overlays); this panel only switches them.
export const DELEGATED_LAYERS = ["stations", "no_go"];

export const IMAGE_LEGEND = {
  colour: "HiRISE colour mosaic (USGS, July 2025) - band mix not stated by USGS; not a true-colour claim",
  grey: "Greyscale mosaic (USGS, 25 cm)",
};

export function imageLegendText(mode) {
  return IMAGE_LEGEND[mode] || IMAGE_LEGEND.colour;
}

// "Credit: A; B" from the source rows, in the order of the ids; ids without a row are skipped.
export function creditLine(sourceIds, sources) {
  const byId = new Map((Array.isArray(sources) ? sources : []).map((s) => [s.id, s]));
  const seen = new Set();
  const parts = [];
  for (const id of Array.isArray(sourceIds) ? sourceIds : []) {
    const row = byId.get(id);
    if (!row || !row.credit || seen.has(row.credit)) continue;
    seen.add(row.credit);
    parts.push(row.credit);
  }
  return parts.length ? `Credit: ${parts.join("; ")}` : null;
}

export function layerRows(layers, sources) {
  return (Array.isArray(layers) ? layers : []).map((l) => ({
    id: l.id,
    label: l.label,
    unit: l.unit,
    kind: l.kind,
    source_ids: Array.isArray(l.source_ids) ? l.source_ids : [],
    credit: creditLine(l.source_ids, sources),
    raster: RASTER_LAYERS.includes(l.id),
  }));
}

// Switching a raster on switches the other raster off: only one raster shows at a time.
export function applyLayerSwitch(current, id, on) {
  const ids = new Set(Array.isArray(current) ? current : []);
  const off = [];
  if (on) {
    ids.add(id);
    if (RASTER_LAYERS.includes(id)) {
      for (const other of RASTER_LAYERS) {
        if (other !== id && ids.has(other)) {
          ids.delete(other);
          off.push(other);
        }
      }
    }
  } else ids.delete(id);
  return { ids: [...ids], off };
}

// URL start list (?layer=): if both rasters are named, the last one named wins.
export function startLayers(list) {
  const ids = Array.isArray(list) ? list : [];
  const rasters = ids.filter((id) => RASTER_LAYERS.includes(id));
  if (rasters.length < 2) return { ids: [...ids], off: [] };
  const keep = rasters[rasters.length - 1];
  const off = rasters.filter((id) => id !== keep);
  return { ids: ids.filter((id) => !off.includes(id)), off: [...new Set(off)] };
}

function campaign(waypoints) {
  const list = waypoints && Array.isArray(waypoints.waypoints) ? waypoints.waypoints : Array.isArray(waypoints) ? waypoints : [];
  return list
    .filter((w) => w && w.in_campaign === true && Number.isFinite(w.x) && Number.isFinite(w.y))
    .sort((a, b) => a.sol - b.sol);
}

export function roverPathCoords(waypoints) {
  return campaign(waypoints).map((w) => [w.x, w.y]);
}

export function campaignSolRange(waypoints) {
  const c = campaign(waypoints);
  return c.length ? { first: c[0].sol, last: c[c.length - 1].sol, n: c.length } : null;
}

export function drillSitePlacement(sites) {
  const placed = [];
  const unplaced = [];
  for (const s of Array.isArray(sites) ? sites : []) {
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) placed.push(s);
    else unplaced.push(s);
  }
  return { placed, unplaced };
}

// Height legend from rasters.heightTint: the stepped ramp and the lowest and highest cell.
export function heightLegendModel(tint) {
  if (!tint || !Number.isFinite(tint.min_m) || !Number.isFinite(tint.max_m)) return null;
  return {
    steps: tint.legend.map((b) => ({ color: b.color, from_m: b.from_m, to_m: b.to_m })),
    min_m: tint.min_m,
    max_m: tint.max_m,
    step_m: tint.step_m,
  };
}

// Slope legend from rasters.slopeClasses: three classes in degrees with the hatch swatch class and the share of cells.
export function slopeLegendModel(classes) {
  if (!classes) return null;
  const swatch = { ok: "swatch--clear", caution: "swatch--caution", blocked: "swatch--blocked" };
  const word = { ok: "clear", caution: "walkable, steep", blocked: "blocked for the planner" };
  return classes.legend.map((c) => ({
    id: c.id,
    from_deg: c.from_deg,
    to_deg: c.to_deg,
    swatch: swatch[c.id],
    word: word[c.id],
    share: classes.shares ? classes.shares[c.id] : null,
  }));
}

// The 2D map has no hatch channel, so the hatch is baked into the image, in cells (about 0.8 screen px per cell at the plan
// zoom): blocked = one 45 degree line family (line period 17 cells, about 9.6 px apart, 3 cells wide, about 1.5 px),
// caution = a sparse grid of 2 x 2 dots every 12 cells (about 10 px). Ink at 55 percent, no casing.
export function bakeHatch(rgba, hatch, width, { period = 17, line = 3, dotPeriod = 12, dot = 2, ink = [20, 22, 26] } = {}) {
  const out = new Uint8ClampedArray(rgba);
  if (!hatch) return out;
  const height = Math.floor(hatch.length / width);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const v = hatch[j * width + i];
      if (!v) continue;
      const on = v >= 128 ? (i + j) % period < line : i % dotPeriod < dot && j % dotPeriod < dot;
      if (!on) continue;
      const o = (j * width + i) * 4;
      out[o] = ink[0];
      out[o + 1] = ink[1];
      out[o + 2] = ink[2];
      out[o + 3] = 140;
    }
  }
  return out;
}

// Calls fn(el) once the element with this id exists (the dock builds its panels in its own mount).
export function whenPanel(doc, id, fn) {
  if (!doc || typeof doc.getElementById !== "function") return () => {};
  const now = doc.getElementById(id);
  if (now) {
    fn(now);
    return () => {};
  }
  if (typeof MutationObserver === "undefined" || !doc.body) return () => {};
  let done = false;
  const obs = new MutationObserver(() => {
    const el = doc.getElementById(id);
    if (el && !done) {
      done = true;
      obs.disconnect();
      fn(el);
    }
  });
  obs.observe(doc.body, { childList: true, subtree: true });
  return () => {
    done = true;
    obs.disconnect();
  };
}
