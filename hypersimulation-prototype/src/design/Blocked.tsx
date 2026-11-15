import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface BlockAction { label: string; run: () => void }
export interface BlockInfo { reason: string; fix?: BlockAction; more?: BlockAction }

// A blocked control stays focusable and clickable (aria-disabled, never disabled), so it can say why on click, tap,
// hover and keyboard focus, and offer the step that removes the blocker. The note is position: fixed, like InfoMark;
// no ancestor may carry a transform. Only one note is open at a time.
let closeOpen: (() => void) | null = null;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { block?: BlockInfo; children: ReactNode; 'data-tour'?: string };

export default function BlockedButton({ block, children, onClick, className, ...rest }: Props) {
  if (!block) return <button type="button" className={className} onClick={onClick} {...rest}>{children}</button>;
  return <Blocked block={block} className={className} rest={rest}>{children}</Blocked>;
}

function Blocked({ block, className, rest, children }: { block: BlockInfo; className?: string; rest: Omit<Props, 'block' | 'children' | 'onClick' | 'className'>; children: ReactNode }) {
  const id = useId().replace(/:/g, ''), noteId = `blocked-${id}`;
  const [open, setOpen] = useState(false), [pinned, setPinned] = useState(false);
  const button = useRef<HTMLButtonElement>(null), note = useRef<HTMLDivElement>(null), leave = useRef<number | undefined>(undefined);
  const close = useCallback(() => { setOpen(false); setPinned(false); }, []);
  const show = useCallback((pin: boolean) => {
    window.clearTimeout(leave.current);
    if (closeOpen && closeOpen !== close) closeOpen();
    closeOpen = close; setOpen(true); if (pin) setPinned(true);
  }, [close]);
  useEffect(() => () => { if (closeOpen === close) closeOpen = null; window.clearTimeout(leave.current); }, [close]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = button.current?.getBoundingClientRect(), el = note.current;
      if (!b || !el) return;
      const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      const left = Math.max(8, Math.min(vw - w - 8, b.left + b.width / 2 - w / 2));
      let top = b.bottom + 6;
      if (top + h > vh - 8) top = Math.max(8, b.top - 6 - h);
      el.style.left = `${Math.round(left)}px`; el.style.top = `${Math.round(top)}px`;
    };
    place();
    const key = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.stopPropagation(); e.preventDefault(); close(); button.current?.focus(); };
    const outside = (e: PointerEvent) => { const t = e.target as Node; if (!button.current?.contains(t) && !note.current?.contains(t)) close(); };
    document.addEventListener('keydown', key, true); document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, close]);
  const hoverOut = () => { if (pinned) return; leave.current = window.setTimeout(close, 200); };
  const blur = (e: React.FocusEvent) => { const next = e.relatedTarget as Node | null; if (!pinned && !(next && (button.current?.contains(next) || note.current?.contains(next)))) close(); };
  const act = (a: BlockAction) => () => { close(); a.run(); };
  return <span className="blocked-wrap">
    <button ref={button} type="button" {...rest} className={`${className ?? ''} is-blocked`.trim()} aria-disabled="true" aria-describedby={noteId}
      onClick={e => { e.preventDefault(); e.stopPropagation(); if (open && pinned) close(); else show(true); }}
      onMouseEnter={() => show(false)} onMouseLeave={hoverOut} onFocus={() => show(false)} onBlur={blur}>{children}</button>
    <div ref={note} id={noteId} className="blocked-note" role="status" hidden={!open} onMouseEnter={() => window.clearTimeout(leave.current)} onMouseLeave={hoverOut} onBlur={blur}>
      <p>{block.reason}</p>
      {(block.fix || block.more) && <div className="blocked-note__actions">
        {block.fix && <button type="button" className="blocked-note__fix" onClick={act(block.fix)}>{block.fix.label}</button>}
        {block.more && <button type="button" className="text-button blocked-note__more" onClick={act(block.more)}>{block.more.label}</button>}
      </div>}
    </div>
  </span>;
}
