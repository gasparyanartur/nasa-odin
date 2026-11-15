import InfoMark from '../design/InfoMark';
import { HAZARD_ZONES, LEGEND, type HatchId } from './hazards';

const LINE = '#FFF3D6', CASE = 'rgba(14,11,9,.82)';
const lines = (deg: number) => `repeating-linear-gradient(${deg}deg, ${CASE} 0 1px, ${LINE} 1px 2.4px, ${CASE} 2.4px 3.4px, transparent 3.4px 9px)`;

/** CSS swatches drawn like the map hatch: light lines with a dark casing, nothing under them. */
export const HATCH_SWATCH: Partial<Record<HatchId, string>> = {
  'hatch-scarp': `${lines(0)}, ${lines(90)}`,
  'hatch-loose': `${lines(45)}, ${lines(-45)}`,
};

const USED = [...new Set(HAZARD_ZONES.map(z => z.hatch))];

/** The small key in the map corner: one hatch per danger, what it means and where it comes from. */
export default function HazardLegend({ zones, stops, drills }: { zones: boolean; stops: boolean; drills: boolean }) {
  if (!zones && !stops && !drills) return null;
  return <details className="hazard-legend" open>
    <summary>Legend</summary>
    <table>
      <thead><tr><th scope="col">Mark</th><th scope="col">Meaning</th><th scope="col">Origin</th></tr></thead>
      <tbody>
        {zones && USED.map(h => <tr key={h}>
          <td><span className="hazard-legend__swatch" style={{ backgroundImage: HATCH_SWATCH[h] }} /></td>
          <td>{LEGEND[h].danger}</td>
          <td><span className={`origin-tag is-${LEGEND[h].origin}`}>{LEGEND[h].origin}</span><InfoMark title={LEGEND[h].danger} does="The route planner keeps the science walk out of this area. Your own steps are not blocked; the helmet shows a hazard symbol when you are inside or near it." source={LEGEND[h].note} coverage={HAZARD_ZONES.filter(z => z.hatch === h).map(z => z.label).join('; ')} /></td>
        </tr>)}
        {stops && <tr><td><span className="map-mark map-mark--stop">1</span></td><td>Science stop, tap for its task</td><td><span className="origin-tag is-assumption">assumption</span></td></tr>}
        {drills && <tr><td><span className="map-mark map-mark--drill" /></td><td>Curiosity drill site, approximate</td><td><span className="origin-tag is-source">source</span></td></tr>}
      </tbody>
    </table>
  </details>;
}
