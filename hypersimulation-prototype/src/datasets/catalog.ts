import viking from '../../public/datasets/viking.json';
import mola from '../../public/datasets/mola.json';
import ctx from '../../public/datasets/ctx.json';
import gale from '../../public/gale/manifest.json';
import boxwork from '../../public/boxwork/manifest.json';
import { parseDataset, type DatasetDefinition } from './definition';

export const BASEMAPS: DatasetDefinition[] = [parseDataset(viking), parseDataset(mola), parseDataset(ctx)];
export type RegionId = 'gale-bradbury' | 'gale-boxwork' | 'jezero';
export interface Region {
  id: RegionId;
  name: string;
  shortName: string;
  description: string;
  center: { longitude: number; latitude: number };
  cameraHeightM: number;
  sourceUrl: string;
  locationNote: string;
  basemapIds: string[];
  capabilities: { plan: boolean; walk: boolean };
  terrain?: { datasetId: string; baseUrl: string; bounds: [number, number, number, number]; outlineHeightM: number };
}

export const REGIONS: Region[] = [
  {
    id: 'gale-bradbury', name: 'Gale · Bradbury landing area', shortName: 'Gale · Bradbury',
    description: 'Explore Curiosity’s landing area, inspect measured terrain, and plan a local excursion on foot.',
    center: gale.origin, cameraHeightM: 4200,
    sourceUrl: gale.sources[0].catalog,
    locationNote: 'Center and 2 × 2 km prepared footprint from the USGS Gale terrain package. The footprint is the planning boundary, not all of Gale crater.',
    basemapIds: BASEMAPS.map(b => b.id), capabilities: { plan: true, walk: true },
    terrain: { datasetId: gale.id, baseUrl: '/gale', bounds: gale.bounds as [number, number, number, number], outlineHeightM: gale.maxElevationM - gale.referenceElevationM + 2 },
  },
  {
    id: 'jezero', name: 'Jezero · Perseverance landing area', shortName: 'Jezero',
    description: 'Explore the orbital context around Perseverance’s landing site and Jezero’s ancient lake and delta setting.',
    center: { longitude: 77.4509, latitude: 18.4446 }, cameraHeightM: 65000,
    sourceUrl: 'https://ntrs.nasa.gov/citations/20230016428',
    locationNote: 'Marker: Perseverance landing coordinates reported by Bell et al. (2022), 18.4446° N, 77.4509° E. Camera framing is illustrative, not a prepared-data footprint.',
    basemapIds: BASEMAPS.map(b => b.id), capabilities: { plan: false, walk: false },
  },
  {
    id: 'gale-boxwork', name: 'Gale · Mount Sharp Boxwork', shortName: 'Gale · Boxwork',
    description: 'Explore the boxwork ridges with detailed terrain and colour orbital imagery.',
    center: boxwork.origin, cameraHeightM: 3200, sourceUrl: boxwork.sources[0].catalog,
    locationNote: 'A separate Mount Sharp site. 1 km analytical footprint; 1 m core height posts and 0.25 m imagery. The surround is display context only.',
    basemapIds: BASEMAPS.map(b=>b.id), capabilities: {plan:true,walk:true},
    terrain: {datasetId:boxwork.id,baseUrl:'/boxwork',bounds:boxwork.bounds as [number,number,number,number],outlineHeightM:boxwork.maxElevationM-boxwork.referenceElevationM+2},
  },

];

export type OverlayId = 'imagery' | 'elevation' | 'slope';
export interface OverlayState { visible: boolean; opacity: number }
export type OverlaySettings = Record<OverlayId, OverlayState>;
export const OVERLAYS: { id: OverlayId; name: string; file: string; legend: string }[] = [
  { id: 'imagery', name: 'Orbital imagery', file: 'ortho.jpg', legend: 'USGS orthophoto mosaic · grayscale · 0.25 m source posts, prepared for display.' },
  { id: 'elevation', name: 'Elevation', file: 'elevation.png', legend: `Teal low → rust high · ${gale.minElevationM.toFixed(1)} to ${gale.maxElevationM.toFixed(1)} m · source areoid elevations.` },
  { id: 'slope', name: 'Slope', file: 'slope.png', legend: 'Teal 0° → rust 30° · maximum native gradient per 5 m cell · steeper values saturate.' },
];
export function defaultOverlays(): OverlaySettings {
  return { imagery: { visible: true, opacity: 1 }, elevation: { visible: false, opacity: .65 }, slope: { visible: false, opacity: .65 } };
}
export function getRegion(id?: RegionId): Region | undefined { return REGIONS.find(r => r.id === id); }
export function canPlan(region?: Region): boolean { return Boolean(region?.capabilities.plan && region.terrain); }
