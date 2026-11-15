import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {groundPoint,projectedPoint} from './renderer';
import {toUint16,createTerrain} from './terrain.js';
import {coreChunkLayout,gridUvs,walkPose,displayStride} from './scene3d.js';
import {geoToLocal,localToGeo,sample,type Meta,type TerrainData} from '../data';
import {exportFields,importFields,mergeFields,type FieldRecord} from '../../field/model';
import {getRegion,canPlan} from '../../datasets/catalog';
const meta=JSON.parse(readFileSync('public/boxwork/manifest.json','utf8')) as Meta;
const scene=JSON.parse(readFileSync('public/boxwork/detail/scene.json','utf8'));
const bin=(name:string)=>{const b=readFileSync(`public/boxwork/${name}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
describe('integrated terrain and multi-site boundaries',()=>{
  it('adapts software display detail while preserving full-detail High geometry',()=>{expect(displayStride(true,'SwiftShader')).toBe(4);expect(displayStride(false,'SwiftShader')).toBe(1);expect(displayStride(true,'NVIDIA')).toBe(2);expect(coreChunkLayout(scene,{lowDetail:true,sampleStride:4}).stride).toBe(4);});
  it('round trips geographic, ground and projected coordinates without moving landmarks',()=>{
    for(const p of [{x:-500,y:500},{x:500,y:-500},{x:195,y:315}]){
      const q=groundPoint(projectedPoint(p,scene.ground_scale),scene.ground_scale);expect(q.x).toBeCloseTo(p.x,8);expect(q.y).toBeCloseTo(p.y,8);
      const g=localToGeo(meta,p),back=geoToLocal(meta,...g);expect(back.x).toBeCloseTo(p.x,6);expect(back.y).toBeCloseTo(p.y,6);
    }
    expect(canPlan(getRegion('gale-boxwork'))).toBe(true);expect(canPlan(getRegion('jezero'))).toBe(false);
  });
  it('keeps render detail and the analytical footprint distinct, with north-first texture orientation',()=>{
    const terrain=createTerrain(scene,{core:toUint16(bin('detail/dem_core.bin'),1025**2,'core'),surround:toUint16(bin('detail/dem_surround.bin'),513**2,'surround')});
    const data={meta,heights:new Float32Array(bin('height.f32')),slopes:new Float32Array(bin('slope.f32')),valid:new Uint8Array(bin('valid.u8'))} as TerrainData;
    const p={x:195,y:315},q=projectedPoint(p,scene.ground_scale);
    expect(sample(data,p)!.elevation).toBeCloseTo(terrain.heightAt(q.x,q.y)!,3);
    expect(sample(data,{x:501,y:0})).toBeNull();expect(terrain.heightAt(600,0)).not.toBeNull();
    expect(coreChunkLayout(scene).chunks).toHaveLength(4);expect(Array.from(gridUvs(2,2)).slice(0,4)).toEqual([0,0,1,0]);
    expect(walkPose({x:0,y:0,groundRel:0,headingDeg:0}, {gs:{x:1,y:1},exag:1}).dir.z).toBeLessThan(0);
  });
  it('preserves legacy records and round trips Boxwork coordinates without cross-site ID replacement',()=>{
    const record={id:'shared',regionId:'gale-bradbury',kind:'note',title:'Site note',description:'',source:'User interpretation',uncertainty:'Approximate',points:[{x:100,y:50}],visible:true,restrictTravel:false,createdAt:'2026-11-14T12:00:00.000Z',updatedAt:'2026-11-14T12:00:00.000Z',observedAt:'2026-11-14T12:00:00.000Z',context:{sol:10,lmstHour:12,elapsedS:0,positionSource:'map-selection'}} as FieldRecord;
    expect(exportFields([record]).version).toBe(1);expect(importFields(exportFields([record]))).toEqual([record]);
    const other={...record,regionId:'gale-boxwork' as const,context:{...record.context,sol:4600}};
    const joined=mergeFields([record],[other]);expect(joined).toHaveLength(2);
    const packed=exportFields(joined);expect(packed.version).toBe(2);expect(importFields(packed)).toEqual(joined);
    expect(packed.features[0].geometry.coordinates).not.toEqual(packed.features[1].geometry.coordinates);
    expect(()=>importFields({...packed,reference:'EPSG:4326'})).toThrow(/not Earth/);
    expect(()=>importFields({...packed,sites:{'gale-boxwork':'unknown'}})).toThrow(/reference/);
  });
});
