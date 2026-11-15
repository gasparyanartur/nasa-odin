import { describe, expect, it } from 'vitest';
import raw from '../../public/environment/catalog.json';
import { availableLayers, DEFAULT_ENVIRONMENT, layerRange, parseCatalog, sampleAt, selectedRecord } from './model';

describe('actual environmental data package',()=>{
  const catalog=parseCatalog(raw);
  it('retains real counts, missing values, units and source records',()=>{
    expect(catalog.history.sols).toHaveLength(19);
    expect(catalog.history.sols.flatMap(s=>s.records)).toHaveLength(456);
    expect(catalog.sources.length).toBeGreaterThan(100);
    expect(catalog.sources.every(s=>/^[a-f0-9]{64}$/.test(s.sha256))).toBe(true);
    const th=catalog.layers.find(l=>l.id==='grs-th')!;
    expect(th.unit).toBe('ppm');expect(th.samples).toHaveLength(2592);
    const valid=th.samples.find(s=>s.value!==null)!;
    expect(valid.value).toBeCloseTo(valid.rawValue!*10000,5);
    expect(th.samples.some(s=>s.value===null&&s.rawValue!<0)).toBe(true);
    const mcs=catalog.layers.find(l=>l.id==='mcs-temperature')!;
    expect(mcs.samples.length).toBeGreaterThan(100);
    expect(mcs.samples.every(s=>s.utc?.startsWith('2015-04-01')&&s.error!>=0&&s.quality.includes('Gqual=0'))).toBe(true);
  });
  it('samples actual bin footprints without inventing spatial values',()=>{
    const k=catalog.layers.find(l=>l.id==='grs-k')!,sample=sampleAt(k,137.4417,-4.5895)!;
    expect(sample.bounds).toEqual([135,-5,140,0]);
    expect(sampleAt(k,137.4417,95)).toBeUndefined();
    const mcs=catalog.layers.find(l=>l.id==='mcs-temperature')!;
    expect(sampleAt(mcs,mcs.samples[0].lon,mcs.samples[0].lat)?.id).toBe(mcs.samples[0].id);
    expect(sampleAt({...mcs,samples:[]},0,0)).toBeUndefined();
  });
  it('keeps composition, air temperature, surface temperature and detector dose separate',()=>{
    const layers=availableLayers(catalog,DEFAULT_ENVIRONMENT);
    expect(new Set(layers.map(l=>l.quantity)).size).toBe(layers.length);
    expect(layers.find(l=>l.id==='site-radiation')?.unit).toBe('µGy/h');
    expect(layers.find(l=>l.id==='site-temperature')?.geometry).toBe('points');
    const future={...DEFAULT_ENVIRONMENT,sol:catalog.forecast.targetSol};
    expect(availableLayers(catalog,future).find(l=>l.id==='site-temperature')?.kind).toBe('forecast');
    expect(selectedRecord(catalog,future).temperature).toBe(catalog.forecast.temperature[future.hour].value);
    expect(selectedRecord(catalog,{...future,sol:1000}).temperature).toBeNull();
    expect(layerRange({...layers[0],samples:[]})).toEqual([0,1]);
  });
  it('rejects corrupt spatial/time data rather than silently rendering it',()=>{
    const broken=structuredClone(raw);broken.layers[0].samples[0].lon=500;
    expect(()=>parseCatalog(broken)).toThrow('Invalid environmental sample');
    const duplicate=structuredClone(raw);duplicate.history.sols.push(duplicate.history.sols[0]);
    expect(()=>parseCatalog(duplicate)).toThrow('Invalid historical sol');
    const future=structuredClone(raw);future.forecast.trainingSols.push(future.forecast.targetSol);
    expect(()=>parseCatalog(future)).toThrow('Invalid forecast issuance');
  });
});
