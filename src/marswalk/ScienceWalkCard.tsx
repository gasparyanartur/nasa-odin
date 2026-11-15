import type { ReactNode } from 'react';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import { HAZARD_ZONES } from './hazards';
import { zoneBudget, ARRIVAL_M, type ScienceWalkPlan } from './sciencewalk';
import type { ScienceState } from './useMarswalk';

const km = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
const min = (s: number) => `${Math.ceil(s / 60)} min`;

/** The third route option on Boxwork: habitat, Stop 1 to Stop 8 in order, and back, planned leg by leg. */
export default function ScienceWalkCard({ state, selected, userRestrictions, onPlan, onSelect, failure }: {
  state: ScienceState; selected: boolean; userRestrictions: number; onPlan: () => void; onSelect: () => void; failure?: ReactNode;
}) {
  const plan: ScienceWalkPlan | undefined = state.status === 'done' ? state.plan : undefined;
  const free = zoneBudget(userRestrictions);
  const far = plan?.approaches.filter(a => a.gapM > 0) ?? [];
  return <section className="science-walk" aria-label="Science walk">
    <div className="section-label">SCIENCE WALK · BOXWORK</div>
    {plan ? <button type="button" className={`science-walk-card${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onSelect}>
      <span>03 / SCIENCE WALK, 8 STOPS<b>{km(plan.route.metrics.distanceM)}</b></span>
      <strong>{min(plan.route.metrics.durationS)} <small>walking, habitat to habitat</small></strong>
      <small>{plan.route.metrics.maxSlopeDeg.toFixed(1)}° max slope · {Math.round(plan.route.metrics.ascentM)} m ascent · time at the stops not counted</small>
      <small className={`condition-status ${plan.route.conditions.status}`}>{plan.route.conditions.status === 'within' ? 'Within configured limits' : plan.route.conditions.status === 'unknown' ? 'Conditions unknown' : 'Limits exceeded'}</small>
    </button> : <button type="button" className="science-walk-card is-empty" disabled={state.status === 'busy'} onClick={onPlan}>
      <span>03 / SCIENCE WALK, 8 STOPS</span>
      <strong><Icon name="stop" />{state.status === 'busy' ? `Planning leg ${state.leg + 1} of ${state.total}…` : 'Plan the science walk'}</strong>
      <small>Habitat, Stop 1 to Stop 8 in order, back to the habitat. Each leg uses the shortest permitted path.</small>
    </button>}
    {plan && <button type="button" className="text-button" onClick={onPlan}>Plan the science walk again</button>}
    <p className="caption science-walk__circles">
      <Icon name="nogo" />Avoids the {HAZARD_ZONES.length} hazard areas. The planner accepts only circles, so they are covered by {plan ? plan.restriction.exclusions.length : 'up to ' + Math.max(0, free)} circles{plan ? ` of ${plan.restriction.radiusM} m radius` : ''}, which can also block open ground just outside an area. {free} of 30 planner restrictions are free after your own {userRestrictions}.
      <InfoMark title="Circle approximation" does="The team planner takes restriction circles, at most 30 per request. Each hazard area is covered completely by circles on a grid; together they reach up to two circle radii beyond the area edge." source="src/marswalk/hazards.ts, toRestrictions; planner limits in server/app.py" coverage="The map and the helmet draw the real hazard outlines, never the circles." />
    </p>
    {plan && far.length > 0 && <p className="caption">Legs end within {ARRIVAL_M} m of a stop where the stop itself is steeper than the slope limit: {far.map(a => `Stop ${a.stop.id} ${a.gapM.toFixed(1)} m`).join(', ')}.</p>}
    {state.status === 'failed' && <div className="science-walk__failure">
      <strong>{state.failure.leg ? `Leg ${state.failure.leg.index + 1} of 9, ${state.failure.leg.from} to ${state.failure.leg.to}, has no permitted path.` : 'The science walk could not be planned.'}</strong>
      {failure ?? <p role="alert">{state.failure.message}</p>}
      <p className="caption">No route is drawn for a walk the planner did not return. The slope limit is under Mission assumptions and limits.</p>
    </div>}
  </section>;
}
