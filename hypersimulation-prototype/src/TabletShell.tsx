import { useEffect, useRef, type ReactNode } from 'react';

/** Keep tool state mounted while the astronaut opens and closes the tablet. */
export default function TabletShell({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const el=dialog.current!;
    const controls=()=>Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(node=>node.getClientRects().length>0);
    (controls()[0]??el).focus();
    function key(event:KeyboardEvent){
      if(event.key==='Escape'&&(event.target as HTMLElement).closest('.help-pinned'))return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
      if(event.key==='Tab'){
        const items=controls(),first=items[0],last=items.at(-1);
        if(!first){event.preventDefault();el.focus();}
        else if(event.shiftKey&&(document.activeElement===first||document.activeElement===el||!el.contains(document.activeElement))){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!el.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
    }
    // Saving a form can remove the focused button; Escape/Tab must still belong to the device.
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
  },[open]);
  return <div className="tablet-backdrop" hidden={!open}><div ref={dialog} className="tablet-device" role="dialog" aria-modal="true" aria-label={`${title} astronaut tablet`} tabIndex={-1}>{children}</div></div>;
}
