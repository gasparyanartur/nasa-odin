import { describe, expect, it } from 'vitest';
import { canMove, geoToLocal, localToGeo, routeProgress, sample, type Meta, type Route, type Settings, type TerrainData } from './data';

const meta={size:3,stepM:5,extentM:10,origin:{longitude:137.4417,latitude:-4.5895},radiusM:3396190} as Meta;
const terrain={meta,heights:new Float32Array([1,2,3,4,5,6,7,8,9]),slopes:new Float32Array(9),valid:new Uint8Array(9).fill(1)} as TerrainData;
describe('shared terrain and mission geometry',()=>{
  it('round trips Mars coordinates at patch center and corners',()=>{
    for(const p of [{x:0,y:0},{x:-1000,y:1000},{x:1000,y:-1000}]){const g=localToGeo(meta,p),q=geoToLocal(meta,...g);expect(q.x).toBeCloseTo(p.x,6);expect(q.y).toBeCloseTo(p.y,6);}
  });
  it('interpolates numeric samples and refuses missing coverage',()=>{
    expect(sample(terrain,{x:0,y:0})?.elevation).toBe(5);
    expect(sample(terrain,{x:-2.5,y:2.5})?.elevation).toBe(3);
    expect(sample(terrain,{x:6,y:0})).toBeNull();
    const bad={...terrain,valid:new Uint8Array(9).fill(1)};bad.valid[4]=0;
    expect(sample(bad,{x:-2.5,y:2.5})).toBeNull();
  });
  it('checks the swept motion against exclusion and terrain limits',()=>{
    const s={maxSlopeDeg:20,exclusions:[{x:0,y:0,radius:1}]} as Settings;
    expect(canMove(terrain,{x:-5,y:0},{x:5,y:0},s)).toBe(false);
    expect(canMove(terrain,{x:0,y:0},{x:6,y:0},{...s,exclusions:[]})).toBe(false);
  });
  it('measures route progress by projection rather than nearest vertex',()=>{
    const r={points:[[0,0,0],[100,0,0],[100,100,0]]} as Route;
    const p=routeProgress(r,{x:40,y:10});expect(p.offRouteM).toBe(10);expect(p.remainingM).toBe(160);
  });
});
