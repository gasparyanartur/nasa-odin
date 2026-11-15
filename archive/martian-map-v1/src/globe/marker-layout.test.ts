import {describe,it,expect} from 'vitest';
import {layoutMarkers} from './marker-layout';
describe('nearby site discovery labels',()=>{
  it('keeps Bradbury and Boxwork clickable at global scale without changing their geographic anchors',()=>{
    const source=[{id:'bradbury',x:400,y:300},{id:'boxwork',x:400,y:301},{id:'jezero',x:100,y:100}];
    const placed=layoutMarkers(source,800,600);
    expect(Math.abs(placed[0].top-placed[1].top)).toBeGreaterThanOrEqual(44);
    expect(placed.map(({id,x,y})=>({id,x,y}))).toEqual(source);
  });
});
