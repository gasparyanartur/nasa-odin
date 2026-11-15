import type { Point } from '../mission/data';

export interface FrameLink {
  datasetId: 'gale-boxwork-v1';
  team: string;
  marswalk: string;
  rule: string;
  groundScaleX: number;
  origin: { longitude: number; latitude: number };
  radiusM: number;
}

export interface MarswalkScene {
  origin: { lon: number; lat: number };
  metres_per_degree: { lon: number; lat: number };
  ground_scale: { x: number; y: number };
}

export function marswalkToTeam(p: Point, frame: Pick<FrameLink, 'groundScaleX'>): Point {
  return { x: p.x * frame.groundScaleX, y: p.y };
}

export function teamToMarswalk(p: Point, frame: Pick<FrameLink, 'groundScaleX'>): Point {
  return { x: p.x / frame.groundScaleX, y: p.y };
}

export function marswalkToLonLat(p: Point, scene: MarswalkScene): [number, number] {
  return [scene.origin.lon + p.x / scene.metres_per_degree.lon, scene.origin.lat + p.y / scene.metres_per_degree.lat];
}

export function lonLatToMarswalk(lon: number, lat: number, scene: MarswalkScene): Point {
  return { x: (lon - scene.origin.lon) * scene.metres_per_degree.lon, y: (lat - scene.origin.lat) * scene.metres_per_degree.lat };
}

export function insideExtent(p: Point, extentM: number): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= extentM / 2 && Math.abs(p.y) <= extentM / 2;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function distanceToPolyline(p: Point, line: Point[]): number {
  if (!line.length) return NaN;
  if (line.length === 1) return distance(p, line[0]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, distanceToSegment(p, line[i], line[i + 1]));
  return best;
}
