import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** One explanation on hover, keyboard focus or an explicit information button. */
export default function Help({label,children}:{label:string;children:ReactNode}){
  const id=useId(),button=useRef<HTMLButtonElement>(null);
  const [pinned,setPinned]=useState(false),[hover,setHover]=useState(false),[focused,setFocused]=useState(false);
  const [position,setPosition]=useState({left:12,top:12}),tip=useRef<HTMLSpanElement>(null);
  const open=pinned||hover||focused;
  useLayoutEffect(()=>{
    if(!open)return;
    function place(){const b=button.current?.getBoundingClientRect(),t=tip.current?.getBoundingClientRect();if(!b||!t)return;setPosition({left:Math.max(12,Math.min(innerWidth-t.width-12,b.left)),top:b.bottom+8+t.height<innerHeight-12?b.bottom+8:Math.max(12,b.top-t.height-8)});}
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[open]);
  return <span className={`help ${pinned?'help-pinned':''}`} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}><button ref={button} type="button" aria-label={label} aria-expanded={open} aria-describedby={open?id:undefined} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onClick={()=>{setPinned(v=>!v);setHover(false);setFocused(false);}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setPinned(false);setHover(false);setFocused(false);}}} className="info"><span className="info__glyph" aria-hidden="true">i</span></button>{open&&createPortal(<span ref={tip} className="help-tooltip" id={id} role="tooltip" style={position}>{children}</span>,document.body)}</span>;
}
