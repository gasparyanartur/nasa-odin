import {describe,it,expect} from 'vitest';
import {rasterizePolygonMask} from './surface/scene3d.js';
import {exposedArea,eventStatus,inDanger,eventInstruction,type ExpeditionEvent} from './events';
const home={x:0,y:0},solar:ExpeditionEvent={id:'s',kind:'solar',atS:60,createdS:0,center:home,radiusM:35,acknowledged:false};
describe('expedition scenarios',()=>{
 it('triggers on the mission clock boundary and keeps acknowledged hazards active',()=>{expect(eventStatus(solar,59.99)).toBe('scheduled');expect(eventStatus(solar,60)).toBe('active');expect(eventStatus({...solar,acknowledged:true},60)).toBe('active');expect(eventStatus({...solar,endedS:80},90)).toBe('ended');});
 it('solar danger is outside the habitat shelter, independent of trigger position',()=>{expect(inDanger({...solar,center:{x:400,y:400}},home,home)).toBe(false);expect(inDanger(solar,{x:35,y:0},home)).toBe(false);expect(inDanger(solar,{x:35.01,y:0},home)).toBe(true);expect(eventInstruction(solar,{x:100,y:0},home)).toContain('return to habitat');});
 it('surface exposure hatch fills outside shelter and leaves the shelter clear',()=>{const coords=exposedArea(home,35,200).map(p=>[p.x,p.y]);const mask=rasterizePolygonMask([{coords,channel:1}],{west:-100,north:100,width:200,height:200},200,200);expect(mask[(100*200+100)*4+1]).toBe(0);expect(mask[(100*200+150)*4+1]).toBe(255);expect(mask[(20*200+20)*4+1]).toBe(255);});
 it('dust is a local declared circle; leaving changes the advice',()=>{const dust={...solar,kind:'dust' as const,center:{x:100,y:100},radiusM:60};expect(inDanger(dust,home,home)).toBe(false);expect(inDanger(dust,dust.center,home)).toBe(true);expect(eventInstruction(dust,home,home)).toContain('avoid');expect(eventInstruction(dust,dust.center,home)).toContain('leave');});
});
