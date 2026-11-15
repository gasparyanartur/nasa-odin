import { Icon } from '../design/icons';
import InfoMark from '../design/InfoMark';
import { WALK_STOPS } from './sciencewalk';

/** The full task of a tapped stop, shown on the tablet only; the helmet keeps the short line. */
export default function StopCard({ id, visited, onClose }: { id: number; visited: boolean; onClose: () => void }) {
  const stop = WALK_STOPS.find(s => s.id === id);
  if (!stop) return null;
  return <aside className="stop-card wall-label" aria-label={`Stop ${stop.id} task`}>
    <span className="wall-label__kicker"><Icon name={stop.kind === 'ridge' ? 'ridge' : 'hollow'} />Stop {stop.id} of {WALK_STOPS.length} · {stop.kind}{visited ? ' · reached' : ''}</span>
    <p className="stop-card__task">{stop.task}</p>
    <p className="caption">In the helmet: “{stop.short}”</p>
    <p className="caption">Relief {stop.reliefM > 0 ? '+' : ''}{stop.reliefM.toFixed(2)} m, {stop.reliefNote}. <span className="origin-tag is-assumption">{stop.origin}</span>
      <InfoMark title={`Stop ${stop.id} origin`} does="Where this stop and its task come from." source={stop.originNote} /></p>
    <button type="button" className="secondary" onClick={onClose}>Close stop</button>
  </aside>;
}
