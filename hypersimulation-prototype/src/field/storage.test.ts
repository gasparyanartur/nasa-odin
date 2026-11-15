import {describe,it,expect} from 'vitest';
import {loadFields} from './storage';
import {FIELD_KEY,LEGACY_FIELD_KEY,exportFields,type FieldRecord} from './model';
const note={id:'legacy',regionId:'gale-bradbury',kind:'note',title:'Original',description:'',source:'Personal note',uncertainty:'Approximate',points:[{x:30,y:50}],visible:true,restrictTravel:false,createdAt:'2026-11-14T12:00:00.000Z',updatedAt:'2026-11-14T12:00:00.000Z',observedAt:'2026-11-14T12:00:00.000Z',context:{sol:10,lmstHour:12,elapsedS:5,positionSource:'simulated-pose'}} as FieldRecord;
describe('field storage migration',()=>{
  it('validates and backs up v1 before saving the multi-site store, preserving provenance and source bytes',()=>{
    const raw=JSON.stringify(exportFields([note])),values=new Map([[LEGACY_FIELD_KEY,raw]]);
    const result=loadFields({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}});
    expect(result.records).toEqual([note]);expect(result.error).toBe('');expect(values.get(LEGACY_FIELD_KEY)).toBe(raw);expect(values.get(`${LEGACY_FIELD_KEY}.backup`)).toBe(raw);expect(values.has(FIELD_KEY)).toBe(true);
  });
  it('retains loaded records in memory and original storage when quota prevents migration',()=>{
    const raw=JSON.stringify(exportFields([note]));
    const result=loadFields({getItem:k=>k===LEGACY_FIELD_KEY?raw:null,setItem:()=>{throw new Error('Quota exceeded');}});
    expect(result.records).toEqual([note]);expect(result.error).toMatch(/Original saved data is retained/);
  });
  it.each(['malformed',''])('never overwrites a malformed saved payload (%s) or falls back silently to another store',raw=>{
    const writes:string[]=[];
    const result=loadFields({getItem:k=>k===FIELD_KEY?raw:JSON.stringify(exportFields([note])),setItem:k=>{writes.push(k);}});
    expect(result.records).toEqual([]);expect(result.unread).toBe(raw);expect(writes).toEqual([]);
  });
});
