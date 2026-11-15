import {describe,it,expect} from 'vitest';
import {appendSample,loadTraverses,parseTraverses,traceDistance,traceDuration,writeTraverses,type Traverse} from './traverses';
const settings={speedMps:.8,maxSlopeDeg:20,maxDurationMin:90,doseRateMicroGyH:10,maxDoseMicroGy:50,temperatureK:220,minTemperatureK:180,windMps:0,maxWindMps:25,exclusions:[]};
const a={x:0,y:0,heading:0,elapsed:10},b={x:3,y:4,heading:0,elapsed:20};
const record:Traverse={id:'a',name:'Walk',savedAt:'2026-11-15T12:00:00Z',datasetId:'gale',regionId:'gale-bradbury',version:1,settings,habitat:a,destination:b,reached:false,samples:[a,b]};
describe('executed traverse history',()=>{
 it('measures actual sampled horizontal distance and running-clock duration, including stops',()=>{expect(traceDistance([a,b,{...b,elapsed:40}])).toBe(5);expect(traceDuration([a,b,{...b,elapsed:40}])).toBe(30);});
 it('samples movement or time, preserves a final endpoint and rejects backwards time',()=>{const points=[a];expect(appendSample(points,{...a,elapsed:11})).toBe(points);expect(appendSample(points,{...a,elapsed:15})).toHaveLength(2);expect(appendSample(points,{...a,x:1,elapsed:11})).toHaveLength(2);expect(appendSample(points,{...a,x:.1,elapsed:11},true)).toHaveLength(2);expect(appendSample(points,{...b,elapsed:9},true)).toBe(points);expect(appendSample(points,a,true)).toBe(points);});
 it('round trips geometry, site/version and saved assumptions',()=>{let raw='';writeTraverses({setItem:(_key,value)=>{raw=value;}},[record]);expect(parseTraverses(raw)).toEqual([record]);});
 it('preserves unread storage and surfaces unavailable reads',()=>{const state=loadTraverses({getItem:()=>'{broken'});expect(state.unread).toBe(true);expect(state.error).toContain('preserved');expect(loadTraverses({getItem:()=>{throw new Error('denied');}}).unread).toBe(true);});
 it('rejects malformed geometry, reversed clocks, duplicate IDs and unknown schemas',()=>{for(const records of [[{...record,samples:[a,{...b,x:null}]}],[{...record,samples:[b,a]}],[record,record],[{...record,settings:{}}]])expect(()=>parseTraverses(JSON.stringify({schema:1,records}))).toThrow();expect(()=>parseTraverses('{"schema":2,"records":[]}')).toThrow();});
 it('does not report a failed write as saved',()=>{expect(()=>writeTraverses({setItem:()=>{throw new Error('quota');}},[record])).toThrow('quota');});
});
