import { useRef, useState } from 'react';
import { FIELD_KEY, exportFields, validateRecords, type FieldRecord } from './model';
import { loadFields } from './storage';
function initial(){return loadFields({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});}
export function useFieldStore(){
  const [state,setState]=useState(initial),latest=useRef(state);latest.current=state;
  function update(next:typeof state){latest.current=next;setState(next);}
  function write(records:FieldRecord[]){try{localStorage.setItem(FIELD_KEY,JSON.stringify(exportFields(records)));return '';}catch{return 'Field data is in memory only: browser storage is unavailable or full. Export a backup before closing this page.';}}
  function replace(value:FieldRecord[]){const current=latest.current,records=validateRecords(value),error=current.unread!==undefined?current.error:write(records);update({...current,records,past:[...current.past,current.records].slice(-20),error});}
  function undo(){const current=latest.current;if(!current.past.length)return;const records=current.past[current.past.length-1],error=current.unread!==undefined?current.error:write(records);update({...current,records,past:current.past.slice(0,-1),error});}
  function recover(){const current=latest.current,error=write(current.records);update({...current,error,unread:error?current.unread:undefined});}
  return {...state,replace,undo,recover};
}
