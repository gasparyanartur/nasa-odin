import { describe,it,expect } from 'vitest';
import { FULL_MAP, mapPoint, zoomViewport, boundViewport } from './mapViewport';
describe('touch map coordinate alignment',()=>{
  it('keeps the anchor under a pinch or zoom and maps transformed taps to terrain',()=>{
    const anchor={x:.7,y:.3},before=mapPoint(FULL_MAP,anchor,2000);
    const zoomed=zoomViewport(FULL_MAP,4,anchor);
    expect(mapPoint(zoomed,anchor,2000)).toEqual(before);
    const panned=boundViewport({...zoomed,x:zoomed.x+.1,y:zoomed.y-.1});
    const point=mapPoint(panned,anchor,2000);
    expect(point.x).toBeCloseTo(before.x-50);expect(point.y).toBeCloseTo(before.y-50);
  });
  it('bounds all gestures to the prepared footprint and restores full extent',()=>{
    expect(boundViewport({zoom:20,x:-50,y:50})).toEqual({zoom:8,x:-7,y:0});
    const reset=zoomViewport({zoom:8,x:-4,y:-2},1);
    expect(reset).toEqual(FULL_MAP);
    expect(mapPoint(reset,{x:0,y:0},2000)).toEqual({x:-1000,y:1000});
  });
});
