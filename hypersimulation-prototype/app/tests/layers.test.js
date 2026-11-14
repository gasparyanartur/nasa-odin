// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  layerRows, creditLine, applyLayerSwitch, startLayers, roverPathCoords, campaignSolRange, drillSitePlacement,
  heightLegendModel, slopeLegendModel, bakeHatch, imageLegendText, RASTER_LAYERS,
} from "../src/layers.js";
import { heightTint, slopeClasses } from "../src/rasters.js";
import { LAYER_IDS } from "../src/state.js";
import { creditRows, fontLine, SIM_STATEMENT } from "../src/ui/credits.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const layers = read("../layers.json");
const sources = read("../sources.json");

test("layers.json has the 11 layer ids of the app, each with a credit line except stations", () => {
  const rows = layerRows(layers, sources);
  assert.deepEqual(rows.map((r) => r.id).sort(), [...LAYER_IDS].sort());
  for (const r of rows) {
    if (r.id === "stations") assert.equal(r.credit, null);
    else assert.match(r.credit, /^Credit: /, r.id);
  }
  assert.deepEqual(rows.filter((r) => r.raster).map((r) => r.id), RASTER_LAYERS);
});

test("creditLine joins credits in id order and skips duplicates and unknown ids", () => {
  const src = [{ id: "a", credit: "A" }, { id: "b", credit: "B" }, { id: "c", credit: "A" }];
  assert.equal(creditLine(["b", "a", "c", "zz"], src), "Credit: B; A");
  assert.equal(creditLine([], src), null);
});

test("one raster at a time: switching one on switches the other off", () => {
  assert.deepEqual(applyLayerSwitch(["image", "height"], "slope", true), { ids: ["image", "slope"], off: ["height"] });
  assert.deepEqual(applyLayerSwitch(["image", "slope"], "slope", false), { ids: ["image"], off: [] });
  assert.deepEqual(applyLayerSwitch(["image"], "rover_path", true), { ids: ["image", "rover_path"], off: [] });
  assert.deepEqual(startLayers(["image", "height", "slope"]), { ids: ["image", "slope"], off: ["height"] });
  assert.deepEqual(startLayers(["image", "height"]), { ids: ["image", "height"], off: [] });
});

test("rover path: campaign waypoints only, in sol order, with the sol range", () => {
  const wp = { waypoints: [
    { sol: 4600, x: 3, y: 4, in_campaign: true },
    { sol: 4400, x: 9, y: 9, in_campaign: false },
    { sol: 4534, x: 1, y: 2, in_campaign: true },
  ] };
  assert.deepEqual(roverPathCoords(wp), [[1, 2], [3, 4]]);
  assert.deepEqual(campaignSolRange(wp), { first: 4534, last: 4600, n: 2 });
  const real = read("../public/data/waypoints.json");
  const range = campaignSolRange(real);
  assert.equal(range.first, 4534);
  assert.equal(range.last, 4805);
});

test("drill sites: a site with no published position gets no marker", () => {
  const inputs = read("../public/data/team-inputs.json");
  const { placed, unplaced } = drillSitePlacement(inputs.drill_sites);
  assert.deepEqual(placed.map((s) => s.name), ["Altadena", "Nevado Sajama"]);
  assert.deepEqual(unplaced.map((s) => s.name), ["Valle de la Luna"]);
});

test("legend models from the raster builders", () => {
  const n = 5;
  const core = new Uint16Array(n * n);
  for (let k = 0; k < core.length; k++) core[k] = k;
  const tint = heightTint(core, { offset_m: -3600, scale_m: 1, nodata: 65535 });
  const hm = heightLegendModel(tint);
  assert.equal(hm.steps.length, tint.legend.length);
  assert.equal(hm.min_m, tint.min_m);
  assert.equal(hm.max_m, tint.max_m);
  assert.equal(hm.step_m, 5);
  assert.equal(heightLegendModel({ min_m: null, max_m: null }), null);

  const slope = new Uint8Array([0, 48, 64, 255]); // 0, 12, 16 deg, no data
  const cls = slopeClasses(slope, { scale_deg: 0.25, nodata: 255 });
  const sm = slopeLegendModel(cls);
  assert.deepEqual(sm.map((c) => c.swatch), ["swatch--clear", "swatch--caution", "swatch--blocked"]);
  assert.deepEqual(sm.map((c) => [c.from_deg, c.to_deg]), [[0, 10], [10, 15], [15, null]]);
  assert.ok(Math.abs(sm[2].share - 1 / 3) < 1e-9);
});

test("bakeHatch draws ink lines only on hatched cells and leaves the input untouched", () => {
  const w = 10;
  const rgba = new Uint8ClampedArray(w * w * 4);
  const hatch = new Uint8Array(w * w);
  hatch.fill(200, 0, w); // first row blocked
  const out = bakeHatch(rgba, hatch, w);
  assert.equal(rgba.every((v) => v === 0), true);
  let inked = 0;
  for (let k = 0; k < w * w; k++) if (out[k * 4 + 3] > 0) inked++;
  assert.ok(inked > 0);
  for (let k = w; k < w * w; k++) assert.equal(out[k * 4 + 3], 0);
});

test("bakeHatch: blocked is one diagonal family and caution a sparse dot grid, ink at 55 percent, readable terrain", () => {
  const w = 60;
  const rgba = new Uint8ClampedArray(w * w * 4);
  const blocked = new Uint8Array(w * w).fill(200);
  const caution = new Uint8Array(w * w).fill(64);
  const share = (out) => {
    let n = 0;
    for (let k = 0; k < w * w; k++) if (out[k * 4 + 3] > 0) n++;
    return n / (w * w);
  };
  const b = bakeHatch(rgba, blocked, w);
  const c = bakeHatch(rgba, caution, w);
  assert.ok(share(b) > 0.1 && share(b) < 0.2, `blocked covers ${share(b)}`);
  assert.ok(share(c) > 0.02 && share(c) < 0.05, `caution covers ${share(c)}`);
  assert.equal(Math.max(...Array.from(b).filter((_, k) => k % 4 === 3)), 140);
  // one direction only: every inked cell sits on a diagonal i + j with the same residue band
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) assert.equal(b[(j * w + i) * 4 + 3] > 0, (i + j) % 17 < 3);
});

test("image legend text is exact", () => {
  assert.equal(imageLegendText("colour"), "HiRISE colour mosaic (USGS, July 2025) - band mix not stated by USGS; not a true-colour claim");
  assert.equal(imageLegendText("grey"), "Greyscale mosaic (USGS, 25 cm)");
});

test("credits: one row per source, page link preferred over a raw file, the statement", () => {
  const rows = creditRows(sources);
  assert.equal(rows.length, sources.length);
  const colour = rows.find((r) => r.id === "usgs_gale_colour_2025");
  assert.ok(!colour.url.endsWith(".tif"));
  for (const r of rows) assert.ok(r.licence && r.credit, r.id);
  assert.match(fontLine(sources), /B612/);
  assert.equal(SIM_STATEMENT, "The helmet display is a simulation. Designed against named NASA human-systems rules; not tested with astronauts.");
});
