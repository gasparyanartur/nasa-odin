import raw from '../../public/science/geology.json';
import type { Point } from '../mission/data';
import type { RegionId } from './catalog';

export type Coordinate = [number, number];
export interface GeologicalUnit { id: string; code: string; name: string; group: string; characteristics: string; interpretation: string; color: string; polygons: Coordinate[][][] }
export interface GeologicalContact { id: string; type: string; lines: Coordinate[][] }
export interface ScienceTarget { id: string; name: string; regionId: RegionId; longitude: number; latitude: number; point: Point; sol: number; rmc: string; question: string; evidence: string; sourceUrl: string; additionalSource: string; positionSource: string; positionNote: string; timeNote: string }
export interface GeologyRegion { bounds: [number,number,number,number]; units: GeologicalUnit[]; contacts: GeologicalContact[] }
export interface SciencePackage { id: string; version: number; preparedDate: string; title: string; publication: string; sourceUrl: string; serviceUrl: string; sourceOwner:string; mapScale: string; publicationYear: number; coordinateReference: string; processing: string; limitation: string; regions: Partial<Record<RegionId,GeologyRegion>>; targets: ScienceTarget[]; sources: {file:string;url:string;sha256:string}[] }
export interface GeologySettings { visible: boolean; opacity: number; contacts: boolean }
export interface GeologySelection { kind: 'unit' | 'contact'; id: string }
export const SCIENCE=raw as unknown as SciencePackage;
export const targetById=(id?:string)=>SCIENCE.targets.find(t=>t.id===id);
function inRing(ring:Coordinate[],x:number,y:number) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
export function unitAt(regionId:RegionId,longitude:number,latitude:number) {
  const region=SCIENCE.regions[regionId];
  if(!region)return undefined;
  if(longitude<region.bounds[0]||longitude>region.bounds[2]||latitude<region.bounds[1]||latitude>region.bounds[3])return undefined;
  return region.units.find(u=>u.polygons.some(rings=>inRing(rings[0],longitude,latitude)&&!rings.slice(1).some(r=>inRing(r,longitude,latitude))));
}
export function pointInPolygon(rings:Coordinate[][],point:Coordinate) {
  return inRing(rings[0],...point)&&!rings.slice(1).some(r=>inRing(r,...point));
}
