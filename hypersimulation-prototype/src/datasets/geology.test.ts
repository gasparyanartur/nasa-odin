import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SCIENCE,pointInPolygon,targetById,unitAt } from './geology';
import { geoToLocal,sample,type Meta,type TerrainData } from '../mission/data';

describe('source-backed geological context and science targets',()=>{
  it('preserves polygon holes and rejects coverage outside bundled regions',()=>{
    const rings:[number,number][][]=[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]];
    expect(pointInPolygon(rings,[1,1])).toBe(true);expect(pointInPolygon(rings,[5,5])).toBe(false);
    expect(pointInPolygon(rings,[20,20])).toBe(false);expect(unitAt('gale-bradbury',0,0)).toBeUndefined();
  });
  it('retains real regional unit IDs, attributes, bounds and source identities',()=>{
    expect(SCIENCE.sourceOwner).toBe('mahunter@usgs.gov_USGS');
    expect(SCIENCE.mapScale).toBe('1:20,000,000');
    for(const region of Object.values(SCIENCE.regions)){
      expect(region.units.length).toBeGreaterThan(1);expect(region.contacts.length).toBeGreaterThan(1);
      for(const u of region.units){expect(u.name.length).toBeGreaterThan(5);expect(u.interpretation.length).toBeGreaterThan(10);expect(u.color).toMatch(/^#[a-f0-9]{6}$/);
        for(const poly of u.polygons)for(const ring of poly)for(const [lon,lat] of ring){expect(lon).toBeGreaterThanOrEqual(region.bounds[0]);expect(lon).toBeLessThanOrEqual(region.bounds[2]);expect(lat).toBeGreaterThanOrEqual(region.bounds[1]);expect(lat).toBeLessThanOrEqual(region.bounds[3]);}
      }
    }
    expect(SCIENCE.sources.every(s=>s.sha256.length===64&&s.url.startsWith('https://'))).toBe(true);
    expect(unitAt('gale-bradbury',137.4417,-4.5895)?.code).toBe('AHi');
  });
  it('places both real visit-area targets on permitted measured terrain without implying local unit variation',()=>{
    const meta=JSON.parse(readFileSync('public/gale/manifest.json','utf8')) as Meta;
    const read=(name:string)=>{const b=readFileSync(`public/gale/${name}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
    const data={meta,heights:new Float32Array(read('height.f32')),slopes:new Float32Array(read('slope.f32')),valid:new Uint8Array(read('valid.u8'))} as TerrainData;
    for(const t of SCIENCE.targets){
      const real=geoToLocal(meta,t.longitude,t.latitude);
      expect(Math.hypot(real.x-t.point.x,real.y-t.point.y)).toBeLessThanOrEqual(meta.stepM/Math.sqrt(2));
      const sampled=sample(data,t.point);expect(sampled).not.toBeNull();expect(sampled!.slope).toBeLessThan(20);
      expect(t.positionSource).toContain('mars.nasa.gov');expect(t.positionNote).toContain('not an exact');
      expect(unitAt(t.regionId,t.longitude,t.latitude)?.code).toBe('AHi');
    }
    expect(targetById('yellowknife')?.sol).toBe(125);expect(targetById('rocknest')?.sol).toBe(56);expect(targetById('unknown')).toBeUndefined();
  });
});
