// AI-written (Claude, Anthropic) for the team's NASA Space Apps 2026 project.
// Sample positions follow plan amendment A4: row 0 is north, column 0 is west, DEM samples sit on the grid corners,
// slope cells sit between them.

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export function toUint16(buffer, expected, name) {
  if (buffer.byteLength !== expected * 2) {
    throw new Error(`${name}: expected ${expected * 2} bytes, got ${buffer.byteLength}`);
  }
  const arr = new Uint16Array(buffer);
  if (!LITTLE_ENDIAN) {
    for (let i = 0; i < arr.length; i++) arr[i] = ((arr[i] & 0xff) << 8) | (arr[i] >> 8);
  }
  return arr;
}

export function toUint8(buffer, expected, name) {
  if (buffer.byteLength !== expected) {
    throw new Error(`${name}: expected ${expected} bytes, got ${buffer.byteLength}`);
  }
  return new Uint8Array(buffer);
}

function bilinear(grid, n, half, step, nodata, offset, scaleM, x, y) {
  if (!(Math.abs(x) <= half && Math.abs(y) <= half)) return null;
  const fx = (x + half) / step;
  const fy = (half - y) / step;
  const i0 = Math.min(Math.floor(fx), n - 2);
  const j0 = Math.min(Math.floor(fy), n - 2);
  const tx = fx - i0;
  const ty = fy - j0;
  const a = grid[j0 * n + i0];
  const b = grid[j0 * n + i0 + 1];
  const c = grid[(j0 + 1) * n + i0];
  const d = grid[(j0 + 1) * n + i0 + 1];
  if (a === nodata || b === nodata || c === nodata || d === nodata) return null;
  const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  return offset + v * scaleM;
}

// core, surround and slope are typed arrays; core and slope may be null until the second load stage finishes.
export function createTerrain(scene, { core = null, surround = null, slope = null } = {}) {
  const h = scene.height;
  const cn = scene.core.dem_samples;
  const chalf = scene.core.size_m / 2;
  const cstep = scene.core.size_m / (cn - 1);
  const sn = scene.surround.dem_samples;
  const shalf = scene.surround.size_m / 2;
  const sstep = scene.surround.size_m / (sn - 1);
  const cells = scene.core.slope_cells;
  const cellM = scene.core.size_m / cells;

  const terrain = {
    core,
    surround,
    slope,
    setCore(coreArr, slopeArr) {
      terrain.core = coreArr;
      terrain.slope = slopeArr;
    },
    heightAt(x, y) {
      if (terrain.core && Math.abs(x) <= chalf && Math.abs(y) <= chalf) {
        return bilinear(terrain.core, cn, chalf, cstep, h.nodata, h.offset_m, h.scale_m, x, y);
      }
      if (!terrain.surround) return null;
      return bilinear(terrain.surround, sn, shalf, sstep, h.nodata, h.offset_m, h.scale_m, x, y);
    },
    slopeAt(x, y) {
      if (!terrain.slope || !(Math.abs(x) <= chalf && Math.abs(y) <= chalf)) return null;
      const i = Math.min(Math.floor((x + chalf) / cellM), cells - 1);
      const j = Math.min(Math.floor((chalf - y) / cellM), cells - 1);
      const v = terrain.slope[j * cells + i];
      if (v === scene.slope.nodata) return null;
      return v * scene.slope.scale_deg;
    },
  };
  return terrain;
}

// fetchBin(path) resolves to an ArrayBuffer.
export async function loadTerrain(scene, fetchBin) {
  const [core, surround, slope] = await Promise.all([
    fetchBin(scene.core.dem),
    fetchBin(scene.surround.dem),
    fetchBin(scene.core.slope),
  ]);
  return createTerrain(scene, {
    core: toUint16(core, scene.core.dem_samples ** 2, scene.core.dem),
    surround: toUint16(surround, scene.surround.dem_samples ** 2, scene.surround.dem),
    slope: toUint8(slope, scene.core.slope_cells ** 2, scene.core.slope),
  });
}
