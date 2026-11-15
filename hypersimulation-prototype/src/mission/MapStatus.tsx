import type { ReactNode } from 'react';
import { Icon } from '../design/icons';
import type { Alternative } from './data';
import { OPTION_LABEL, distanceText, durationText, fixLabel, resultLine, type FailureView, type Fix } from './routeFlow';

export type StatusState =
  | { kind: 'planning' }
  | { kind: 'stale' }
  | { kind: 'done'; routes: Alternative[]; selected: number; warning?: { text: string; fix?: Fix } }
  | { kind: 'failed'; failure: FailureView; details?: ReactNode };

interface CardProps {
  state: StatusState; onSelect: (i: number) => void; onFix: (f: Fix) => void;
  onWalk: () => void; onPreview: () => void; inline?: boolean;
}

/**
 * The route status, docked under the local map so it never covers the route line: one title line, one line of
 * numbers, the options in one row, the actions in one row; or a plain reason and its one-click fix.
 */
export function RouteStatusCard({ state, onSelect, onFix, onWalk, onPreview, inline }: CardProps) {
  const cls = `map-status${inline ? ' map-status--inline' : ' map-status--dock'}`;
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
  const line = `${resultLine(route)} · ${durationText(route.roundTripS)} there and back`;
  return <div className={`${cls} is-done`} role="status" aria-live="polite" aria-label="Planned route">
    <p className="map-status__title"><Icon name="check" />Route ready</p>
    <p className="map-status__line" title={line}>{line}</p>
    {state.routes.length > 1 && <div className="map-status__options" role="group" aria-label="Route options">{state.routes.map((r, i) =>
      <button key={r.mode} type="button" aria-pressed={i === state.selected} onClick={() => onSelect(i)}>
        <strong>{OPTION_LABEL[r.mode]}</strong><small>{r.mode === 'shortest' ? distanceText(r.metrics.distanceM) : `steepest ${r.metrics.maxSlopeDeg.toFixed(0)}°`}</small>
      </button>)}</div>}
    {state.warning && <p className="map-status__warn"><Icon name="warning" />{state.warning.text}{state.warning.fix && <> <button type="button" className="text-button" onClick={() => onFix(state.warning!.fix!)}>{fixLabel(state.warning.fix)}</button></>}</p>}
    <div className="map-status__actions">
      <button type="button" className="map-status__go" onClick={onWalk}>Walk this route</button>
      <button type="button" className="secondary" onClick={onPreview}><Icon name="play" />Preview route</button>
    </div>
  </div>;
}
