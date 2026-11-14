import { SCIENCE, type GeologySelection, type GeologySettings } from './datasets/geology';
import type { RegionId } from './datasets/catalog';

export default function GeologyPanel({regionId,settings,selection,onSettings,onSelect,onContext,compact=false}:{regionId:RegionId;settings:GeologySettings;selection?:GeologySelection;onSettings:(s:GeologySettings)=>void;onSelect:(s:GeologySelection)=>void;onContext?:()=>void;compact?:boolean}) {
  const region=SCIENCE.regions[regionId];
  const unit=selection?.kind==='unit'?region.units.find(u=>u.id===selection.id):undefined;
  const contact=selection?.kind==='contact'?region.contacts.find(c=>c.id===selection.id):undefined;
  const legend=region.units.filter((u,i,a)=>a.findIndex(other=>other.code===u.code)===i);
  return <section className="geology-panel" aria-label="Geological context">
    <div className="section-label">GEOLOGICAL INTERPRETATION <span className="tag">{SCIENCE.mapScale}</span></div>
    <label className="check"><input aria-label="Geological units" type="checkbox" checked={settings.visible} onChange={e=>onSettings({...settings,visible:e.target.checked})}/>USGS geological units</label>
    {settings.visible&&<><label className="check"><input aria-label="Geological contacts" type="checkbox" checked={settings.contacts} onChange={e=>onSettings({...settings,contacts:e.target.checked})}/>Published contacts · dashed = approximate</label><label className="overlay-opacity">Geology opacity <output>{Math.round(settings.opacity*100)}%</output><input aria-label="Geology opacity" type="range" min="0" max="100" value={settings.opacity*100} onChange={e=>onSettings({...settings,opacity:Number(e.target.value)/100})}/></label>
    {onContext&&<button className="secondary full" onClick={onContext}>View geological context ↗</button>}
    <details className="geology-inspection" open={compact?undefined:true}><summary>Unit legend and geological inspection</summary><div className="geology-legend" aria-label="Geological unit legend">{legend.map(u=><button key={u.code} aria-pressed={unit?.code===u.code} onClick={()=>onSelect({kind:'unit',id:u.id})}><i style={{background:u.color}}/><span><b>{u.code}</b> {u.name}</span></button>)}</div>
    <details><summary>Inspect mapped contacts ({region.contacts.length})</summary><div className="contact-list">{region.contacts.map(c=><button className="text-button" key={c.id} aria-pressed={contact?.id===c.id} onClick={()=>onSelect({kind:'contact',id:c.id})}>Contact {c.id} · {c.type}</button>)}</div></details>
    {unit&&<article className="geology-detail" aria-label="Selected geological unit"><span className="data-kind">PUBLISHED INTERPRETATION</span><h3>{unit.code} · {unit.name}</h3><p>{unit.interpretation}</p><details><summary>Mapped characteristics</summary><p>{unit.characteristics}</p></details><p className="caption">{unit.group} · source feature {unit.id} · published {SCIENCE.publicationYear}</p></article>}
    {contact&&<article className="geology-detail" aria-label="Selected geological contact"><h3>Contact {contact.id}</h3><p>Published classification: {contact.type}. This line separates mapped regional units; its source-map confidence does not establish local positional accuracy.</p></article>}
    </details></>}
    <p className="caption">Regional context for {regionId==='gale-bradbury'?'Gale':'Jezero'} only. Too coarse to identify local outcrops or set walking hazards.</p>
    <details className="source-details"><summary>Geology source, coverage and scale</summary><p>{SCIENCE.publication}</p><p>{SCIENCE.coordinateReference}</p><p>Coverage: {region.bounds.join(', ')}° (west, south, east, north). {SCIENCE.processing}</p><p>{SCIENCE.limitation}</p><a href={SCIENCE.sourceUrl} target="_blank" rel="noreferrer">USGS publication ↗</a> · <a href={SCIENCE.serviceUrl} target="_blank" rel="noreferrer">USGS feature service ↗</a></details>
  </section>;
}
