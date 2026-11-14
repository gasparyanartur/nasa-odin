import { useRef, useState } from 'react';
import { FIELD_KEY, exportFields, importFields, validateRecords, type FieldRecord } from './model';
function initial(){
  let raw:string|null=null;
  try{raw=localStorage.getItem(FIELD_KEY);return{records:raw?importFields(JSON.parse(raw)):[],past:[] as FieldRecord[][],error:'',unread:undefined as string|undefined};}
  catch(e){return{records:[] as FieldRecord[],past:[] as FieldRecord[][],error:`Saved field data could not load: ${(e as Error).message} The saved value has not been overwritten.`,unread:raw??undefined};}
}
export function useFieldStore(){
  const [state,setState]=useState(initial),latest=useRef(state);latest.current=state;
  function update(next:typeof state){latest.current=next;setState(next);}
  function write(records:FieldRecord[]){try{localStorage.setItem(FIELD_KEY,JSON.stringify(exportFields(records)));return '';}catch{return 'Field data is in memory only: browser storage is unavailable or full. Export a backup before closing this page.';}}
  function replace(value:FieldRecord[]){const current=latest.current,records=validateRecords(value),error=current.unread!==undefined?current.error:write(records);update({...current,records,past:[...current.past,current.records].slice(-20),error});}
  function undo(){const current=latest.current;if(!current.past.length)return;const records=current.past[current.past.length-1],error=current.unread!==undefined?current.error:write(records);update({...current,records,past:current.past.slice(0,-1),error});}
  function recover(){const current=latest.current,error=write(current.records);update({...current,error,unread:error?current.unread:undefined});}
  return {...state,replace,undo,recover};
}
