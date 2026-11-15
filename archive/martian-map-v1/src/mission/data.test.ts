import { describe, expect, it } from 'vitest';
import { advanceWalk, canMove, geoToLocal, localToGeo, routeProgress, sample, type Meta, type Route, type Settings, type TerrainData } from './data';

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
  it('keeps slow-frame mission intervals and motion while respecting swept collisions',()=>{
    const flat={...terrain,heights:new Float32Array(9)};
    const settings={speedMps:.8,maxSlopeDeg:20,exclusions:[]};
    const pose={x:-4,y:0,heading:Math.PI/2,elapsed:0};
    const slow=advanceWalk(flat,pose,settings,pose.heading,1,0,5);
    let fast=pose;
    for(let i=0;i<50;i++)fast=advanceWalk(flat,fast,settings,pose.heading,1,0,.1).pose;
    expect(slow.pose.elapsed).toBe(5);expect(fast.elapsed).toBeCloseTo(5);
    expect(slow.pose.x).toBeCloseTo(fast.x,8);expect(slow.pose.x).toBeCloseTo(0,6);
    const stopped=advanceWalk(flat,pose,{...settings,exclusions:[{x:0,y:0,radius:1}]},pose.heading,1,0,5);
    expect(stopped.blocked).toBe(true);expect(stopped.pose.x).toBeLessThan(-1);
    expect(stopped.pose.elapsed).toBe(5);
    expect(advanceWalk(flat,pose,settings,pose.heading,0,0,5).pose).toEqual({...pose,elapsed:5});
  });

});
