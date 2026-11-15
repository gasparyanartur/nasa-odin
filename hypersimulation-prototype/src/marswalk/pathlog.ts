import raw from '../../public/marswalk/curiosity-path.json';
import type { Point } from '../mission/data';
import { distance, distanceToPolyline, type FrameLink } from './frame';

export type WalkRegion = 'gale-bradbury' | 'gale-boxwork';
export const WALKS_KEY = 'martian-map.marswalk-walks.v1';

export interface PathSample extends Point { elapsedS: number }

export interface Walk {
  id: string;
  regionId: WalkRegion;
  label: string;
  startedAt: string;
  endedAt: string | null;
  samples: PathSample[];
}

export interface WalkStore {
  load(): Walk[];
  save(walks: Walk[]): boolean;
  readonly persistent: boolean;
}

export interface CuriosityPath { schema: 'marswalk-curiosity-path'; version: 1; frame: FrameLink; source: string; sols: [number, number]; count: number; points: (Point & { sol: number; lon: number; lat: number; marswalk: Point })[] }

export const CURIOSITY_PATH = raw as unknown as CuriosityPath;
export const curiosityLine = (): Point[] => CURIOSITY_PATH.points.map(({ x, y }) => ({ x, y }));

export function startWalk(id: string, regionId: WalkRegion, label: string, nowIso: string): Walk {
  return { id, regionId, label, startedAt: nowIso, endedAt: null, samples: [] };
}

export function appendSample(walk: Walk, sample: PathSample): Walk {
  if (walk.endedAt !== null || ![sample.x, sample.y, sample.elapsedS].every(Number.isFinite)) return walk;
  const last = walk.samples[walk.samples.length - 1];
  if (last && sample.elapsedS < last.elapsedS) return walk;
  if (last && last.x === sample.x && last.y === sample.y) return walk;
  return { ...walk, samples: [...walk.samples, { x: sample.x, y: sample.y, elapsedS: sample.elapsedS }] };
}

export function closeWalk(walk: Walk, nowIso: string): Walk {
  return walk.endedAt === null ? { ...walk, endedAt: nowIso } : walk;
}

export function walkLengthM(walk: Pick<Walk, 'samples'>): number {
  let total = 0;
  for (let i = 1; i < walk.samples.length; i++) total += distance(walk.samples[i - 1], walk.samples[i]);
  return total;
}

export interface Separation { samples: number; maxM: number | null; meanM: number | null }

export function compareWithReference(path: Point[], reference: Point[]): Separation {
  const d = path.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => distanceToPolyline(p, reference)).filter(Number.isFinite);
  if (!d.length) return { samples: 0, maxM: null, meanM: null };
  return { samples: d.length, maxM: Math.max(...d), meanM: d.reduce((a, b) => a + b, 0) / d.length };
}

function validWalk(v: unknown): v is Walk {
  const w = v as Walk;
  return !!w && typeof w.id === 'string' && (w.regionId === 'gale-bradbury' || w.regionId === 'gale-boxwork') && typeof w.label === 'string'
    && typeof w.startedAt === 'string' && (w.endedAt === null || typeof w.endedAt === 'string') && Array.isArray(w.samples)
    && w.samples.every(s => !!s && [s.x, s.y, s.elapsedS].every(Number.isFinite));
}

export function memoryStore(initial: Walk[] = []): WalkStore {
  let walks = [...initial];
  return { persistent: false, load: () => [...walks], save: next => { walks = [...next]; return true; } };
}

// Private browsing and blocked cookies throw on the localStorage getter itself, not only on setItem.
export function localStore(getStorage: () => Storage | null | undefined = () => globalThis.localStorage, key = WALKS_KEY): WalkStore {
  let storage: Storage | null = null;
  try { storage = getStorage() ?? null; } catch { storage = null; }
  const fallback = memoryStore();
  if (!storage) return fallback;
  const s = storage;
  let broken = false;
  return {
    get persistent() { return !broken; },
    load() {
      if (broken) return fallback.load();
      try { const parsed: unknown = JSON.parse(s.getItem(key) ?? '[]'); return Array.isArray(parsed) ? parsed.filter(validWalk) : []; }
      catch { return fallback.load(); }
    },
    save(walks) {
      fallback.save(walks);
      try { s.setItem(key, JSON.stringify(walks)); return true; } catch { broken = true; return false; }
    },
  };
}

export function saveWalk(store: WalkStore, walk: Walk): boolean {
  return store.save([...store.load().filter(w => w.id !== walk.id), walk]);
}

export function listWalks(store: WalkStore, regionId?: WalkRegion): Walk[] {
  return store.load().filter(w => w.endedAt !== null && (!regionId || w.regionId === regionId)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function deleteWalk(store: WalkStore, id: string): boolean {
  return store.save(store.load().filter(w => w.id !== id));
}
