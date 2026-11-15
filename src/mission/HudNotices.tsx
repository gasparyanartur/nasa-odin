import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../design/icons';

export interface HudNotice { text: string; kind: 'warning' | 'success' }
interface Toast { id: number; notice: HudNotice }
interface Entry { text: string; kind: HudNotice['kind']; active: boolean }

const TOAST_MS = 10_000;
const RULES: [RegExp, IconName, string][] = [
  [/^Historical temperature unavailable/, 'thermo', 'Temperature unknown'],
  [/^Current temperature is below/, 'thermo', 'Below temperature limit'],
  [/^Movement stopped/, 'nogo', 'Movement stopped'],
  [/off the planned route/, 'route', 'Off the planned route'],
  [/^Elapsed time exceeds/, 'time', 'Over the time budget'],
  [/detector-dose proxy exceeds/, 'radiation', 'Over the dose budget'],
  [/return estimate exceeds/, 'back', 'Return over the time budget'],
];

/** The pictogram and the one short line a helmet notice gets; the full sentence stays in the list and the Tablet. */
export function describeNotice(n: HudNotice): { icon: IconName; short: string } {
  if (n.kind === 'success') return { icon: 'check', short: 'Destination reached' };
  for (const [re, icon, short] of RULES) if (re.test(n.text)) return { icon, short };
  return { icon: 'warning', short: n.text };
}

/** Lives in App, so the log survives the HUD unmounting while the Tablet is open. */
export function useHudNotices(notices: HudNotice[]) {
  const [toasts, setToasts] = useState<Toast[]>([]), [log, setLog] = useState<Entry[]>([]);
  const seen = useRef(new Set<string>()), seq = useRef(0), timers = useRef(new Map<number, number>());
  const key = notices.map(n => `${n.kind}:${n.text}`).join('\n');
  const drop = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);
  useEffect(() => {
    const now = new Set(notices.map(n => n.text));
    const fresh = notices.filter(n => !seen.current.has(n.text));
    seen.current = now;
    const added = fresh.map(n => ({ id: ++seq.current, notice: n }));
    for (const t of added) timers.current.set(t.id, window.setTimeout(() => drop(t.id), TOAST_MS));
    // A notice that is no longer raised leaves the visor at once; it stays in the list as no longer raised.
    setToasts(t => [...t.filter(x => now.has(x.notice.text)), ...added].slice(-3));
    setLog(l => {
      const map = new Map(l.map(e => [e.text, { ...e, active: now.has(e.text) }]));
      for (const n of notices) map.set(n.text, { text: n.text, kind: n.kind, active: true });
      return [...map.values()].slice(-20);
    });
  }, [key]);
  useEffect(() => () => { for (const t of timers.current.values()) window.clearTimeout(t); }, []);
  const dismiss = useCallback(() => setToasts(t => { const last = t.at(-1); if (last) { window.clearTimeout(timers.current.get(last.id)); timers.current.delete(last.id); } return t.slice(0, -1); }), []);
  return { toasts, log, dismiss, drop };
}

/** One short line under the compass; the compass itself never moves. */
export function HudToast({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: () => void }) {
  const current = toasts.at(-1), shown = current && describeNotice(current.notice);
  return <div className="hud-alerts" aria-live="polite">{current && shown && <p key={current.id} className={`hud-toast ${current.notice.kind}`}>
      <Icon name={shown.icon} />
      <span className="hud-toast__text" title={current.notice.text}>{shown.short}</span>
      <span className="sr-only">{current.notice.text}</span>
      {current.notice.kind === 'warning' && <span className="hud-toast__tablet" title="Details on the Tablet"><Icon name="tablet" /><span className="sr-only">Details on the Tablet</span></span>}
      <button type="button" className="hud-toast__close" aria-label="Dismiss notice" onClick={onDismiss}><Icon name="close" /><kbd aria-hidden="true">X</kbd></button>
    </p>}</div>;
}

/** The notice symbol at the side, opening the small list of this excursion's notices. */
export function HudNoticeList({ log, open, onToggle, onDetails }: { log: Entry[]; open: boolean; onToggle: () => void; onDetails: () => void }) {
  const activeCount = log.filter(e => e.active && e.kind === 'warning').length;
  return <div className="hud-notices">
      <button type="button" className={`hud-notices__toggle ${activeCount ? 'is-warning' : ''}`} aria-expanded={open} aria-controls="hud-notice-list" aria-label={`Notices, ${activeCount} active`} onClick={onToggle}>
        <Icon name={activeCount ? 'warning' : 'bell'} /><span aria-hidden="true">{activeCount}</span><kbd aria-hidden="true">N</kbd>
      </button>
      {open && <section id="hud-notice-list" className="hud-notices__list" aria-label="Notice list">
        {log.length ? <ul>{[...log].reverse().map(e => { const d = describeNotice(e); return <li key={e.text} className={e.active ? 'is-active' : 'is-cleared'}>
          <Icon name={e.active ? d.icon : 'check'} /><span>{e.text}<small>{e.active ? 'Active' : 'No longer raised'}</small></span></li>; })}</ul>
          : <p>No notices this excursion.</p>}
        <button type="button" className="hud-notices__details" onClick={onDetails}><Icon name="tablet" />Details on the Tablet<kbd aria-hidden="true">T</kbd></button>
      </section>}
    </div>;
}
