import {describe,it,expect} from 'vitest';
import {layoutMarkers} from './marker-layout';
describe('nearby site discovery labels',()=>{
  it('keeps Bradbury and Boxwork clickable at global scale without changing their geographic anchors',()=>{
    const source=[{id:'bradbury',x:400,y:300},{id:'boxwork',x:400,y:301},{id:'jezero',x:100,y:100}];
    const placed=layoutMarkers(source,800,600);
    expect(Math.abs(placed[0].top-placed[1].top)).toBeGreaterThanOrEqual(44);
    expect(placed.map(({id,x,y})=>({id,x,y}))).toEqual(source);
  });
  it('places no label while the globe area has no size, so hidden labels never stack in the top left corner',()=>{
    const source=[{id:'bradbury',x:400,y:300},{id:'boxwork',x:400,y:301},{id:'jezero',x:100,y:100}];
    expect(layoutMarkers(source,0,0)).toEqual([]);
    expect(layoutMarkers(source,1066,646)).toHaveLength(3);
  });
  it('keeps each label at its point when the area is large enough',()=>{
    const [jezero]=layoutMarkers([{id:'jezero',x:399,y:266}],1066,646);
    expect({left:jezero.left,top:jezero.top}).toEqual({left:399,top:266});
  });
});
