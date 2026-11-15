import type { ReactNode } from 'react';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import type { Point } from '../mission/data';
import { distance } from './frame';
import { HAZARD_ZONES } from './hazards';
import { PREPARED, hoursMinutes, kilometres, sourceLine } from './preparedRoute';
import { zoneBudget, ARRIVAL_M, type ScienceWalkPlan } from './sciencewalk';
import type { ScienceSource, ScienceState } from './useMarswalk';

const km = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
const min = (s: number) => `${Math.ceil(s / 60)} min`;

/**
 * The third route option on Boxwork: habitat, Stop 1 to Stop 8 in order, and back. By default it shows the route the
 * Marswalk planner prepared on the 1 m grid; "Re-plan with the route planner" plans it leg by leg with the team planner.
 */
export default function ScienceWalkCard({ state, selected, isDefault, source, habitat, userRestrictions, onPlan, onSelectPrepared, onSelectPlanned, failure }: {
  state: ScienceState; selected: boolean; isDefault: boolean; source: ScienceSource; habitat: Point; userRestrictions: number;
  onPlan: () => void; onSelectPrepared: () => void; onSelectPlanned: () => void; failure?: ReactNode;
}) {
  const plan: ScienceWalkPlan | undefined = state.status === 'done' ? state.plan : undefined;
  const showPlanned = !!plan && source === 'planned';
  const free = zoneBudget(userRestrictions);
  const far = plan?.approaches.filter(a => a.gapM > 0) ?? [];
  const t = PREPARED.totals, parts = t.parts;
  const fromHabitat = distance(PREPARED.base, habitat);
  return <section className="science-walk" data-tour="science-walk" aria-label="Science walk">
    <div className="section-label">SCIENCE WALK · BOXWORK<span className="tag">{selected ? 'SELECTED' : isDefault ? 'DEFAULT' : ''}</span></div>
    {showPlanned ? <button type="button" className={`science-walk-card${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onSelectPlanned}>
      <span>SCIENCE WALK, 8 STOPS<b>{km(plan.route.metrics.distanceM)}</b></span>
      <strong>{min(plan.route.metrics.durationS)} <small>walking, habitat to habitat</small></strong>
      <small>{plan.route.metrics.maxSlopeDeg.toFixed(1)}° max slope · {Math.round(plan.route.metrics.ascentM)} m ascent · time at the stops not counted</small>
      <small className={`condition-status ${plan.route.conditions.status}`}>{plan.route.conditions.status === 'within' ? 'Within configured limits' : plan.route.conditions.status === 'unknown' ? 'Conditions unknown' : 'Limits exceeded'}</small>
      <small className="science-walk__origin">Planned now by the team route planner on the 5 m grid</small>
    </button> : <button type="button" className={`science-walk-card${selected ? ' selected' : isDefault ? ' is-default' : ''}`} aria-pressed={selected} aria-label={`Prepared science walk, 8 stops: ${kilometres(t.distanceM)}, ${hoursMinutes(t.timeInSuitS)} in the suit`} data-testid="prepared-science-walk" onClick={onSelectPrepared}>
      <span>SCIENCE WALK, 8 STOPS<b>{kilometres(t.distanceM)}</b></span>
      <strong><span className="science-walk__value">{hoursMinutes(t.timeInSuitS)}</span> <small>in the suit, crew rover to crew rover</small></strong>
      <small>{min(parts.walkingS)} walking at {parts.walkingSpeedMps} m/s + {parts.stopCount} stops × {parts.workMinPerStop} min · both assumptions of the Marswalk team</small>
      <small>{t.steepestSlopeDeg.toFixed(1)}° steepest slope over a 5 m baseline · limit {t.slopeLimitDeg}° (a Moon value)</small>
      <small className="science-walk__origin">Planned by the Marswalk planner on the 1 m terrain grid</small>
    </button>}
    {(selected || isDefault) && <p className="caption science-walk__go">Walk this route, the blue bar below, starts it.</p>}
    <div className="caption science-walk__why">
      {showPlanned ? 'The team planner returned every leg.' : `Prepared route. It starts and ends at the crew rover, ${Math.round(fromHabitat)} m from the habitat H, and avoids the ${HAZARD_ZONES.length} hazard outlines exactly.`}
      <InfoMark title="Why a prepared route" does={<>This route comes from the Marswalk planner, which checks every 1 m cell against a 15 degree slope limit. The team planner checks a coarser 5 m grid and takes the steepest ground around each 5 m point, so on these narrow ridges it is stricter and can refuse the same walk.</>} source={<>Planned by the Marswalk planner on the USGS Astrogeology 1 m terrain model of Gale. {sourceLine('slope_cap')}. {sourceLine('walking_speed')}. {sourceLine('work_time_per_stop')}.</>} coverage="Time in the suit is distance over walking speed plus the work time at each stop, as the Marswalk app computes it. No temperature or dose conditions were evaluated for it. While you follow this route, each step is checked on the same 1 m slope map against your own slope limit under Mission assumptions and limits; free walking and the other routes use the 5 m grid. Marked hazard areas never stop a step: the helmet shows the hazard symbol." />
    </div>
    {showPlanned
      ? <button type="button" className="text-button" onClick={onSelectPrepared}>Use the prepared route instead</button>
      : plan ? <button type="button" className="text-button" onClick={onSelectPlanned}>Use the route planner result</button> : null}
    <details className="science-walk__more">
    <summary>Plan it again with the route planner</summary>
    <button type="button" className="secondary science-walk__replan" disabled={state.status === 'busy'} onClick={onPlan}>
      <Icon name="route" />{state.status === 'busy' ? `Planning leg ${state.leg + 1} of ${state.total}…` : 'Re-plan with the route planner'}
    </button>
    <div className="caption science-walk__circles">
      <Icon name="nogo" />The route planner avoids the {HAZARD_ZONES.length} hazard areas. It accepts only circles, so they are covered by {plan ? plan.restriction.exclusions.length : 'up to ' + Math.max(0, free)} circles{plan ? ` of ${plan.restriction.radiusM} m radius` : ''}, which can also block open ground just outside an area. {free} of 30 planner restrictions are free after your own {userRestrictions}.
      <InfoMark title="Circle approximation" does="The team planner takes restriction circles, at most 30 per request. Each hazard area is covered completely by circles on a grid; together they reach up to two circle radii beyond the area edge." source="The team route planner accepts circles of 5 to 500 m radius, at most 30 per request. The hazard areas are drawn by the Marswalk team (assumption)." coverage="The map and the helmet draw the real hazard outlines, never the circles." />
    </div>
    </details>
    {plan && far.length > 0 && <p className="caption">Legs end within {ARRIVAL_M} m of a stop where the stop itself is steeper than the slope limit: {far.map(a => `Stop ${a.stop.id} ${a.gapM.toFixed(1)} m`).join(', ')}.</p>}
    {state.status === 'failed' && <div className="science-walk__failure">
      <strong>{state.failure.leg ? `Leg ${state.failure.leg.index + 1} of 9, ${state.failure.leg.from} to ${state.failure.leg.to}, ${state.failure.diagnostics ? 'has no permitted path' : 'could not be planned'}.` : 'The science walk could not be planned.'}</strong>
      {failure ?? <p role="alert">{state.failure.message}</p>}
      <p className="caption">No route is drawn for a walk the planner did not return. The prepared route above stays available. The slope limit is under Mission assumptions and limits.</p>
    </div>}
  </section>;
}
