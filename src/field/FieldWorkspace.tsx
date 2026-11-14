import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import SurfaceMap from '../mission/SurfaceMap';
import type { Point, Pose, TerrainData } from '../mission/data';
import { localToGeo, sample } from '../mission/data';
import { defaultOverlays } from '../datasets/catalog';
import { LMST_HOUR_SECONDS } from '../mission/conditions';
import FieldDetails from './FieldDetails';
import { KINDS, anchor, download, effectLabel, exportFields, importFields, mergeFields, unitFor, validateRecord, type FieldKind, type FieldRecord } from './model';

// Keep transient numeric text (a leading minus or decimal) while editing.
function NumberInput({value,onValue,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'> & {value:number;onValue:(value:number)=>void}){
  const [text,setText]=useState(String(value)),lastValue=useRef(value);
  useEffect(()=>{if(value!==lastValue.current){lastValue.current=value;setText(String(value));}},[value]);
  return <input {...props} type="number" required value={text} onChange={e=>{setText(e.target.value);if(Number.isFinite(e.target.valueAsNumber)){lastValue.current=e.target.valueAsNumber;onValue(e.target.valueAsNumber);}}} onBlur={()=>setText(String(value))}/>;
}

interface Props {
  active:boolean;data:TerrainData;records:FieldRecord[];draft?:FieldRecord;onDraft:(r:FieldRecord|undefined)=>void;selected?:string;onSelect:(id:string|undefined)=>void;
  pose:Pose;inspection:Point;departureHour:number;exclusions:{x:number;y:number;radius:number}[];
  onCommit:(r:FieldRecord[])=>void;onUndo:()=>void;canUndo:boolean;storageError:string;unread?:string;onRecover:()=>void;
}
export function newFieldRecord(kind:FieldKind,point:Point,pose:Pose,departureHour:number,positionSource:FieldRecord['context']['positionSource']):FieldRecord {
  const hour=departureHour+pose.elapsed/LMST_HOUR_SECONDS,now=new Date().toISOString();
  return {id:crypto.randomUUID(),regionId:'gale-bradbury',kind,title:'',description:'',source:'User field entry · simulated exploration',uncertainty:kind==='temperature'||kind==='radiation'?'User-supplied point reading; instrument accuracy and spatial representativeness are unspecified.':'User interpretation in simulated terrain; extent and location are approximate and unverified.',points:kind==='unit'||kind==='contact'?[]:[{...point}],visible:true,restrictTravel:false,...(kind==='obstacle'?{radiusM:40}:{}),...(kind==='temperature'||kind==='radiation'?{value:kind==='temperature'?220:10}:{}),createdAt:now,updatedAt:now,observedAt:now,context:{sol:10+Math.floor(hour/24),lmstHour:hour%24,elapsedS:pose.elapsed,positionSource}};
}
export default function FieldWorkspace(p:Props){
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[picking,setPicking]=useState(false);
  const latestRecords=useRef(p.records);latestRecords.current=p.records;
  const draft=p.draft,selected=p.records.find(r=>r.id===p.selected);
  function update(patch:Partial<FieldRecord>){if(draft)p.onDraft({...draft,...patch});setError('');}
  function commit(next:FieldRecord[],message:string){try{p.onCommit(next);setError('');setMessage(message);return true;}catch(e){setError((e as Error).message);return false;}}
  function begin(kind:FieldKind='note',at=p.inspection,source:FieldRecord['context']['positionSource']='map-selection'){p.onDraft(newFieldRecord(kind,at,p.pose,p.departureHour,source));setPicking(false);p.onSelect(undefined);setError('');setMessage('Draft started. Save to add it to the field layer.');}
  function pick(point:Point){
    if(!draft||!picking)return;
    const q={x:Math.round(point.x*10)/10,y:Math.round(point.y*10)/10};
    const drawing=draft.kind==='unit'||draft.kind==='contact';
    if(drawing&&draft.points.length>=100){setError('At most 100 vertices per record.');return;}
    update({points:drawing?[...draft.points,q]:[q],context:{...draft.context,positionSource:'map-selection'}});
    if(!drawing)setPicking(false);
  }
  function save(){
    if(!draft)return;
    try{const record=validateRecord({...draft,updatedAt:new Date().toISOString()});if(record.points.some(q=>!sample(p.data,q)))throw new Error('Every vertex must be inside valid prepared terrain.');const next=p.records.some(r=>r.id===record.id)?p.records.map(r=>r.id===record.id?record:r):[...p.records,record];if(commit(next,'Field record saved. Published source data is unchanged.')){p.onDraft(undefined);p.onSelect(record.id);setPicking(false);}}catch(e){setError((e as Error).message);}
  }
  function edit(record:FieldRecord){p.onDraft(structuredClone(record));p.onSelect(record.id);setPicking(false);setError('');setMessage('Editing a copy; Save applies your changes.');}
  const selectionPoint=selected?anchor(selected):p.inspection;
  return <main className="field-workspace" style={{display:p.active?undefined:'none'}}>
    <aside className="field-editor"><span className="eyebrow">TABLET / PERSONAL FIELD LAYER</span><h1>Leave a record.</h1><p className="subtle">Add observations and interpretations to the same landscape. Your layer is saved in this browser and can be exported.</p>
      <div className="button-row"><button className="primary" disabled={!!draft} onClick={()=>begin()}>New record</button><button className="secondary" disabled={!!draft} onClick={()=>begin('note',p.pose,'simulated-pose')}>Log at astronaut</button></div>
      {p.storageError&&<div className="error" role="alert"><p>{p.storageError}</p>{p.unread!==undefined&&<><button className="secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([p.unread!],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='unread-field-data-backup.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download unread saved file</button><button className="secondary" onClick={p.onRecover}>Replace unread file with current layer</button></>}</div>}
      {draft&&<p className="caption">Save or cancel this draft before starting another record or changing the saved layer. Drafts are not saved across browser reload.</p>}
      {draft&&<form className="field-form" aria-label="Field record editor" onSubmit={e=>{e.preventDefault();save();}}>
        <label>Record type<select aria-label="Field record type" value={draft.kind} onChange={e=>{const next=newFieldRecord(e.target.value as FieldKind,draft.points[0]??p.inspection,p.pose,p.departureHour,draft.context.positionSource);p.onDraft({...draft,...next,id:draft.id,title:draft.title,description:draft.description,source:draft.source,uncertainty:draft.uncertainty,createdAt:draft.createdAt,observedAt:draft.observedAt,context:draft.context});setPicking(false);}}>{Object.entries(KINDS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
        <label>Title<input aria-label="Field record title" maxLength={100} required value={draft.title} onChange={e=>update({title:e.target.value})}/></label>
        <label>Description<textarea aria-label="Field record description" maxLength={4000} rows={3} value={draft.description} onChange={e=>update({description:e.target.value})}/></label>
        <label>Source / attribution<input aria-label="Field record source" required maxLength={300} value={draft.source} onChange={e=>update({source:e.target.value})}/></label>
        <label>Uncertainty / limitations<textarea aria-label="Field record uncertainty" required maxLength={1000} rows={2} value={draft.uncertainty} onChange={e=>update({uncertainty:e.target.value})}/></label>
        <label>Observation time (UTC)<input aria-label="Field observation UTC" type="datetime-local" step="1" required value={draft.observedAt.slice(0,19)} onChange={e=>{if(e.target.value)update({observedAt:`${e.target.value.length===16?e.target.value+':00':e.target.value}Z`});}}/></label>
        {(draft.kind==='temperature'||draft.kind==='radiation')&&<label>Reading ({unitFor(draft.kind)})<NumberInput key={`${draft.id}-reading`} aria-label="Field reading" min="0" max={draft.kind==='temperature'?1000:1000000} step="any" value={draft.value??0} onValue={value=>update({value})}/></label>}
        {draft.kind==='obstacle'&&<><label>Declared radius (m)<NumberInput key={`${draft.id}-radius`} aria-label="Field obstacle radius" min="5" max="500" step="1" value={draft.radiusM??40} onValue={radiusM=>update({radiusM})}/></label><label className="field-check"><input aria-label="Restrict travel" type="checkbox" checked={draft.restrictTravel} onChange={e=>update({restrictTravel:e.target.checked})}/>Restrict routes and walking</label></>}
        <fieldset><legend>{draft.kind==='unit'?'Draw a geological polygon':draft.kind==='contact'?'Draw a geological contact':'Record location'}</legend>
          <p className="caption">Local meters in the prepared Gale footprint. Geometry is a user interpretation, not a terrain edit.</p>
          {!['unit','contact'].includes(draft.kind)&&<div className="coordinate-inputs">{(['x','y'] as const).map((key,i)=><label key={key}>{i===0?'Easting':'Northing'} (m)<NumberInput key={`${draft.id}-${key}`} aria-label={`Field ${i===0?'easting':'northing'}`} step="any" min="-1000" max="1000" value={draft.points[0]?.[key]??0} onValue={value=>update({points:[{...(draft.points[0]??{x:0,y:0}),[key]:value}],context:{...draft.context,positionSource:'manual-coordinates'}})}/></label>)}</div>}
          <div className="button-row"><button className="secondary" type="button" aria-pressed={picking} onClick={()=>setPicking(!picking)}>{picking?'Finish map picking':'Pick / draw on map'}</button>{!['unit','contact'].includes(draft.kind)&&<button className="secondary" type="button" onClick={()=>{const context=newFieldRecord(draft.kind,p.pose,p.pose,p.departureHour,'simulated-pose').context;update({points:[{x:p.pose.x,y:p.pose.y}],context});setPicking(false);}}>Use astronaut position</button>}</div>
          {draft.points.length>1&&<><ol className="field-vertices">{draft.points.map((q,i)=><li key={i}>E {q.x.toFixed(1)} / N {q.y.toFixed(1)} m <button type="button" aria-label={`Remove vertex ${i+1}`} onClick={()=>update({points:draft.points.filter((_,j)=>j!==i)})}>Remove</button></li>)}</ol><button className="text-button" type="button" onClick={()=>update({points:draft.points.slice(0,-1)})}>Undo last vertex</button></>}
        </fieldset><p className="field-effect">{effectLabel(draft)}</p><div className="button-row"><button className="primary" type="submit">Save field record</button><button className="secondary" type="button" onClick={()=>{p.onDraft(undefined);setPicking(false);}}>Cancel draft</button></div>
      </form>}
      {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="field-status" role="status">{message}</p>}
      <section className="field-library" aria-label="Saved field records"><h2>Field records <span>{p.records.length}/100</span></h2><button className="secondary" disabled={!p.canUndo||!!draft} onClick={()=>{try{p.onUndo();p.onDraft(undefined);setMessage('Last layer edit undone.');setError('');}catch(e){setError((e as Error).message);}}}>Undo last layer edit</button>
        {!p.records.length&&<p className="caption">No personal records yet. Published geological layers and historical readings remain available in Explore.</p>}
        {p.records.map(r=><article className={r.id===p.selected?'selected':''} key={r.id}><button className="field-record-select" aria-pressed={r.id===p.selected} onClick={()=>p.onSelect(r.id)}>{r.title}<small>{KINDS[r.kind]}{r.value!==undefined?` · ${r.value} ${unitFor(r.kind)}`:''}</small></button><p className="caption">{effectLabel(r)}</p><label className="field-check"><input aria-label={`Show ${r.title}`} disabled={!!draft} type="checkbox" checked={r.visible} onChange={e=>commit(p.records.map(q=>q.id===r.id?{...q,visible:e.target.checked,updatedAt:new Date().toISOString()}:q),'Record display changed. Active restrictions remain enforced.')}/>Show annotation on map and HUD</label><div className="button-row"><button className="secondary" disabled={!!draft} onClick={()=>edit(r)}>Edit {r.title}</button><button className="text-button" disabled={!!draft} onClick={()=>{if(commit(p.records.filter(q=>q.id!==r.id),'Record deleted. Undo restores it.')){if(p.selected===r.id)p.onSelect(undefined);if(draft?.id===r.id)p.onDraft(undefined);}}}>Delete {r.title}</button></div></article>)}
      </section><section className="field-transfer"><h2>Keep a copy.</h2><p className="caption">Mars GeoJSON v1 · east-positive longitude / latitude, EPSG:104905. Import merges by record ID and can be undone. Saved records persist here; undo history is for this session.</p><button className="secondary" onClick={()=>download('martian-field-data.geojson',exportFields(p.records))}>Export field GeoJSON</button><label className="field-import">Import field GeoJSON<input aria-label="Import field GeoJSON" disabled={!!draft} type="file" accept=".json,.geojson,application/json,application/geo+json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2_000_000)throw new Error('Import files up to 2 MB.');const now=new Date().toISOString(),incoming=importFields(JSON.parse(await file.text())).map(r=>({...r,importedFrom:file.name.slice(0,200),importedAt:now}));if(incoming.some(r=>r.points.some(q=>!sample(p.data,q))))throw new Error('Imported vertices must lie on valid prepared terrain.');commit(mergeFields(latestRecords.current,incoming),`Imported ${incoming.length} record(s). Matching IDs were updated; Undo restores the previous layer.`);}catch(e){setError((e as Error).message);}}}/></label></section>
    </aside>
    <section className="field-map-pane"><header><span className="eyebrow">GALE / USER FIELD LAYER</span><h2>{picking?'Click or tap to add geometry.':'Explore your observations.'}</h2><p>{picking?'Drag to pan; scroll or pinch to zoom; click or tap to add points. Finish picking, then Save.':'Click / tap a field marker or select a record to inspect its source and time.'}</p></header><SurfaceMap active={p.active} mapLabel="Field observation map" data={p.data} start={{x:0,y:0}} goal={selectionPoint} selected={0} pose={p.pose} exclusions={p.exclusions} overlays={defaultOverlays()} fields={p.records} selectedField={p.selected} onFieldSelect={id=>{if(!picking)p.onSelect(id);}} draft={draft} mode={picking?'field':'inspect'} onPick={pick}/>
      <p className="caption">Cyan = user geology; amber = temperature; violet = detector reading; orange = declared obstacle. Active restriction outlines stay visible even when their annotation is hidden.</p>
      {selected?<FieldDetails record={selected}/>:<div className="field-detail"><h3>Separate evidence, shared landscape.</h3><p>Annotations change the map and scene. Only enabled circular restrictions affect routing and movement. Readings do not replace REMS/RAD or spread into surrounding cells.</p><p className="caption">Inspection point: {localToGeo(p.data.meta,p.inspection).map(v=>v.toFixed(5)).join(' / ')}° (longitude / latitude).</p></div>}
    </section>
  </main>;
}
