// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The 11 layers in #panel-layers: one custom switch per layer with its legend (units) and its credit line from
// sources.json. Map layers draw on the scene: the image mode, the two rasters (built on first switch-on, one shown at
// a time), the Curiosity path and the drill sites with DOM labels. Stations and no-go zones are drawn by the plan
// view; this panel only switches them. Panel layers switch their Conditions sections.
import { onNextFrame } from "../frame.js";
import {
  layerRows, applyLayerSwitch, startLayers, roverPathCoords, campaignSolRange, drillSitePlacement,
  heightLegendModel, slopeLegendModel, bakeHatch, whenPanel, RASTER_LAYERS,
} from "../layers.js";
import { heightTint, slopeClasses } from "../rasters.js";
import { buildLegend } from "./legend.js";
import { mount as mountConditions } from "./conditions-panel.js";
import { mount as mountCredits } from "./credits.js";

const BLUE = "#1f5fa8";
const INK = "#14161a";
const PAPER = "#f4f1ea";
const MODE_WORD = { colour: "Colour", grey: "Greyscale" };
const RASTER_NAME = { height: "Height", slope: "Slope" };

function el(doc, tag, attrs = {}, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const k of kids) if (k !== null && k !== undefined) e.append(typeof k === "string" ? doc.createTextNode(k) : k);
  return e;
}

const later = (fn) => setTimeout(fn, 0);

function toCanvas(doc, rgba, w, h) {
  const c = doc.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g && typeof ImageData === "function") g.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer.slice(0)), w, h), 0, 0);
  return c;
}

async function loadLayersFile() {
  try {
    const r = await fetch("./layers.json");
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export function mount(ctx) {
  const doc = globalThis.document;
  if (!doc) return () => {};
  const { store } = ctx;
  const host = ctx.host || ctx.view;
  const data = ctx.data || {};
  const scene = data.scene || ctx.scene;
  const terrain = ctx.terrain;
  const actions = ctx.actions || {};
  const status = ctx.regions && ctx.regions.status;
  const labelsRoot = (ctx.regions && ctx.regions.labels) || doc.getElementById("labels");

  const rows = new Map(); // id -> {row, sw, legendSlot, modeBtns}
  const raster = { height: null, slope: null }; // built results
  const rasterState = { height: "idle", slope: "idle" }; // idle | waiting | building | ready
  let lastLayers = null;
  let lastRenderer = null;
  let lastImagery = null;
  let lastWalking = null;
  let overlaysOn = { rover_path: null, drill_sites: null };
  let drillLabels = [];
  let unsubs = [];
  let plate = null;
  let note = null;

  const say = (text) => {
    if (status) status.replaceChildren(el(doc, "span", { "data-nonmetric": true }, text));
  };
  const layersNow = () => (Array.isArray(store.getState().layers) ? store.getState().layers : []);
  const setLayer = (id, on) => {
    if (typeof actions.setLayer === "function") actions.setLayer(id, on);
    else {
      const next = applyLayerSwitch(layersNow(), id, on).ids;
      store.setState({ layers: next });
    }
  };

  // ---- rasters
  function rasterSpec(id) {
    const r = raster[id];
    if (!r) return null;
    if (host && host.kind === "3d") {
      return { rgba: r.rgba, width: r.width, height: r.height, hatch: r.hatch || undefined, hatch_color: INK, opacity: 0.9, filter: "nearest", legend: r.legend };
    }
    return { image: r.canvas, opacity: 0.9 };
  }

  function buildRaster(id) {
    if (rasterState[id] === "ready" || rasterState[id] === "building") return;
    const ready = id === "height" ? terrain && terrain.core : terrain && terrain.slope;
    if (!ready || !scene) {
      if (rasterState[id] !== "waiting") {
        rasterState[id] = "waiting";
        refreshLegend(id);
      }
      setTimeout(() => {
        if (layersNow().includes(id) && rasterState[id] === "waiting") {
          rasterState[id] = "idle";
          buildRaster(id);
        }
      }, 500);
      return;
    }
    rasterState[id] = "building";
    refreshLegend(id);
    later(() => {
      try {
        let res;
        if (id === "height") {
          res = heightTint(terrain.core, scene.height);
          res.model = heightLegendModel(res);
          res.canvas = toCanvas(doc, res.rgba, res.width, res.height);
        } else {
          res = slopeClasses(terrain.slope, scene.slope);
          res.model = slopeLegendModel(res);
          res.canvas = toCanvas(doc, bakeHatch(res.rgba, res.hatch, res.width), res.width, res.height);
        }
        raster[id] = res;
        rasterState[id] = "ready";
        if (host) host.setRasterLayer(id, rasterSpec(id));
      } catch {
        rasterState[id] = "idle";
        say(`The ${RASTER_NAME[id]} layer could not be built.`);
      }
      refreshLegend(id);
    });
  }

  // ---- overlays drawn by this panel
  const roverCoords = roverPathCoords(data.waypoints);
  const solRange = campaignSolRange(data.waypoints);
  const inputsNow = () => store.getState().inputs || data.inputs || {};
  const drill = () => drillSitePlacement(inputsNow().drill_sites);

  function syncRoverPath(on) {
    if (!host || overlaysOn.rover_path === on) return;
    overlaysOn.rover_path = on;
    if (on && roverCoords.length > 1) {
      host.setOverlay("rover_path", { kind: "line", coords: roverCoords, style: { color: BLUE, casing: INK, width_px: 2.5, casing_px: 1.5, width: 2.5, layer: "rover_path" } });
      host.setOverlay("rover_path_points", { kind: "points", coords: roverCoords, style: { color: BLUE, casing: PAPER, outline: INK, shape: "circle", size_px: 7, casing_px: 1.5, size: 3, layer: "rover_path" } });
    } else {
      host.setOverlay("rover_path", null);
      host.setOverlay("rover_path_points", null);
    }
  }

  function syncDrill(on) {
    if (!host) return;
    if (overlaysOn.drill_sites !== on) {
      overlaysOn.drill_sites = on;
      const placed = drill().placed;
      if (on && placed.length) {
        host.setOverlay("drill_sites", { kind: "points", coords: placed.map((s) => [s.x, s.y]), style: { color: BLUE, casing: INK, outline: PAPER, shape: "diamond", size_px: 16, casing_px: 2, size: 7, layer: "drill_sites" } });
      } else host.setOverlay("drill_sites", null);
      for (const l of drillLabels) l.node.remove();
      drillLabels = [];
      if (on && labelsRoot) {
        for (const s of placed) {
          const node = el(doc, "div", { class: "drill-label", "data-nonmetric": true },
            // Only the name shows over the scene; the position note is the tag's accessible description and stays in the legend.
            el(doc, "span", { class: "map-tag drill-label__tag", tabindex: "0", role: "note", "aria-label": s.position_note ? `${s.name}. ${s.position_note}` : s.name, title: s.position_note || null },
              el(doc, "span", { class: "map-tag__id" }, s.name)));
          labelsRoot.append(node);
          drillLabels.push({ node, x: s.x, y: s.y });
        }
        placeLabels();
      }
    }
  }

  let rafPending = false;
  function placeLabels() {
    if (!drillLabels.length || !host) return;
    const canvas = doc.getElementById("scene");
    const cr = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const lr = labelsRoot.getBoundingClientRect();
    const walking = !!(store.getState().walk && store.getState().walk.active);
    for (const l of drillLabels) {
      const p = host.project(l.x, l.y);
      const show = p && p.visible && !walking;
      l.node.hidden = !show;
      if (show) l.node.style.transform = `translate(${Math.round(p.sx + cr.left - lr.left)}px, ${Math.round(p.sy + cr.top - lr.top)}px)`;
    }
  }
  const schedulePlace = () => {
    if (rafPending) return;
    rafPending = true;
    onNextFrame(() => {
      rafPending = false;
      placeLabels();
    });
  };

  // ---- the panel
  function legendEnv(id) {
    const state = store.getState();
    return {
      imagery: (state.imagery && state.imagery.mode) || (host && host.getImagery && host.getImagery().mode) || "colour",
      height: raster.height ? raster.height.model : null,
      slope: raster.slope ? { shares: raster.slope.shares, model: raster.slope.model } : null,
      building: rasterState[id] === "building",
      waiting: rasterState[id] === "waiting",
      rover: solRange,
      drill: inputsNow().drill_sites || [],
    };
  }

  function refreshLegend(id) {
    const r = rows.get(id);
    if (!r) return;
    r.legendSlot.replaceChildren(buildLegend(doc, id, legendEnv(id)));
    r.sw.toggleAttribute("aria-busy", rasterState[id] === "building");
  }

  function onSwitch(id) {
    const on = !layersNow().includes(id);
    const { off } = applyLayerSwitch(layersNow(), id, on);
    for (const o of off) setLayer(o, false);
    setLayer(id, on);
    if (off.length) say(`${RASTER_NAME[id]} on. ${off.map((o) => RASTER_NAME[o]).join(", ")} switched off: one raster layer shows at a time.`);
  }

  function modeControl(row) {
    const modes = host && typeof host.imageryModes === "function" ? host.imageryModes() : [];
    if (modes.length < 2) return null;
    const group = el(doc, "div", { class: "segmented layer-row__modes", role: "group", "aria-label": "Image" },
      el(doc, "span", { class: "segmented__label", "aria-hidden": "true" }, "Image"));
    row.modeBtns = new Map();
    for (const m of modes) {
      const b = el(doc, "button", { type: "button", class: "segmented__opt", "aria-pressed": "false" }, MODE_WORD[m] || m);
      b.addEventListener("click", () => {
        if (typeof actions.setImagery === "function") actions.setImagery(m);
        else if (host && host.setImagery) host.setImagery(m);
      });
      row.modeBtns.set(m, b);
      group.append(b);
    }
    return group;
  }

  function build(panel, layerList) {
    if (panel.querySelector('[data-owner="layers"]')) return;
    const list = layerRows(layerList, data.sources);
    plate = el(doc, "section", { class: "plate plate--flush layer-panel", "data-owner": "layers", "aria-labelledby": "layers-h" },
      el(doc, "h2", { class: "plate__label", id: "layers-h" }, "Layers"),
      el(doc, "span", { class: "plate__aside", "data-nonmetric": true }, `${list.length} layers`));
    const box = el(doc, "div", { class: "layer-list" });
    for (const r of list) {
      const sw = el(doc, "button", { type: "button", class: "layer-switch", role: "switch", "aria-checked": "false", "aria-describedby": `layer-${r.id}-legend` },
        el(doc, "span", { class: "layer-switch__track", "aria-hidden": "true" }),
        el(doc, "span", { class: "layer-switch__text" },
          el(doc, "span", { class: "layer-switch__name" }, r.label),
          el(doc, "span", { class: "layer-switch__unit", "data-nonmetric": true }, r.unit)),
        el(doc, "span", { class: "layer-switch__state", "aria-hidden": "true" }));
      sw.addEventListener("click", () => onSwitch(r.id));
      const entry = { row: null, sw, legendSlot: el(doc, "div", { class: "layer-row__legend-slot" }), modeBtns: null };
      const credit = r.credit || (r.id === "stations" ? "Positions and kinds: walk inputs. Relief: USGS 1 m terrain." : null);
      const body = el(doc, "div", { class: "layer-row__body", id: `layer-${r.id}-legend` });
      if (r.id === "image") {
        const mc = modeControl(entry);
        if (mc) body.append(mc);
      }
      body.append(entry.legendSlot);
      if (r.raster) body.append(el(doc, "p", { class: "legend__note layer-row__one" }, "Height and Slope share the map: switching one on switches the other off."));
      if (credit) body.append(el(doc, "p", { class: "layer-row__credit", "data-nonmetric": true }, credit));
      entry.row = el(doc, "div", { class: "layer-row", "data-layer": r.id, "data-kind": r.kind }, sw, body);
      box.append(entry.row);
      rows.set(r.id, entry);
      refreshLegend(r.id);
    }
    plate.append(box);
    panel.append(plate);
    unsubs.push(mountConditions(ctx, panel));

    // URL start list (?layer=): one raster at most, then build what is on.
    const start = startLayers(layersNow());
    for (const o of start.off) setLayer(o, false);
    update(store.getState());
  }

  function update(state) {
    const layers = Array.isArray(state.layers) ? state.layers : [];
    if (layers !== lastLayers) {
      lastLayers = layers;
      for (const [id, r] of rows) r.sw.setAttribute("aria-checked", String(layers.includes(id)));
      for (const id of RASTER_LAYERS) if (layers.includes(id)) buildRaster(id);
      syncRoverPath(layers.includes("rover_path"));
      syncDrill(layers.includes("drill_sites"));
    }
    if (state.renderer !== lastRenderer) {
      const changed = lastRenderer !== null;
      lastRenderer = state.renderer;
      if (changed && host) {
        for (const id of RASTER_LAYERS) if (raster[id]) host.setRasterLayer(id, rasterSpec(id));
        overlaysOn = { rover_path: null, drill_sites: null };
        syncRoverPath(layers.includes("rover_path"));
        syncDrill(layers.includes("drill_sites"));
      }
    }
    const im = state.imagery || {};
    const imKey = `${im.mode}|${im.loading}`;
    if (imKey !== lastImagery) {
      lastImagery = imKey;
      const img = rows.get("image");
      if (img && img.modeBtns) {
        for (const [m, b] of img.modeBtns) {
          b.setAttribute("aria-pressed", String(m === im.mode));
          b.toggleAttribute("aria-busy", !!im.loading && m === im.mode);
        }
      }
      refreshLegend("image");
    }
    const walking = !!(state.walk && state.walk.active);
    if (walking !== lastWalking) {
      lastWalking = walking;
      schedulePlace();
    }
  }

  const stopWait = whenPanel(doc, "panel-layers", async (panel) => {
    const list = Array.isArray(data.layers) && data.layers.length ? data.layers : await loadLayersFile();
    build(panel, list);
  });
  unsubs.push(store.subscribe(update));
  if (host && typeof host.onChange === "function") unsubs.push(host.onChange(schedulePlace));
  const onResize = () => schedulePlace();
  globalThis.addEventListener && globalThis.addEventListener("resize", onResize);
  const stopCredits = mountCredits(ctx);

  return () => {
    stopWait();
    stopCredits();
    for (const u of unsubs) u();
    unsubs = [];
    globalThis.removeEventListener && globalThis.removeEventListener("resize", onResize);
    for (const l of drillLabels) l.node.remove();
    if (plate) plate.remove();
  };
}
