// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { createTerrain, loadTerrain } from "../src/terrain.js";

// Core 2 m wide, 3 x 3 samples at 1 m. Surround 8 m wide, 3 x 3 samples at 4 m. Height = v * 0.5 - 10.
const scene = {
  core: { size_m: 2, dem_samples: 3, slope_cells: 2, dem: "c.bin", slope: "s.bin" },
  surround: { size_m: 8, dem_samples: 3, dem: "s.bin" },
  height: { offset_m: -10, scale_m: 0.5, nodata: 65535 },
  slope: { scale_deg: 0.25, nodata: 255 },
};
// rows from north to south
const core = Uint16Array.from([10, 12, 14, 20, 22, 24, 30, 32, 34]);
const surround = Uint16Array.from([100, 100, 100, 100, 100, 100, 100, 100, 100]);
const slope = Uint8Array.from([4, 8, 255, 254]);
const h = (v) => -10 + v * 0.5;

test("heightAt at samples and bilinear between them", () => {
  const t = createTerrain(scene, { core, surround, slope });
  assert.equal(t.heightAt(-1, 1), h(10));
  assert.equal(t.heightAt(1, -1), h(34));
  assert.equal(t.heightAt(0, 0), h(22));
  assert.ok(Math.abs(t.heightAt(-0.5, 0.5) - h(16)) < 1e-9);
});

test("heightAt row 0 is north and column 0 is west", () => {
  const t = createTerrain(scene, { core, surround, slope });
  assert.ok(t.heightAt(-1, 1) < t.heightAt(1, 1));
  assert.ok(t.heightAt(-1, 1) < t.heightAt(-1, -1));
});

test("heightAt is null on a no-data corner and outside everything", () => {
  const nd = Uint16Array.from(core);
  nd[4] = 65535;
  const t = createTerrain(scene, { core: nd, surround, slope });
  assert.equal(t.heightAt(0, 0), null);
  assert.equal(t.heightAt(-0.9, 0.9), null);
  assert.equal(t.heightAt(100, 0), null);
  assert.equal(t.heightAt(0, -4.5), null);
});

test("outside the core, heightAt falls back to the surround grid", () => {
  const t = createTerrain(scene, { core, surround, slope });
  assert.equal(t.heightAt(3, 3), h(100));
});

test("surround answers while the core is not loaded yet", () => {
  const t = createTerrain(scene, { surround });
  assert.equal(t.heightAt(0, 0), h(100));
  assert.equal(t.slopeAt(0, 0), null);
  t.setCore(core, slope);
  assert.equal(t.heightAt(0, 0), h(22));
});

test("slopeAt decodes v * 0.25, null on no-data and outside the core", () => {
  const t = createTerrain(scene, { core, surround, slope });
  assert.equal(t.slopeAt(-0.5, 0.5), 1);
  assert.equal(t.slopeAt(0.5, 0.5), 2);
  assert.equal(t.slopeAt(-0.5, -0.5), null);
  assert.equal(t.slopeAt(0.5, -0.5), 63.5);
  assert.equal(t.slopeAt(1, -1), 63.5);
  assert.equal(t.slopeAt(3, 3), null);
});

test("loadTerrain builds typed arrays and rejects a wrong size", async () => {
  const sc = { ...scene, core: { ...scene.core, slope: "slope.bin" } };
  const files = { "c.bin": core.buffer, "s.bin": surround.buffer, "slope.bin": slope.buffer };
  const t = await loadTerrain(sc, async (p) => files[p]);
  assert.equal(t.heightAt(0, 0), h(22));
  assert.equal(t.slopeAt(0.5, 0.5), 2);
  await assert.rejects(loadTerrain(sc, async () => new ArrayBuffer(3)), /expected/);
});
