// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Every rejection is a plain object {file, status, reason}. Lengths are checked against scene.json "files" (plan A6).
import { createTerrain, toUint16, toUint8 } from "./terrain.js";
import { validateInputs } from "./inputs.js";

const SMALL_JSON = {
  waypoints: "waypoints.json",
  conditions: "conditions.json",
  dose: "dose.json",
  sep: "sep-event.json",
  inputs: "team-inputs.json",
};

// Hand-edited by people, so its length is never checked against scene.json (validateInputs checks the content).
const EDITED_FILES = new Set(["team-inputs.json"]);

// Image sets. scene.imagery = {default, <mode>: {tiles, half_res, surround, overview, ...}}. Without that block the
// scene's own overview, surround image and core tiles are the only set.
export function imageryModes(scene) {
  const im = scene && scene.imagery;
  if (!im || typeof im !== "object") return [];
  return Object.keys(im).filter((k) => k !== "default" && im[k] && typeof im[k] === "object");
}

export function pickImagery(scene, wanted) {
  const modes = imageryModes(scene);
  if (!modes.length) return null;
  if (modes.includes(wanted)) return wanted;
  return modes.includes(scene.imagery.default) ? scene.imagery.default : modes[0];
}

export function imageryPaths(scene, mode) {
  const set = mode && scene.imagery && scene.imagery[mode];
  return {
    overview: (set && set.overview) || scene.overview,
    surround: (set && set.surround) || scene.surround.image,
    half_res: (set && set.half_res) || scene.core.half_res,
    tiles: (set && set.tiles) || scene.core.tiles,
  };
}

const join = (base, path) => (base.endsWith("/") ? base : base + "/") + path;
const reject = (file, status, reason) => Promise.reject({ file, status, reason });

function defaultDecode(buffer) {
  if (typeof createImageBitmap !== "function") throw new Error("createImageBitmap is not available");
  return createImageBitmap(new Blob([buffer]));
}

async function readBody(res, onChunk) {
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;
  if (!reader) {
    const buf = await res.arrayBuffer();
    onChunk(buf.byteLength);
    return buf;
  }
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.byteLength;
    onChunk(value.byteLength);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out.buffer;
}

// expected: byte length from scene.json "files", or undefined when the file is not listed there.
async function fetchFile(ctx, path, expected, onChunk) {
  let res;
  try {
    res = await ctx.fetch(join(ctx.base, path));
  } catch (err) {
    return reject(path, 0, `network error: ${err && err.message ? err.message : err}`);
  }
  if (!res.ok) return reject(path, res.status, `HTTP ${res.status}`);
  let buf;
  try {
    buf = await readBody(res, onChunk);
  } catch (err) {
    return reject(path, res.status, `body read failed: ${err && err.message ? err.message : err}`);
  }
  const header = res.headers && res.headers.get ? res.headers.get("content-length") : null;
  const declared = header === null || header === undefined ? NaN : Number(header);
  const encoded = res.headers && res.headers.get && res.headers.get("content-encoding");
  const want = expected ?? (!encoded && Number.isFinite(declared) ? declared : undefined);
  if (want !== undefined && buf.byteLength !== want) {
    return reject(path, res.status, `length ${buf.byteLength} bytes, expected ${want}`);
  }
  return buf;
}

function typed(fn, file) {
  try {
    return fn();
  } catch (err) {
    return reject(file, 200, err.message);
  }
}

function parseJson(buf, file) {
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return reject(file, 200, "not valid JSON");
  }
}

function makeProgress(onProgress) {
  const st = { loaded: 0, total: 0 };
  const emit = (file) => onProgress && onProgress({ loaded: st.loaded, total: st.total, file });
  return { st, emit };
}

function settings(opts = {}) {
  return {
    fetch: opts.fetch || ((url) => globalThis.fetch(url)),
    decodeImage: opts.decodeImage || defaultDecode,
  };
}

export async function loadFirstView(base, onProgress, opts = {}) {
  const ctx = { base, ...settings(opts) };
  const { st, emit } = makeProgress(onProgress);
  const small = { ...SMALL_JSON, inputs: opts.inputsFile || SMALL_JSON.inputs };

  const sceneBuf = await fetchFile(ctx, "scene.json", undefined, (n) => {
    st.loaded += n;
    emit("scene.json");
  });
  const scene = await parseJson(sceneBuf, "scene.json");
  const files = scene.files || {};
  const imagery = pickImagery(scene, opts.imagery);
  const overviewPath = imageryPaths(scene, imagery).overview;

  const names = [overviewPath, scene.surround.dem, ...Object.values(small)];
  const sourcesUrl = opts.sourcesPath || "../sources.json";
  const sizeOf = (p) => (files[p] === undefined ? 0 : files[p]);
  st.total = sceneBuf.byteLength + names.reduce((a, p) => a + sizeOf(p), 0);
  emit("scene.json");

  const get = async (path, expected) => {
    const edited = EDITED_FILES.has(path);
    const buf = await fetchFile(ctx, path, edited ? undefined : expected, (n) => {
      st.loaded += n;
      if (expected === undefined || edited) st.total += n;
      emit(path);
    });
    // The listed size was already in the total; the real size of an edited file replaces it.
    if (edited && expected !== undefined) {
      st.total -= expected;
      emit(path);
    }
    return buf;
  };

  const [overviewBuf, surroundBuf, ...jsonBufs] = await Promise.all([
    get(overviewPath, files[overviewPath]),
    get(scene.surround.dem, files[scene.surround.dem]),
    ...Object.values(small).map((p) => get(p, files[p])),
    get(sourcesUrl, undefined),
  ]);
  const keys = Object.keys(small);
  const data = {};
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] === "inputs") {
      // A hand edit that breaks the JSON is an input error: the screen offers the committed copy, not only a retry.
      data.inputs = await Promise.resolve(parseJson(jsonBufs[i], small.inputs)).catch((e) =>
        Promise.reject({ ...e, field: "(file)", problem: "is not valid JSON" }),
      );
    } else data[keys[i]] = await parseJson(jsonBufs[i], small[keys[i]]);
  }
  data.sources = await parseJson(jsonBufs[keys.length], sourcesUrl);

  const checked = validateInputs(data.inputs);
  if (!checked.ok) {
    return Promise.reject({
      file: small.inputs, status: 200, field: checked.field, problem: checked.problem,
      reason: `bad field ${checked.field}: ${checked.problem}`,
    });
  }
  data.inputs = checked.inputs;

  let overview;
  try {
    overview = await ctx.decodeImage(overviewBuf, overviewPath);
  } catch (err) {
    return reject(overviewPath, 200, `image decode failed: ${err && err.message ? err.message : err}`);
  }

  const surround = await typed(
    () => toUint16(surroundBuf, scene.surround.dem_samples ** 2, scene.surround.dem),
    scene.surround.dem,
  );
  const terrain = createTerrain(scene, { surround });
  return { scene, terrain, textures: { overview }, imagery, ...data, progress: { loaded: st.loaded, total: st.total } };
}

// Second stage: core DEM, slope and the image tiles (or core_half). onTile(name, payload) fires per file:
// "dem_core" and "slope_core" give an ArrayBuffer, tile names ("core_0_1", "core_half") give a decoded image.
export async function loadTiles(scene, base, onTile, opts = {}) {
  const ctx = { base, ...settings(opts) };
  const files = scene.files || {};
  const { st, emit } = makeProgress(opts.onProgress);
  const jobs = [
    { name: "dem_core", path: scene.core.dem, image: false },
    { name: "slope_core", path: scene.core.slope, image: false },
  ];
  const paths = imageryPaths(scene, pickImagery(scene, opts.imagery));
  if (opts.halfRes) {
    jobs.push({ name: "core_half", path: paths.half_res, image: true });
  } else {
    paths.tiles.forEach((row, r) =>
      row.forEach((path, c) => jobs.push({ name: `core_${r}_${c}`, path, image: true })),
    );
  }
  st.total = jobs.reduce((a, j) => a + (files[j.path] || 0), 0);
  const out = {};
  await Promise.all(
    jobs.map(async (j) => {
      const buf = await fetchFile(ctx, j.path, files[j.path], (n) => {
        st.loaded += n;
        emit(j.path);
      });
      let payload = buf;
      if (j.image) {
        try {
          payload = await ctx.decodeImage(buf, j.path);
        } catch (err) {
          return reject(j.path, 200, `image decode failed: ${err && err.message ? err.message : err}`);
        }
      }
      out[j.name] = payload;
      if (onTile) onTile(j.name, payload);
    }),
  );
  return out;
}

// One image set. onImage(name, bitmap) fires per file: "overview" and "surround" first, then the core tiles
// ("core_r_c") or "core_half" when opts.halfRes is set. opts.parts picks a subset of ["overview", "surround",
// "tiles"]. opts.isCurrent() returning false stops the run before the tile stage (a newer switch took over).
export async function loadImagery(scene, base, mode, onImage, opts = {}) {
  const ctx = { base, ...settings(opts) };
  const files = scene.files || {};
  const { st, emit } = makeProgress(opts.onProgress);
  const paths = imageryPaths(scene, mode);
  const parts = opts.parts || ["overview", "surround", "tiles"];
  const first = [];
  if (parts.includes("overview")) first.push({ name: "overview", path: paths.overview });
  if (parts.includes("surround")) first.push({ name: "surround", path: paths.surround });
  const second = [];
  if (parts.includes("tiles")) {
    if (opts.halfRes) second.push({ name: "core_half", path: paths.half_res });
    else paths.tiles.forEach((row, r) => row.forEach((path, c) => second.push({ name: `core_${r}_${c}`, path })));
  }
  st.total = [...first, ...second].reduce((a, j) => a + (files[j.path] || 0), 0);
  const out = {};
  const run = (jobs) =>
    Promise.all(
      jobs.map(async (j) => {
        const buf = await fetchFile(ctx, j.path, files[j.path], (n) => {
          st.loaded += n;
          emit(j.path);
        });
        let bitmap;
        try {
          bitmap = await ctx.decodeImage(buf, j.path);
        } catch (err) {
          return reject(j.path, 200, `image decode failed: ${err && err.message ? err.message : err}`);
        }
        out[j.name] = bitmap;
        if (!opts.isCurrent || opts.isCurrent()) onImage(j.name, bitmap);
      }),
    );
  await run(first);
  if (opts.isCurrent && !opts.isCurrent()) return out;
  await run(second);
  return out;
}

export async function loadAll(base, onProgress, opts = {}) {
  const first = await loadFirstView(base, onProgress, opts);
  const { scene, terrain } = first;
  const textures = { ...first.textures };
  const baseLoaded = first.progress.loaded;
  const baseTotal = first.progress.total;
  const tiles = await loadTiles(
    scene,
    base,
    (name, payload) => {
      if (name !== "dem_core" && name !== "slope_core") textures[name] = payload;
      if (opts.onTile) opts.onTile(name, payload);
    },
    {
      ...opts,
      onProgress: (p) =>
        onProgress &&
        onProgress({ loaded: baseLoaded + p.loaded, total: baseTotal + p.total, file: p.file }),
    },
  );
  terrain.setCore(
    await typed(() => toUint16(tiles.dem_core, scene.core.dem_samples ** 2, scene.core.dem), scene.core.dem),
    await typed(() => toUint8(tiles.slope_core, scene.core.slope_cells ** 2, scene.core.slope), scene.core.slope),
  );
  const { progress, ...rest } = first;
  return { ...rest, terrain, textures };
}
