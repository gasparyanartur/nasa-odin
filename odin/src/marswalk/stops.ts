import raw from '../../public/marswalk/stops.json';
import type { Point } from '../mission/data';
import type { FrameLink } from './frame';

export type Origin = 'source' | 'assumption' | 'scenario';
export const HELMET_WORD_LIMIT = 6;

export interface ScienceStop extends Point {
  id: number;
  marswalk: Point;
  kind: 'ridge' | 'hollow';
  onPath: boolean;
  reliefM: number;
  reliefNote: string;
  task: string;
  short: string;
  origin: Origin;
  originNote: string;
}

export interface DrillSite {
  name: string;
  x: number | null;
  y: number | null;
  marswalk: Point | null;
  sol: number | null;
  kind: string;
  reported: string;
  sourceUrl: string;
  positionNote: string;
  origin: Origin;
}

export interface CrewRover extends Point {
  marswalk: Point;
  label: string;
  origin: Origin;
  originNote: string;
}

export interface StopsPackage {
  schema: 'marswalk-stops';
  version: 1;
  frame: FrameLink;
  source: string;
  scienceGoal: string;
  base: CrewRover;
  stops: ScienceStop[];
  drillSites: DrillSite[];
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function parseStops(input: unknown): StopsPackage {
  const p = input as StopsPackage;
  if (!p || p.schema !== 'marswalk-stops' || p.version !== 1) throw new Error('Not a Marswalk stops package (schema marswalk-stops, version 1).');
  if (p.frame?.datasetId !== 'gale-boxwork-v1') throw new Error('Marswalk stops must be in the gale-boxwork-v1 frame.');
  const ids = new Set<number>();
  for (const s of p.stops) {
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) throw new Error(`Stop ${s.id} has no position.`);
    if (ids.has(s.id)) throw new Error(`Duplicate stop ${s.id}.`);
    ids.add(s.id);
    if (!s.task.trim() || !s.short.trim()) throw new Error(`Stop ${s.id} needs a task and a short helmet text.`);
    if (words(s.short) > HELMET_WORD_LIMIT) throw new Error(`Stop ${s.id}: helmet text is longer than ${HELMET_WORD_LIMIT} words.`);
  }
  for (const d of p.drillSites) if ((d.x === null) !== (d.y === null)) throw new Error(`Drill site ${d.name} has half a position.`);
  return p;
}

export const MARSWALK_STOPS: StopsPackage = parseStops(raw);
export const STOPS: ScienceStop[] = MARSWALK_STOPS.stops;
export const CREW_ROVER: CrewRover = MARSWALK_STOPS.base;
export const DRILL_SITES: DrillSite[] = MARSWALK_STOPS.drillSites;

export const stopById = (id: number) => STOPS.find(s => s.id === id);
export const placedDrillSites = () => DRILL_SITES.filter((d): d is DrillSite & Point => d.x !== null && d.y !== null);
export const helmetLine = (stop: ScienceStop, index: number, total: number) => `Stop ${index + 1} of ${total}. ${stop.short}`;
