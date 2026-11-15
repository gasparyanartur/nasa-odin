import raw from '../../public/boxwork/full/manifest.json';

export type ImageryMode = 'colour' | 'grey';
export type ImagerySourceId = 'full-tiles' | 'core-half' | 'ortho';

export interface Extent { west: number; east: number; south: number; north: number }

export interface TileRef { url: string; widthPx: number; heightPx: number; bytes: number; sha256: string }

export interface FullManifest {
  id: string;
  datasetId: string;
  frame: { groundScaleX: number; origin: { longitude: number; latitude: number }; radiusM: number; rule: string };
  extentTeamM: Extent;
  teamAreaM: Extent;
  imagery: {
    pixelSizeM: { east: number; north: number };
    tileGrid: { rows: number; cols: number; tilePx: number; tileSizeTeamM: { east: number; north: number } };
    files: Record<string, TileRef>;
  };
  height: { url: string; rows: number; cols: number; stepTeamM: { east: number; north: number }; noDataCount: number; bytes: number; min: number; max: number };
  checks: { teamNodeMaxAbsDiffM: number; fiveMetreDeviationMaxM: number; fiveMetreDeviationP99M: number };
}

export const FULL = raw as FullManifest;

export interface Tile { row: number; col: number; extent: Extent; url: Record<ImageryMode, string> }

export function tileExtent(row: number, col: number, m: FullManifest = FULL): Extent {
  const { east, north } = m.imagery.tileGrid.tileSizeTeamM;
  const west = m.extentTeamM.west + col * east;
  const top = m.extentTeamM.north - row * north;
  return { west, east: west + east, north: top, south: top - north };
}

export function tiles(m: FullManifest = FULL): Tile[] {
  const out: Tile[] = [];
  for (let row = 0; row < m.imagery.tileGrid.rows; row++)
    for (let col = 0; col < m.imagery.tileGrid.cols; col++)
      out.push({ row, col, extent: tileExtent(row, col, m), url: { colour: m.imagery.files[`colour_${row}_${col}`].url, grey: m.imagery.files[`grey_${row}_${col}`].url } });
  return out;
}

export function inside(e: Extent, xEast: number, yNorth: number): boolean {
  return Number.isFinite(xEast) && Number.isFinite(yNorth) && xEast >= e.west && xEast <= e.east && yNorth >= e.south && yNorth <= e.north;
}

// Tiles are half-open (west and north edges inclusive); the outer east and south edges belong to the last tile.
export function tileFor(xEast: number, yNorth: number, m: FullManifest = FULL): Tile | null {
  if (!inside(m.extentTeamM, xEast, yNorth)) return null;
  const { rows, cols, tileSizeTeamM } = m.imagery.tileGrid;
  const col = Math.min(cols - 1, Math.floor((xEast - m.extentTeamM.west) / tileSizeTeamM.east));
  const row = Math.min(rows - 1, Math.floor((m.extentTeamM.north - yNorth) / tileSizeTeamM.north));
  return tiles(m)[row * cols + col];
}

export interface HeightGrid { rows: number; cols: number; extent: Extent; values: Float32Array }

export function heightGrid(buffer: ArrayBuffer, m: FullManifest = FULL): HeightGrid {
  const { rows, cols } = m.height;
  if (buffer.byteLength !== rows * cols * 4) throw new Error(`Full Boxwork height grid: expected ${rows * cols * 4} bytes, got ${buffer.byteLength}.`);
  return { rows, cols, extent: m.extentTeamM, values: new Float32Array(buffer) };
}

export async function loadHeightGrid(signal?: AbortSignal, m: FullManifest = FULL): Promise<HeightGrid> {
  const r = await fetch(m.height.url, { signal });
  if (!r.ok) throw new Error(`Full Boxwork height grid could not load (${m.height.url}).`);
  return heightGrid(await r.arrayBuffer(), m);
}

// Bilinear on the 1 m samples (samples on the grid corners). Returns null outside the grid or next to a no-data sample.
export function heightAt(g: HeightGrid, xEast: number, yNorth: number): number | null {
  if (!inside(g.extent, xEast, yNorth)) return null;
  const fx = (xEast - g.extent.west) / (g.extent.east - g.extent.west) * (g.cols - 1);
  const fy = (g.extent.north - yNorth) / (g.extent.north - g.extent.south) * (g.rows - 1);
  const c = Math.min(Math.floor(fx), g.cols - 2), r = Math.min(Math.floor(fy), g.rows - 2);
  const tx = fx - c, ty = fy - r, v = g.values, n = g.cols;
  const a = v[r * n + c], b = v[r * n + c + 1], d = v[(r + 1) * n + c], e = v[(r + 1) * n + c + 1];
  if (!Number.isFinite(a + b + d + e)) return null;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
}

export interface ImagerySource { id: ImagerySourceId; urls: string[]; extent: Extent; metresPerPixel: number }

export interface LoadedImagery { tiles?: Partial<Record<string, boolean>>; half?: boolean }

// The fallback is the team's 1600 px ortho over the 1000 m team area (scripts/prepare_boxwork.py).
export const ORTHO_PX = 1600;

export function pickImagerySource(loaded: LoadedImagery, mode: ImageryMode = 'colour', m: FullManifest = FULL): ImagerySource {
  const quarter = tiles(m);
  if (quarter.every(t => loaded.tiles?.[`${mode}_${t.row}_${t.col}`]))
    return { id: 'full-tiles', urls: quarter.map(t => t.url[mode]), extent: m.extentTeamM, metresPerPixel: m.imagery.pixelSizeM.north };
  const half = m.imagery.files[`${mode}_half`];
  if (loaded.half && half)
    return { id: 'core-half', urls: [half.url], extent: m.extentTeamM, metresPerPixel: (m.extentTeamM.north - m.extentTeamM.south) / half.heightPx };
  return { id: 'ortho', urls: [mode === 'grey' ? '/boxwork/ortho-grey.jpg' : '/boxwork/ortho.jpg'], extent: m.teamAreaM, metresPerPixel: (m.teamAreaM.north - m.teamAreaM.south) / ORTHO_PX };
}
