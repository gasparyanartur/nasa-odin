import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// The small round "i" beside a switch, a layer or an option: what it does and where its data comes from.
// Opens on click (stays open), on hover and on keyboard focus + Enter or Space; closes on Escape (without closing the
// tablet behind it), on a click outside and when the pointer leaves an unpinned label. Only one is open at a time.
// The label is position: fixed in the window, so a scrolling panel never clips it; no ancestor may carry a transform.
let closeOpen: (() => void) | null = null;

export default function InfoMark({ title, does, source, coverage, children, align = 'end', tour }: {
  title: string; does?: ReactNode; source?: ReactNode; coverage?: ReactNode; children?: ReactNode; align?: 'start' | 'end'; tour?: string;
}) {
  const id = useId(), popId = `info-${id.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false), [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null), button = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null);
  const leave = useRef<number | undefined>(undefined);
  const close = useCallback(() => { setOpen(false); setPinned(false); }, []);

  const show = useCallback((pin: boolean) => {
    if (closeOpen && closeOpen !== close) closeOpen();
    closeOpen = close;
    setOpen(true);
    if (pin) setPinned(true);
  }, [close]);

  useEffect(() => () => { if (closeOpen === close) closeOpen = null; window.clearTimeout(leave.current); }, [close]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = button.current?.getBoundingClientRect(), el = pop.current;
      if (!b || !el) return;
      const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      let left = align === 'start' ? b.left : b.right - w;
      left = Math.max(8, Math.min(vw - w - 8, left));
      let top = b.bottom + 4;
      if (top + h > vh - 8 && b.top - 4 - h >= 8) top = b.top - 4 - h;
      top = Math.max(8, Math.min(vh - h - 8, top));
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
    };
    place();
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      close();
      if (wrap.current?.contains(document.activeElement)) button.current?.focus();
    };
    const outside = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, close]);

  const hoverIn = () => { window.clearTimeout(leave.current); if (!open) show(false); };
  const hoverOut = () => { if (pinned) return; leave.current = window.setTimeout(() => { if (!pinned) close(); }, 160); };
  const rows: [string, ReactNode][] = [['What it does', does], ['Source', source], ['Coverage', coverage]];

  return <span className="info-wrap" ref={wrap} data-open={open || undefined} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
    <button ref={button} type="button" className="info" data-tour={tour} aria-label={`About ${title}`} aria-expanded={open} aria-controls={popId}
      onClick={e => { e.stopPropagation(); if (open && pinned) close(); else show(true); }}>
      <span className="info__glyph" aria-hidden="true">i</span>
    </button>
    <div ref={pop} id={popId} className="info-pop" data-tour={tour && `${tour}-pop`} hidden={!open}>
      <p className="info-pop__title">{title}</p>
      <dl className="info-pop__rows">{rows.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) =>
        <div className="info-pop__row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {children && <div className="info-pop__more">{children}</div>}
    </div>
  </span>;
}
