import { useId, useState, type ReactNode } from 'react';

/** The same explanation is available on hover, focus and a deliberate click. */
export default function Help({label,children}:{label:string;children:ReactNode}) {
  const id=useId(),[pinned,setPinned]=useState(false);
  return <span className={`help ${pinned?'help-pinned':''}`}><button type="button" aria-label={label} aria-expanded={pinned} aria-describedby={id} onClick={()=>setPinned(v=>!v)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setPinned(false);}}} className="info"><span className="info__glyph" aria-hidden="true">i</span></button><span id={id} role="tooltip">{children}</span></span>;
}
