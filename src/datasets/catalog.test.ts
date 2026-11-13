import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BASEMAPS, REGIONS, OVERLAYS, canPlan, defaultOverlays } from './catalog';
import { geoToLocal, sample, type Meta, type TerrainData } from '../mission/data';

describe('real region and dataset catalog',()=>{
  it('resolves basemaps and grants planning only to prepared terrain',()=>{
    const ids=new Set(BASEMAPS.map(b=>b.id));
    for(const region of REGIONS){
      expect(region.basemapIds.every(id=>ids.has(id))).toBe(true);
      expect(region.sourceUrl).toMatch(/^https:\/\//);
      expect(region.capabilities.walk).toBe(canPlan(region));
    }
    expect(canPlan(REGIONS[0])).toBe(true);
    expect(canPlan(REGIONS[1])).toBe(false);
    expect(canPlan({...REGIONS[0],terrain:undefined})).toBe(false);
    expect(canPlan()).toBe(false);
  });
  it('keeps prepared coverage aligned with geographic and numeric terrain',()=>{
    const meta=JSON.parse(readFileSync('public/gale/manifest.json','utf8')) as Meta;
    expect(REGIONS[0].terrain!.datasetId).toBe(meta.id);
    expect(REGIONS[0].terrain!.bounds).toEqual(meta.bounds);
    const read=(name:string)=>{const b=readFileSync(`public/gale/${name}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
    const data={baseUrl:'/gale',meta,heights:new Float32Array(read('height.f32')),slopes:new Float32Array(read('slope.f32')),valid:new Uint8Array(read('valid.u8'))} as TerrainData;
    const [west,south,east,north]=meta.bounds;
    for(const [lon,lat] of [[west,south],[east,north]]){
      const local=geoToLocal(meta,lon,lat);
      expect(Math.abs(local.x)).toBeCloseTo(meta.extentM/2,5);
      expect(Math.abs(local.y)).toBeCloseTo(meta.extentM/2,5);
    }
    expect(sample(data,{x:0,y:0})).not.toBeNull();
    expect(sample(data,geoToLocal(meta,REGIONS[1].center.longitude,REGIONS[1].center.latitude))).toBeNull();
    for(const overlay of OVERLAYS)expect(readFileSync(`public/gale/${overlay.file}`).length).toBeGreaterThan(100);
  });
  it('creates independent layer settings without modifying default states',()=>{
    const a=defaultOverlays(),b=defaultOverlays();a.slope.visible=true;a.imagery.opacity=.4;
    expect(b.slope.visible).toBe(false);expect(b.imagery.opacity).toBe(1);
  });
});
