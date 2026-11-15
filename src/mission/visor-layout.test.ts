import {describe,it,expect} from 'vitest';
import {insideVisor,rectInsideVisor,captionBounds} from './visor-layout';
describe('curved visor containment',()=>{
 it('rejects lower corner text that passes an enclosing-rectangle check',()=>{expect(insideVisor({x:144,y:622},800,644)).toBe(false);expect(insideVisor({x:144,y:569},800,644)).toBe(true);});
 for(const [w,h] of [[800,644],[1280,664],[1366,712],[1440,844],[1920,1024]])it(`keeps shifted captions within the actual ${w} by ${h} visor`,()=>{const b=captionBounds(w,h);for(const x of [b.left,b.right])for(const y of [b.top,b.bottom])expect(rectInsideVisor({x:x-77,y,width:154,height:70},w,h)).toBe(true);});
});
