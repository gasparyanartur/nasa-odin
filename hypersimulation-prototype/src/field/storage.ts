import { FIELD_KEY, LEGACY_FIELD_KEY, exportFields, importFields, type FieldRecord } from './model';
export function loadFields(storage:Pick<Storage,'getItem'|'setItem'>){
  let raw:string|null=null;
  try{
    raw=storage.getItem(FIELD_KEY);const legacy=raw===null?storage.getItem(LEGACY_FIELD_KEY):null;
    if(raw===null)raw=legacy;
    const records:FieldRecord[]=raw!==null?importFields(JSON.parse(raw)):[];
    let error='';
    if(legacy!==null){
      try{storage.setItem(`${LEGACY_FIELD_KEY}.backup`,legacy);storage.setItem(FIELD_KEY,JSON.stringify(exportFields(records)));}
      catch{error='Field records loaded in memory, but storage migration could not finish. Original saved data is retained. Export a backup before closing this page.';}
    }
    return {records,past:[] as FieldRecord[][],error,unread:undefined as string|undefined};
  }catch(e){return {records:[] as FieldRecord[],past:[] as FieldRecord[][],error:`Saved field data could not load: ${(e as Error).message} The saved value has not been overwritten.`,unread:raw??undefined};}
}
