import { useEffect, useRef, useState } from 'react';
import type { Point } from '../mission/data';
import type { MapViewport } from '../mission/mapViewport';
import { FULL, tiles, type Extent, type ImageryMode } from './fullData';

/**
 * Zoom steps for the Boxwork map (FULLDATA-WIRING.md, recommendation for built-in graphics): the 1600 px team image
 * up to zoom 2, the 0.5 m core image above 2, and above 4 only the 0.25 m tiles the view touches.
 */
export const HALF_ZOOM = 2;
export const TILE_ZOOM = 4;

/** The team-frame metres a viewport shows; the canvas is the team square, extentM across at zoom 1. */
export function viewExtent(v: MapViewport, extentM: number): Extent {
  const half = extentM / 2;
  return {
    west: (0 - v.x) / v.zoom * extentM - half, east: (1 - v.x) / v.zoom * extentM - half,
    north: half - (0 - v.y) / v.zoom * extentM, south: half - (1 - v.y) / v.zoom * extentM,
  };
}

export const overlaps = (a: Extent, b: Extent) => a.west < b.east && b.west < a.east && a.south < b.north && b.south < a.north;

export interface SharpSource { key: string; url: string; extent: Extent }

/** The images a view needs beyond the team image: none, the half-resolution core, or the tiles under the view. */
export function sharpSources(v: MapViewport, extentM: number, mode: ImageryMode, tileZoom = TILE_ZOOM): SharpSource[] {
  if (v.zoom > tileZoom) {
    const view = viewExtent(v, extentM);
    return tiles().filter(t => overlaps(t.extent, view)).map(t => ({ key: `${mode}_${t.row}_${t.col}`, url: t.url[mode], extent: t.extent }));
  }
  if (v.zoom > HALF_ZOOM) {
    const half = FULL.imagery.files[`${mode}_half`];
    return half ? [{ key: `${mode}_half`, url: half.url, extent: FULL.extentTeamM }] : [];
  }
  return [];
}

/** A north-up window of widthM metres centred on a point. */
export function followViewport(center: Point, widthM: number, extentM: number): MapViewport {
  const zoom = extentM / widthM;
  return { zoom, x: .5 - zoom * (center.x + extentM / 2) / extentM, y: .5 - zoom * (extentM / 2 - center.y) / extentM };
}

export const FOLLOW_MIN_M = 200;
// Wider than this the round window stops being a close view; a point beyond it gets an edge mark instead.
export const FOLLOW_MAX_M = 300;
/** The minimap window is at most FOLLOW_MAX_M across, so it always draws from the tiles it touches. */
export const FOLLOW_TILE_ZOOM = 1000 / FOLLOW_MAX_M - .01;
export const FOLLOW_STEP_M = 50;
// Room around a kept point inside the round window, so its mark is not cut by the edge.
export const FOLLOW_MARGIN_M = 20;

/** Window width for the round helmet minimap: FOLLOW_MIN_M to FOLLOW_MAX_M, as wide as needed to keep the given points inside the circle. */
export function followWidth(center: Point, keep: Point[], extentM: number): number {
  const d = Math.max(0, ...keep.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => Math.hypot(p.x - center.x, p.y - center.y)));
  const need = Math.ceil((2 * (d + FOLLOW_MARGIN_M)) / FOLLOW_STEP_M) * FOLLOW_STEP_M;
  return Math.min(extentM, FOLLOW_MAX_M, Math.max(FOLLOW_MIN_M, need));
}

export interface LoadedSharp { key: string; img: HTMLImageElement; extent: Extent }

/**
 * Loads only the sources the current view needs and lets go of the rest, so no more than the visible tiles are held.
 * Returns the loaded images in draw order.
 */
export function useSharpImagery(enabled: boolean, mode: ImageryMode, view: MapViewport, extentM: number, tileZoom = TILE_ZOOM): LoadedSharp[] {
  const wanted = enabled ? sharpSources(view, extentM, mode, tileZoom) : [];
  const key = wanted.map(w => w.key).join(',');
  const have = useRef(new Map<string, LoadedSharp>());
  const [loaded, setLoaded] = useState<LoadedSharp[]>([]);
  useEffect(() => {
    const keep = new Set(wanted.map(w => w.key)), held = have.current;
    for (const k of [...held.keys()]) if (!keep.has(k)) held.delete(k);
    const publish = () => setLoaded([...held.values()].sort((a, b) => a.key.localeCompare(b.key)));
    publish();
    let active = true;
    const pending: HTMLImageElement[] = [];
    for (const w of wanted) {
      if (held.has(w.key)) continue;
      const img = new Image();
      pending.push(img);
      img.onload = () => { if (!active) return; held.set(w.key, { key: w.key, img, extent: w.extent }); publish(); };
      img.src = w.url;
    }
    return () => { active = false; for (const img of pending) { img.onload = null; if (!img.complete) img.src = ''; } };
  }, [key]);
  return loaded;
}
