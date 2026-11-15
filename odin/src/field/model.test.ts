import { describe,it,expect } from 'vitest';
import { anchor, exportFields, importFields, mergeFields, validateRecord, validateRecords, fieldExclusions, restrictionKey, type FieldKind, type FieldRecord } from './model';
import { canMove, type TerrainData } from '../mission/data';
const fixture=(kind:FieldKind='note',id='test_1'):FieldRecord=>({id,regionId:'gale-bradbury',kind,title:'Windblown material',description:'User interpretation',source:'Simulated field notebook',uncertainty:'Approximate simulated position; no field verification.',points:kind==='unit'?[{x:0,y:0},{x:100,y:0},{x:100,y:100}]:kind==='contact'?[{x:0,y:0},{x:100,y:100}]:[{x:50,y:50}],visible:true,restrictTravel:false,...(kind==='obstacle'?{radiusM:40}:{}),...(kind==='temperature'||kind==='radiation'?{value:kind==='temperature'?220:8.1}:{}),createdAt:'2026-11-14T12:00:00.000Z',updatedAt:'2026-11-14T12:00:00.000Z',observedAt:'2026-11-14T12:00:00.000Z',context:{sol:10,lmstHour:12,elapsedS:30,positionSource:'simulated-pose'}});
describe('editable Mars field data contract',()=>{
  it('round trips every supported geometry, reading and provenance without changing published coordinates',()=>{
    const records=(['note','unit','contact','obstacle','temperature','radiation'] as const).map((kind,i)=>fixture(kind,`record_${i}`));
    const external=exportFields(records),restored=importFields(JSON.parse(JSON.stringify(external)));
    expect(restored).toEqual(records);expect(external.features[1].geometry.type).toBe('Polygon');
    expect(anchor(restored[1])).toEqual({x:0,y:0});
  });
  it('rejects Earth GeoJSON, mismatched units, unknown schema, malformed dates and outside coverage',()=>{
    const external=exportFields([fixture('temperature')]);
    expect(()=>importFields({...external,planet:'Earth'})).toThrow(/Mars/);
    expect(()=>importFields({...external,version:2})).toThrow(/v1/);
    const wrong=structuredClone(external);wrong.features[0].properties.units='µGy/h';expect(()=>importFields(wrong)).toThrow(/units/);
    expect(()=>validateRecord({...fixture(),observedAt:'2026-02-31T00:00:00Z'})).toThrow(/calendar/);
    expect(()=>validateRecord({...fixture(),points:[{x:1001,y:0}]})).toThrow(/Easting/);
    expect(()=>validateRecord({...fixture('radiation'),value:Infinity})).toThrow(/Reading/);
    expect(()=>validateRecord({...fixture(),context:{...fixture().context,sol:10.5}})).toThrow(/integer/);
  });
  it('validates drawn geometry and rejects self crossings, repeated/degenerate vertices and holes',()=>{
    expect(()=>validateRecord({...fixture('unit'),points:[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}]})).toThrow();
    expect(()=>validateRecord({...fixture('unit'),points:[{x:0,y:0},{x:100,y:0},{x:200,y:0}]})).toThrow(/enclose/);
    expect(()=>validateRecord({...fixture('contact'),points:[{x:0,y:0}]})).toThrow(/requires/);
    const polygon=exportFields([fixture('unit')]);(polygon.features[0].geometry.coordinates as number[][][]).push([[0,0],[1,1],[0,0]]);expect(()=>importFields(polygon)).toThrow(/holes/);
  });
  it('merges by ID atomically and enforces layer/restriction limits',()=>{
    const original=fixture(),changed={...fixture(),title:'Revised interpretation'};
    expect(mergeFields([original],[changed])).toEqual([changed]);expect(original.title).toBe('Windblown material');
    expect(()=>validateRecords([original,original])).toThrow(/Duplicate/);
    expect(()=>validateRecords(Array.from({length:101},(_,i)=>fixture('note',`r${i}`)))).toThrow(/100/);
    expect(()=>validateRecords(Array.from({length:31},(_,i)=>({...fixture('obstacle',`r${i}`),restrictTravel:true})))).toThrow(/30/);
  });
  it('keeps display visibility independent of active constraints and does not promote readings into fields',()=>{
    const circle={...fixture('obstacle'),restrictTravel:true},hidden={...circle,visible:false};
    expect(fieldExclusions([hidden])).toEqual([{x:50,y:50,radius:40}]);expect(restrictionKey([circle])).toBe(restrictionKey([hidden]));
    expect(fieldExclusions([fixture('temperature'),fixture('radiation')])).toEqual([]);
    expect(()=>validateRecord({...fixture('temperature'),restrictTravel:true})).toThrow(/Only circular/);
  });
  it('uses the exact same declared circular extent in swept walking checks',()=>{
    const record={...fixture('obstacle'),points:[{x:0,y:0}],radiusM:5,restrictTravel:true};
    const terrain={meta:{size:5,stepM:5,extentM:20},heights:new Float32Array(25),slopes:new Float32Array(25),valid:new Uint8Array(25).fill(1)} as TerrainData;
    expect(canMove(terrain,{x:-10,y:0},{x:10,y:0},{maxSlopeDeg:20,exclusions:fieldExclusions([record])})).toBe(false);
    expect(canMove(terrain,{x:-10,y:0},{x:10,y:0},{maxSlopeDeg:20,exclusions:fieldExclusions([{...record,restrictTravel:false}])})).toBe(true);
  });
});
