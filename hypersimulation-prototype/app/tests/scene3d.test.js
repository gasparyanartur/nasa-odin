// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// The page maps "three" with an import map; in Node the same mapping comes from a resolve hook.
import test from "node:test";
import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTerrain, toUint16 } from "../src/terrain.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const threeUrl = pathToFileURL(here("../vendor/three/build/three.module.js")).href;
nodeModule.registerHooks({
  resolve(spec, ctx, next) {
    return spec === "three" ? { url: threeUrl, shortCircuit: true } : next(spec, ctx);
  },
});
const S = await import("../src/scene3d.js");

const mockDir = here("../public/data-mock/");
const mockScene = JSON.parse(readFileSync(mockDir + "scene.json", "utf8"));
const realShape = {
  core: { size_m: 1024, dem_samples: 1025, tiles: [["a", "b"], ["c", "d"]], tile_px: 2048 },
  surround: { size_m: 2048, dem_samples: 513 },
};

// Minimal greyscale 8-bit PNG decoder (all five filter types) for the mock tiles.
function decodeGreyPng(path) {
  const buf = readFileSync(path);
  let at = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      assert.equal(body[8], 8);
      assert.equal(body[9], 0, "greyscale colour type");
    } else if (type === "IDAT") idat.push(body);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) {
    const f = raw[r * (w + 1)];
    for (let c = 0; c < w; c++) {
      const x = raw[r * (w + 1) + 1 + c];
      const a = c ? out[r * w + c - 1] : 0;
      const b = r ? out[(r - 1) * w + c] : 0;
      const cc = r && c ? out[(r - 1) * w + c - 1] : 0;
      let v = x;
      if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - cc;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - cc);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc);
      }
      out[r * w + c] = v & 255;
    }
  }
  return { w, h, px: out };
}

test("EYE_HEIGHT_M is the 1.7 m assumption and textures are not flipped", () => {
  assert.equal(S.EYE_HEIGHT_M, 1.7);
  assert.equal(S.TEXTURE_FLIP_Y, false);
});

test("groundScale reads a number as x only, an object as given, anything else as 1", () => {
  assert.deepEqual(S.groundScale({ ground_scale: 0.9 }), { x: 0.9, y: 1 });
  assert.deepEqual(S.groundScale({ ground_scale: { x: 0.8, y: 1.01 } }), { x: 0.8, y: 1.01 });
  assert.deepEqual(S.groundScale({}), { x: 1, y: 1 });
  assert.deepEqual(S.groundScale({ ground_scale: -2 }), { x: 1, y: 1 });
  assert.deepEqual(S.groundScale({ ground_scale: { x: "a" } }), { x: 1, y: 1 });
});

test("core chunk layout: 2 x 2 chunks matching the tiles, shared borders, lowDetail halves", () => {
  const lay = S.coreChunkLayout(realShape);
  assert.equal(lay.chunks.length, 4);
  const c00 = lay.chunks.find((c) => c.row === 0 && c.col === 0);
  const c11 = lay.chunks.find((c) => c.row === 1 && c.col === 1);
  assert.deepEqual([c00.west, c00.north, c00.width, c00.cols, c00.i0, c00.j0], [-512, 512, 512, 513, 0, 0]);
  assert.deepEqual([c11.west, c11.north, c11.i0, c11.j0], [0, 0, 512, 512]);
  const low = S.coreChunkLayout(realShape, { lowDetail: true });
  assert.equal(low.stride, 2);
  assert.equal(low.chunks[0].cols, 257);
  assert.throws(() => S.coreChunkLayout({ ...realShape, core: { ...realShape.core, dem_samples: 1024 } }));
});

test("UV builder: tile (row 0, col 0) pixel (0, 0) is the north-west corner, last pixel the south-east", () => {
  const lay = S.coreChunkLayout(realShape);
  const ch = lay.chunks.find((c) => c.row === 0 && c.col === 0);
  const rel = new Float32Array(1025 * 1025);
  const pos = S.gridPositions(rel, 1025, { ...ch, step: lay.step });
  const uv = S.gridUvs(ch.cols, ch.rows);
  // vertex 0: x = pos[0], y north = -pos[2]
  assert.deepEqual([pos[0], -pos[2]], [-512, 512]);
  assert.deepEqual(S.uvToTexel(uv[0], uv[1], 2048, 2048), { col: 0, row: 0 });
  const last = ch.cols * ch.rows - 1;
  assert.deepEqual([pos[last * 3], -pos[last * 3 + 2]], [0, 0]);
  assert.deepEqual(S.uvToTexel(uv[last * 2], uv[last * 2 + 1], 2048, 2048), { col: 2047, row: 2047 });
  // east of vertex 0 grows u, south grows v
  assert.ok(uv[2] > uv[0] && pos[3] > pos[0]);
  const below = ch.cols;
  assert.ok(uv[below * 2 + 1] > uv[1] && -pos[below * 3 + 2] < -pos[2]);
  const c01 = lay.chunks.find((c) => c.row === 0 && c.col === 1);
  const p01 = S.gridPositions(rel, 1025, { ...c01, step: lay.step });
  assert.deepEqual([p01[0], -p01[2]], [0, 512]);
});

test("mock data: the N glyph lands upright in the north-west in both mesh and texture", () => {
  const n = mockScene.core.dem_samples;
  const buf = readFileSync(mockDir + mockScene.core.dem);
  const core = toUint16(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), n * n, "dem_core");
  const h = mockScene.height;
  const h0 = S.referenceHeight(core, h.nodata, h.offset_m, h.scale_m);
  const rel = S.fillNoData(core, n, h.nodata, h.offset_m, h.scale_m, h0);
  const lay = S.coreChunkLayout(mockScene);
  const ch = lay.chunks.find((c) => c.row === 0 && c.col === 0);
  const pos = S.gridPositions(rel, n, { ...ch, step: lay.step });
  const uv = S.gridUvs(ch.cols, ch.rows);
  const tile = decodeGreyPng(mockDir + mockScene.core.tiles[0][0]);
  assert.equal(tile.w, mockScene.core.tile_px);
  // glyph cell (u, v) in 14 m units from (-492, 492); row 1 of "N" is 11001, so u 1.5 is set and u 3.5 is not
  const vertexAt = (x, y) => {
    const i = Math.round((x - ch.west) / lay.step);
    const j = Math.round((ch.north - y) / lay.step);
    return j * ch.cols + i;
  };
  const probe = (u, v) => {
    const vi = vertexAt(-492 + u * 14, 492 - v * 14);
    const t = S.uvToTexel(uv[vi * 2], uv[vi * 2 + 1], tile.w, tile.h);
    return { height: pos[vi * 3 + 1], grey: tile.px[t.row * tile.w + t.col], x: pos[vi * 3], y: -pos[vi * 3 + 2] };
  };
  const set = probe(1.5, 1.5);
  const mirrored = probe(3.5, 1.5);
  const offGlyph = probe(2.5, 8.5);
  assert.ok(set.x < 0 && set.y > 0, "probe sits in the north-west");
  assert.equal(set.grey, 250);
  assert.notEqual(mirrored.grey, 250);
  assert.ok(set.height - mirrored.height > 5, "glyph raised in the DEM at the same place as in the image");
  assert.ok(set.height - offGlyph.height > 5);
});

test("gridIndex: counter-clockwise from above, counts with skirt and stride", () => {
  const cols = 5;
  const rows = 5;
  const pos = S.gridPositions(new Float32Array(25), 5, { cols, rows, west: 0, north: 4, step: 1, skirtDepth: 2 });
  const idx = S.gridIndex(cols, rows, { skirt: true });
  assert.equal(idx.length, (16 * 2 + 4 * 4 * 2) * 3);
  for (let t = 0; t < 16 * 2; t++) {
    const [a, b, c] = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]].map((k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const ny = u[2] * v[0] - u[0] * v[2];
    assert.ok(ny > 0, `triangle ${t} faces up`);
  }
  const skirtV = cols * rows;
  assert.equal(pos[skirtV * 3 + 1], -2, "skirt hangs below the edge");
  assert.equal(S.gridIndex(cols, rows, { stride: 2 }).length, 4 * 2 * 3);
  assert.equal(Math.max(...idx), skirtV + S.skirtVertexCount(cols, rows) - 1);
});

test("surround hole and ring: core cells removed, ring vertices on the core border", () => {
  const keep = S.surroundKeepCell(513, 4, 1024, 512);
  assert.equal(keep(0, 0), true);
  assert.equal(keep(128, 128), false);
  assert.equal(keep(127, 128), true);
  const ring = S.surroundRingVertices(513, 4, 1024, 512);
  assert.equal(ring.length, 4 * 256);
  for (const vi of ring) {
    const x = -1024 + (vi % 513) * 4;
    const y = 1024 - Math.floor(vi / 513) * 4;
    assert.ok(Math.abs(Math.abs(x) - 512) < 1e-9 || Math.abs(Math.abs(y) - 512) < 1e-9);
  }
});

test("triangle budget for the real scene shape", () => {
  assert.deepEqual(S.triangleBudget(realShape), { core: 2097152, skirts: 16384, surround: 393216, total: 2506752 });
  assert.deepEqual(S.triangleBudget(realShape, { lowDetail: true }), { core: 524288, skirts: 8192, surround: 393216, total: 925696 });
});

test("fillNoData fills from neighbours, sampleGrid matches terrain.heightAt minus h0", () => {
  const nd = 65535;
  const grid = Uint16Array.from([nd, 10, 20, 30, nd, 50, nd, nd, nd]);
  const rel = S.fillNoData(grid, 3, nd, -100, 1, -100);
  assert.deepEqual([...rel], [10, 10, 20, 30, 30, 50, 30, 30, 50]);
  const scene = {
    core: { size_m: 8, dem_samples: 9 },
    surround: { size_m: 16, dem_samples: 5 },
    height: { offset_m: -3600, scale_m: 0.01, nodata: nd },
    slope: { scale_deg: 0.25, nodata: 255 },
  };
  scene.core.slope_cells = 8;
  const core = new Uint16Array(81).map((_, k) => 1000 + ((k * 37) % 300));
  const t = createTerrain(scene, { core, surround: new Uint16Array(25).fill(1000) });
  const h0 = S.referenceHeight(core, nd, -3600, 0.01);
  const crel = S.fillNoData(core, 9, nd, -3600, 0.01, h0);
  for (const [x, y] of [[0, 0], [-3.3, 2.7], [3.9, -3.99], [-4, 4]]) {
    assert.ok(Math.abs(S.sampleGrid(crel, 9, 4, 1, x, y) - (t.heightAt(x, y) - h0)) < 1e-3);
  }
  assert.equal(S.sampleGrid(crel, 9, 4, 1, 5, 0), null);
});

test("uvTransform maps a core chunk into the surround image and the half-resolution core image", () => {
  const ch = { west: -512, north: 512, width: 512, height: 512 };
  assert.deepEqual(S.uvTransform(ch, S.squareRect(2048)), [0.25, 0.25, 0.25, 0.25]);
  assert.deepEqual(S.uvTransform({ west: 0, north: 0, width: 512, height: 512 }, S.squareRect(1024)), [0.5, 0.5, 0.5, 0.5]);
});

test("overlay coordinates: local metres to world and back, with ground scale and exaggeration", () => {
  const frame = { gs: { x: 0.9, y: 1 }, exag: 2, h0: -3600 };
  const [X, Y, Z] = S.toWorld(100, 50, 3, frame);
  assert.deepEqual([X, Y, Z], [90, 6, -50]);
  assert.deepEqual(S.fromWorld(X, Z, frame), { x: 100, y: 50 });
  assert.deepEqual(S.toGroup(10, 20, 1.5), [10, 1.5, -20]);
});

test("densifyPath keeps the ends, spacing at most the step, closes polygons", () => {
  const xy = S.densifyPath([[0, 0], [10, 0], [10, 3]], 1);
  assert.deepEqual([xy[0], xy[1]], [0, 0]);
  assert.deepEqual([xy[xy.length - 2], xy[xy.length - 1]], [10, 3]);
  for (let k = 2; k < xy.length; k += 2) assert.ok(Math.hypot(xy[k] - xy[k - 2], xy[k + 1] - xy[k - 1]) <= 1 + 1e-9);
  const ring = S.densifyPath([[0, 0], [4, 0], [4, 4]], 1, { closed: true });
  assert.deepEqual([ring[ring.length - 2], ring[ring.length - 1]], [0, 0]);
  assert.equal(S.densifyPath([], 1).length, 0);
  assert.ok(S.densifyPath([[0, 0], [100000, 0]], 1, { maxPoints: 1000 }).length / 2 <= 1001);
});

test("drapePoints puts points at relative height plus lift, z = -north; missing heights keep the last one", () => {
  const out = S.drapePoints(Float64Array.from([1, 2, 3, 4, 5, 6]), (x) => (x === 3 ? null : x * 10), 0.5);
  assert.deepEqual([...out], [1, 10.5, -2, 3, 10.5, -4, 5, 50.5, -6]);
});

test("segment ribbon: four vertices and two triangles per segment, sides paired for the shader", () => {
  const rb = S.buildSegmentRibbon(Float32Array.from([0, 0, 0, 1, 0, 0, 2, 0, 0]));
  assert.equal(rb.position.length, 2 * 4 * 3);
  assert.equal(rb.index.length, 2 * 6);
  assert.deepEqual([...rb.side.slice(0, 4)], [1, -1, -1, 1]);
  assert.deepEqual([...rb.position.slice(0, 3)], [0, 0, 0]);
  assert.deepEqual([...rb.other.slice(0, 3)], [1, 0, 0]);
  assert.deepEqual([...rb.position.slice(6, 9)], [1, 0, 0]);
  assert.deepEqual([...rb.other.slice(6, 9)], [0, 0, 0]);
  assert.equal(S.buildSegmentRibbon(Float32Array.from([0, 0, 0])).index.length, 0);
});

test("polygon mask: row 0 is north, the pattern channel is set inside only", () => {
  const rect = { west: 0, north: 10, width: 10, height: 10 };
  const poly = { coords: [[0, 10], [5, 10], [5, 5], [0, 5]], channel: S.PATTERNS["hatch-nogo"] };
  const m = S.rasterizePolygonMask([poly], rect, 10, 10);
  const at = (r, c, ch) => m[(r * 10 + c) * 4 + ch];
  assert.equal(at(0, 0, 2), 255);
  assert.equal(at(4, 4, 2), 255);
  assert.equal(at(5, 4, 2), 0);
  assert.equal(at(0, 5, 2), 0);
  assert.equal(at(9, 9, 2), 0);
  assert.equal(at(0, 0, 0), 0);
  const r = S.maskRectFor([poly], { pxM: 0.5, pad: 1 });
  assert.deepEqual([r.west, r.north, r.w, r.h], [-1, 11, 14, 14]);
  assert.equal(S.maskRectFor([poly], { clamp: { west: 100, north: 0, width: 10, height: 10 } }), null);
});

test("hillshade: a flat cell is 255 * sin(45 deg), a slope facing the sun is brighter", () => {
  const flat = S.computeHillshade(new Float32Array(9), 3, 1, 1);
  assert.equal(flat[4], Math.round(255 * Math.SQRT1_2));
  // heights fall towards the north-west (sun at 315 deg), so the surface faces the sun
  const rel = Float32Array.from([0, 1, 2, 1, 2, 3, 2, 3, 4]);
  assert.ok(S.computeHillshade(rel, 3, 1, 1)[4] > flat[4]);
});

test("plan camera pose: heading 0 looks north, 90 looks east, tilt clamps at 70 deg", () => {
  const tgt = { x: 0, y: 0, z: 0 };
  const north = S.planPose(tgt, 100, 30, 0);
  assert.ok(north.z > 0 && Math.abs(north.x) < 1e-9, "camera sits south of the target");
  const east = S.planPose(tgt, 100, 30, 90);
  assert.ok(east.x < 0, "camera sits west of the target");
  const down = S.planPose(tgt, 100, 0, 0);
  assert.ok(down.y > 99.99);
  const steep = S.planPose(tgt, 100, 89, 0);
  assert.ok(Math.abs(Math.acos(steep.y / 100) / (Math.PI / 180) - 70) < 1e-9);
  for (const h of [0, 45, 90, 200, 359]) {
    const p = S.planPose(tgt, 100, 40, h);
    assert.ok(Math.abs(S.headingFromAzimuth(Math.atan2(p.x, p.z)) - h) < 1e-9);
  }
});

test("walk pose: eye 1.7 m above the exaggerated ground, heading 90 looks east", () => {
  const frame = { gs: { x: 1, y: 1 }, exag: 2, h0: 0 };
  const p = S.walkPose({ x: 10, y: 20, groundRel: 3, headingDeg: 90, pitchDeg: 0 }, frame);
  assert.deepEqual([p.position.x, p.position.y, p.position.z], [10, 3 * 2 + 1.7, -20]);
  assert.ok(Math.abs(p.dir.x - 1) < 1e-12 && Math.abs(p.dir.z) < 1e-12);
  const n = S.walkPose({ x: 0, y: 0, groundRel: 0, headingDeg: 0, pitchDeg: 0 }, frame);
  assert.ok(Math.abs(n.dir.z + 1) < 1e-12, "north is -Z");
});

test("ray march finds the terrain, misses upwards, and the occlusion test sees a wall", () => {
  const plane = () => 5;
  const hit = S.rayMarchHeightfield({ x: 3, y: 100, z: 4 }, { x: 0, y: -1, z: 0 }, plane, { yMin: 0, yMax: 10 });
  assert.ok(Math.abs(hit.y - 5) < 1e-9 && hit.x === 3 && hit.z === 4);
  const slope = (X) => X * 0.5;
  const d = { x: Math.SQRT1_2, y: -Math.SQRT1_2, z: 0 };
  const h2 = S.rayMarchHeightfield({ x: 0, y: 50, z: 0 }, d, slope, { yMin: -10, yMax: 60, stepM: 1 });
  assert.ok(Math.abs(h2.y - h2.x * 0.5) < 1e-3 && Math.abs(h2.x - 100 / 3) < 1e-3);
  assert.equal(S.rayMarchHeightfield({ x: 0, y: 50, z: 0 }, { x: 0, y: 1, z: 0 }, plane, { yMin: 0, yMax: 10 }), null);
  assert.equal(S.rayMarchHeightfield({ x: 0, y: 50, z: 0 }, { x: 0, y: -1, z: 0 }, () => null, { yMin: 0, yMax: 10 }), null);
  const wall = (X) => (X > 9.5 && X < 12.5 ? 20 : 0);
  assert.equal(S.segmentOccluded({ x: 0, y: 1, z: 0 }, { x: 30, y: 1, z: 0 }, wall), true);
  assert.equal(S.segmentOccluded({ x: 0, y: 1, z: 0 }, { x: 30, y: 1, z: 0 }, () => 0), false);
});

test("zoom limits: whole surround fits at the minimum, 0.1 m per px at the maximum", () => {
  const z = S.zoomLimits(1000, 800, 2048, 2048);
  assert.ok(z.minZoom * 2048 <= 800);
  assert.equal(z.maxZoom, 10);
});
