import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../design/icons';
import type { Alternative } from './data';
import { OPTION_LABEL, distanceText, durationText, fixLabel, resultLine, type FailureView, type Fix } from './routeFlow';

export interface MapRect { left: number; top: number; right: number; bottom: number; width: number }

/** The local map canvas, in this zero-height box's coordinates; the map sizes itself from its siblings, so the box adds no height. */
function useCanvasRect(box: React.RefObject<HTMLDivElement | null>) {
  const [rect, setRect] = useState<MapRect>();
  useLayoutEffect(() => {
    const el = box.current, workspace = el?.closest<HTMLElement>('.terrain-workspace');
    if (!el || !workspace) return;
    let frame = 0;
    const measure = () => {
      const canvas = workspace.querySelector<HTMLCanvasElement>('.surface-map canvas');
      if (!canvas) return;
      const c = canvas.getBoundingClientRect(), o = el.getBoundingClientRect();
      if (!c.width) return;
      setRect(r => {
        const next = { left: c.left - o.left, top: c.top - o.top, right: c.right - o.left, bottom: c.bottom - o.top, width: o.width };
        return r && Object.keys(next).every(k => Math.abs(r[k as keyof MapRect] - next[k as keyof MapRect]) < .5) ? r : next;
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(workspace);
    const canvas = workspace.querySelector('.surface-map canvas');
    if (canvas) observer.observe(canvas);
    window.addEventListener('resize', schedule);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); };
  });
  return rect;
}

const CARD_W = 330, GAP = 8;

/** The status card sits beside the map when there is room on its right, else over the map's lower right corner. */
export function placeStatus(map: MapRect): CSSProperties {
  const maxHeight = Math.max(120, map.bottom - map.top - 2 * GAP);
  if (map.width - map.right >= CARD_W + 2 * GAP) return { left: map.right + GAP, top: map.bottom, transform: 'translateY(-100%)', width: CARD_W, maxHeight };
  return { left: map.right - GAP, top: map.bottom - GAP, transform: 'translate(-100%, -100%)', width: Math.max(200, Math.min(CARD_W, map.right - map.left - 2 * GAP)), maxHeight };
}

export type StatusState =
  | { kind: 'planning' }
  | { kind: 'stale' }
  | { kind: 'done'; routes: Alternative[]; selected: number; warning?: { text: string; fix?: Fix } }
  | { kind: 'failed'; failure: FailureView; details?: ReactNode };

interface CardProps {
  state: StatusState; onSelect: (i: number) => void; onFix: (f: Fix) => void;
  onWalk: () => void; onPreview: () => void; inline?: boolean;
}

/** One line for the result, a compact choice of options, the two actions; or a plain reason and its one-click fix. */
export function RouteStatusCard({ state, onSelect, onFix, onWalk, onPreview, inline }: CardProps) {
  const cls = `map-status${inline ? ' map-status--inline' : ''}`;
  if (state.kind === 'planning' || state.kind === 'stale') return <div className={`${cls} is-busy`} role="status" aria-live="polite">
    <p className="map-status__title"><Icon name="route" />{state.kind === 'planning' ? 'Planning route…' : 'Start or destination changed. Planning again…'}</p>
  </div>;
  if (state.kind === 'failed') return <div className={`${cls} is-failed`} role="alert" aria-label="Why no route exists">
    <p className="map-status__title"><Icon name="warning" />{state.failure.title}</p>
    <p className="map-status__line">{state.failure.reason}</p>
    {state.failure.fixes.length > 0 && <div className="map-status__actions">{state.failure.fixes.map((f, i) =>
      <button key={`${f.kind}-${i}`} type="button" className={i === 0 ? 'map-status__go' : 'secondary'} onClick={() => onFix(f)}>{fixLabel(f)}</button>)}</div>}
    {state.details && <details className="map-status__details"><summary>Details</summary>{state.details}</details>}
  </div>;
  const route = state.routes[state.selected];
  return <div className={`${cls} is-done`} role="status" aria-live="polite" aria-label="Planned route">
    <p className="map-status__title"><Icon name="check" />Route ready</p>
    <p className="map-status__line">{resultLine(route)}</p>
    {state.routes.length > 1 && <div className="map-status__options" role="group" aria-label="Route options">{state.routes.map((r, i) =>
      <button key={r.mode} type="button" aria-pressed={i === state.selected} onClick={() => onSelect(i)}>
        <strong>{OPTION_LABEL[r.mode]}</strong><small>{r.mode === 'shortest' ? distanceText(r.metrics.distanceM) : `steepest ${r.metrics.maxSlopeDeg.toFixed(0)}°`}</small>
      </button>)}</div>}
    {state.warning && <p className="map-status__warn"><Icon name="warning" />{state.warning.text}{state.warning.fix && <> <button type="button" className="text-button" onClick={() => onFix(state.warning!.fix!)}>{fixLabel(state.warning.fix)}</button></>}</p>}
    <div className="map-status__actions">
      <button type="button" className="map-status__go" onClick={onWalk}>Walk this route</button>
      <button type="button" className="secondary" onClick={onPreview}><Icon name="play" />Preview route</button>
    </div>
    <p className="map-status__small">{durationText(route.roundTripS)} there and back</p>
  </div>;
}

/** The overlay layer over the local map: the pick hint at the top and the route status card. */
export default function MapStatusLayer({ hint, status }: { hint?: ReactNode; status?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null), rect = useCanvasRect(box);
  return <div ref={box} className="map-status-box">
    {rect && hint && <div className="map-hint" role="status" style={{ left: (rect.left + rect.right) / 2, top: rect.top + GAP }}>{hint}</div>}
    {rect && status && <div className="map-status-place" style={placeStatus(rect)}>{status}</div>}
  </div>;
}
