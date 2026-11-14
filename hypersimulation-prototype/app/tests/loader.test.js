// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { loadFirstView, loadTiles, loadAll, loadImagery, imageryModes, pickImagery, imageryPaths } from "../src/loader.js";

const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
const inputs = JSON.parse(readFileSync(new URL("../public/data/team-inputs.json", import.meta.url), "utf8"));

function makeSite() {
  const site = {
    "ov.png": new Uint8Array(40),
    "ds.bin": new Uint8Array(3 * 3 * 2),
    "dc.bin": new Uint8Array(3 * 3 * 2),
    "sl.bin": new Uint8Array(2 * 2),
    "t0.png": new Uint8Array(30),
    "t1.png": new Uint8Array(31),
    "half.png": new Uint8Array(10),
    "waypoints.json": enc({ waypoints: [] }),
    "conditions.json": enc({ hours: [] }),
    "dose.json": enc({}),
    "sep-event.json": enc({}),
    "team-inputs.json": enc(inputs),
    "../sources.json": enc([]),
  };
  const files = {};
  for (const [k, v] of Object.entries(site)) if (k !== "../sources.json") files[k] = v.byteLength;
  const scene = {
    core: { size_m: 2, dem_samples: 3, slope_cells: 2, dem: "dc.bin", slope: "sl.bin", tiles: [["t0.png", "t1.png"]], half_res: "half.png" },
    surround: { size_m: 8, dem_samples: 3, dem: "ds.bin" },
    overview: "ov.png",
    height: { offset_m: 0, scale_m: 1, nodata: 65535 },
    slope: { scale_deg: 0.25, nodata: 255 },
    files,
  };
  site["scene.json"] = enc(scene);
  return { site, scene };
}

function fakeFetch(site, hooks = {}) {
  const requested = [];
  const fn = async (url) => {
    const path = url.replace(/^data\//, "");
    requested.push(path);
    if (hooks.status && hooks.status[path]) return { ok: false, status: hooks.status[path] };
    let body = site[path];
    if (!body) return { ok: false, status: 404 };
    const lengthHeader = hooks.lie && hooks.lie[path] !== undefined ? hooks.lie[path] : body.byteLength;
    if (hooks.cut && hooks.cut[path]) body = body.slice(0, body.byteLength - hooks.cut[path]);
    return {
      ok: true, status: 200,
      headers: { get: (h) => (h.toLowerCase() === "content-length" ? String(lengthHeader) : null) },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  fn.requested = requested;
  return fn;
}
const decodeImage = async (buf, path) => ({ decoded: path, bytes: buf.byteLength });

test("loadFirstView loads scene.json, overview, surround DEM and small files", async () => {
  const { site } = makeSite();
  const f = fakeFetch(site);
  const r = await loadFirstView("data/", null, { fetch: f, decodeImage });
  assert.deepEqual(r.textures.overview, { decoded: "ov.png", bytes: 40 });
  assert.equal(r.terrain.heightAt(0, 0), 0);
  assert.equal(r.terrain.core, null);
  assert.equal(r.inputs.stations.length, inputs.stations.length);
  assert.ok(!f.requested.includes("dc.bin") && !f.requested.includes("t0.png"));
});

test("progress is bytes loaded over bytes total and ends at total", async () => {
  const { site } = makeSite();
  const seen = [];
  await loadFirstView("data/", (p) => seen.push(p), { fetch: fakeFetch(site), decodeImage });
  const last = seen[seen.length - 1];
  assert.equal(last.loaded, last.total);
  assert.ok(last.total > 0);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i].loaded >= seen[i - 1].loaded);
  assert.ok(seen.every((p) => p.loaded <= p.total || p.total === 0));
});

test("a 404 rejects with the file name and status", async () => {
  const { site } = makeSite();
  delete site["dose.json"];
  await assert.rejects(loadFirstView("data/", null, { fetch: fakeFetch(site), decodeImage }), (e) => {
    assert.equal(e.file, "dose.json");
    assert.equal(e.status, 404);
    assert.match(e.reason, /404/);
    return true;
  });
});

test("a body shorter than scene.json files, or than Content-Length, rejects with the file name", async () => {
  const { site } = makeSite();
  await assert.rejects(
    loadFirstView("data/", null, { fetch: fakeFetch(site, { cut: { "ds.bin": 2 } }), decodeImage }),
    (e) => e.file === "ds.bin" && /expected 18/.test(e.reason),
  );
  await assert.rejects(
    loadFirstView("data/", null, { fetch: fakeFetch(site, { cut: { "scene.json": 5 } }), decodeImage }),
    (e) => e.file === "scene.json",
  );
});

test("a network failure rejects with status 0", async () => {
  const f = async () => { throw new Error("offline"); };
  await assert.rejects(loadFirstView("data/", null, { fetch: f, decodeImage }), (e) => e.file === "scene.json" && e.status === 0 && /offline/.test(e.reason));
});

test("a broken team-inputs file names the bad field", async () => {
  const { site } = makeSite();
  site["team-inputs.json"] = enc({ ...inputs, stations: undefined });
  const scene = JSON.parse(new TextDecoder().decode(site["scene.json"]));
  scene.files["team-inputs.json"] = site["team-inputs.json"].byteLength;
  site["scene.json"] = enc(scene);
  await assert.rejects(loadFirstView("data/", null, { fetch: fakeFetch(site), decodeImage }), (e) => e.file === "team-inputs.json" && /stations/.test(e.reason));
});

test("a team-inputs file that is not valid JSON is an input error with a field, so the committed copy is offered", async () => {
  const { site } = makeSite();
  site["team-inputs.json"] = new TextEncoder().encode('{"placeholder": true,}');
  await assert.rejects(loadFirstView("data/", null, { fetch: fakeFetch(site), decodeImage }), (e) => {
    assert.equal(e.file, "team-inputs.json");
    assert.equal(e.field, "(file)");
    assert.match(e.problem, /not valid JSON/);
    return true;
  });
  const other = makeSite().site;
  other["dose.json"] = new TextEncoder().encode("{");
  await assert.rejects(loadFirstView("data/", null, { fetch: fakeFetch(other, { lie: { "dose.json": 1 } }), decodeImage }), (e) => e.file === "dose.json" && !("field" in e));
});

test("an image decode failure rejects with the file name", async () => {
  const { site } = makeSite();
  await assert.rejects(
    loadFirstView("data/", null, { fetch: fakeFetch(site), decodeImage: async () => { throw new Error("bad image"); } }),
    (e) => e.file === "ov.png" && /bad image/.test(e.reason),
  );
});

test("loadTiles loads four tiles or the half-resolution image on request", async () => {
  const { site, scene } = makeSite();
  const got = [];
  await loadTiles(scene, "data/", (name) => got.push(name), { fetch: fakeFetch(site), decodeImage });
  assert.deepEqual(got.sort(), ["core_0_0", "core_0_1", "dem_core", "slope_core"]);
  const half = [];
  await loadTiles(scene, "data/", (name) => half.push(name), { fetch: fakeFetch(site), decodeImage, halfRes: true });
  assert.deepEqual(half.sort(), ["core_half", "dem_core", "slope_core"]);
});

test("loadAll returns everything with combined progress and a core terrain", async () => {
  const { site } = makeSite();
  const seen = [];
  const r = await loadAll("data/", (p) => seen.push(p), { fetch: fakeFetch(site), decodeImage });
  assert.ok(r.terrain.core && r.terrain.slope);
  assert.deepEqual(Object.keys(r.textures).sort(), ["core_0_0", "core_0_1", "overview"]);
  for (const k of ["scene", "waypoints", "conditions", "dose", "sep", "inputs", "sources"]) assert.ok(k in r, k);
  const last = seen[seen.length - 1];
  assert.equal(last.loaded, last.total);
});

test("loadAll rejects when a heavy tile is short", async () => {
  const { site } = makeSite();
  await assert.rejects(loadAll("data/", null, { fetch: fakeFetch(site, { cut: { "t1.png": 1 } }), decodeImage }), (e) => e.file === "t1.png");
});

const mockDir = new URL("../public/data-mock/", import.meta.url);
test("the generated mock scene loads end to end", { skip: !existsSync(new URL("scene.json", mockDir)) }, async () => {
  const f = async (url) => {
    const path = url.startsWith("data-mock/../") ? null : url.replace(/^data-mock\//, "");
    const body = path === null ? Buffer.from("[]") : readFileSync(new URL(path, mockDir));
    return { ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
  };
  const r = await loadAll("data-mock/", null, { fetch: f, decodeImage });
  assert.equal(r.terrain.heightAt(0, 0) > -3700, true);
  assert.ok(r.terrain.slopeAt(0, 0) !== null);
  assert.equal(r.scene.mock, true);
});

test("team-inputs.json is not length-checked against scene.json, other files still are", async () => {
  const { site } = makeSite();
  const edited = { ...inputs, walking_speed_m_s: { ...inputs.walking_speed_m_s, value: 1.2 } };
  site["team-inputs.json"] = enc(edited);
  const scene = JSON.parse(new TextDecoder().decode(site["scene.json"]));
  scene.files["team-inputs.json"] = 7;
  site["scene.json"] = enc(scene);
  const seen = [];
  const r = await loadFirstView("data/", (p) => seen.push(p), { fetch: fakeFetch(site), decodeImage });
  assert.equal(r.inputs.walking_speed_m_s.value, 1.2);
  const last = seen[seen.length - 1];
  assert.equal(last.loaded, last.total);
  await assert.rejects(
    loadFirstView("data/", null, { fetch: fakeFetch(site, { cut: { "dose.json": 1 } }), decodeImage }),
    (e) => e.file === "dose.json",
  );
});

test("a bad team-inputs field rejects with field and problem; inputsFile loads the built-in copy", async () => {
  const { site } = makeSite();
  site["team-inputs.json"] = enc({ ...inputs, stations: undefined });
  site["team-inputs.default.json"] = enc(inputs);
  await assert.rejects(loadFirstView("data/", null, { fetch: fakeFetch(site), decodeImage }), (e) => e.field === "stations" && typeof e.problem === "string" && e.file === "team-inputs.json");
  const f = fakeFetch(site);
  const r = await loadFirstView("data/", null, { fetch: f, decodeImage, inputsFile: "team-inputs.default.json" });
  assert.equal(r.inputs.stations.length, inputs.stations.length);
  assert.ok(!f.requested.includes("team-inputs.json"));
});

function withImagery(site, scene) {
  const names = ["g_ov.png", "g_sur.png", "g_t0.png", "g_t1.png", "g_half.png", "c_sur.png"];
  names.forEach((n, i) => { site[n] = new Uint8Array(10 + i); scene.files[n] = 10 + i; });
  scene.surround.image = "c_sur.png";
  scene.imagery = {
    default: "colour",
    colour: { tiles: scene.core.tiles, half_res: scene.core.half_res, surround: "c_sur.png", overview: scene.overview },
    grey: { tiles: [["g_t0.png", "g_t1.png"]], half_res: "g_half.png", surround: "g_sur.png", overview: "g_ov.png" },
  };
  site["scene.json"] = enc(scene);
  return scene;
}

test("imagery helpers: modes, default, paths, and the no-block fallback", () => {
  const { site, scene } = makeSite();
  assert.deepEqual(imageryModes(scene), []);
  assert.equal(pickImagery(scene, "grey"), null);
  assert.equal(imageryPaths(scene, null).overview, "ov.png");
  withImagery(site, scene);
  assert.deepEqual(imageryModes(scene), ["colour", "grey"]);
  assert.equal(pickImagery(scene, undefined), "colour");
  assert.equal(pickImagery(scene, "grey"), "grey");
  assert.equal(pickImagery(scene, "sepia"), "colour");
  assert.equal(imageryPaths(scene, "grey").tiles[0][1], "g_t1.png");
});

test("loadFirstView and loadTiles follow the imagery option", async () => {
  const { site, scene } = makeSite();
  withImagery(site, scene);
  const f = fakeFetch(site);
  const r = await loadFirstView("data/", null, { fetch: f, decodeImage, imagery: "grey" });
  assert.equal(r.imagery, "grey");
  assert.equal(r.textures.overview.decoded, "g_ov.png");
  const got = [];
  await loadTiles(scene, "data/", (name, p) => got.push(p && p.decoded), { fetch: f, decodeImage, imagery: "grey" });
  assert.ok(got.includes("g_t0.png") && got.includes("g_t1.png"));
  assert.ok(!f.requested.includes("t0.png"));
});

test("loadImagery delivers overview and surround before the tiles, honours halfRes and isCurrent", async () => {
  const { site, scene } = makeSite();
  withImagery(site, scene);
  const order = [];
  const progress = [];
  await loadImagery(scene, "data/", "grey", (n) => order.push(n), { fetch: fakeFetch(site), decodeImage, onProgress: (p) => progress.push(p) });
  assert.deepEqual(order.slice(0, 2).sort(), ["overview", "surround"]);
  assert.deepEqual(order.slice(2).sort(), ["core_0_0", "core_0_1"]);
  const last = progress[progress.length - 1];
  assert.equal(last.loaded, last.total);
  const half = [];
  await loadImagery(scene, "data/", "grey", (n) => half.push(n), { fetch: fakeFetch(site), decodeImage, halfRes: true });
  assert.deepEqual(half.slice(2), ["core_half"]);
  const f = fakeFetch(site);
  const stale = [];
  let current = true;
  await loadImagery(scene, "data/", "grey", (n) => { stale.push(n); current = false; }, { fetch: f, decodeImage, isCurrent: () => current });
  assert.ok(!f.requested.includes("g_t0.png"));
  await assert.rejects(loadImagery(scene, "data/", "grey", () => {}, { fetch: fakeFetch(site, { cut: { "g_t1.png": 1 } }), decodeImage }), (e) => e.file === "g_t1.png");
});
