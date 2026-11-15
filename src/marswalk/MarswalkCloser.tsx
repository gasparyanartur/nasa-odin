import { useState } from 'react';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import { sample, type Alternative, type Point, type TerrainData } from '../mission/data';
import { CAUTION_FRACTION, LIMITS, checkPath, type LimitCheck } from './limits';
import { CURIOSITY_PATH, compareWithReference, curiosityLine, walkLengthM, type Separation, type Walk } from './pathlog';
import { AUTO_FADE, HAZARD_START, SEP_EVENT, type StormMessage, type StormState } from './storm';
import { fmt } from './ui';
import GroundPanorama from './GroundPanorama';

const STATUS_WORD: Record<LimitCheck['status'], string> = { ok: 'Within', caution: 'Close to limit', over: 'Over the limit', 'no data': 'No data' };
const sep = (s: Separation) => s.maxM === null ? 'No data' : `max ${s.maxM.toFixed(0)} m · mean ${s.meanM!.toFixed(0)} m`;
const points = (r: { points: [number, number, number][] }): Point[] => r.points.map(([x, y]) => ({ x, y }));

interface Props {
  route?: Alternative; science: boolean; routeName: string; data: TerrainData; habitat: Point; boxwork: boolean;
  /** Slope source for the route check when the route was planned on another slope map than the team 5 m grid. */
  slopeAt?: (p: Point) => number | null;
  walks: Walk[]; walksPersistent: boolean;
  spaceWeather: boolean; storm: StormState; stormMessage: StormMessage | null;
  onRunStorm: () => void; onCancelReturn: () => void; onResumeReturn: () => void; onResetStorm: () => void; onShowStorm: () => void;
}

/** Look closer additions: suit limits for the chosen route, Curiosity's path, saved walks and the solar storm scenario. */
export default function MarswalkCloser(p: Props) {
  const [compare, setCompare] = useState<string>();
  const path = p.route ? (p.science ? points(p.route) : [...points(p.route), ...points(p.route.returnRoute)]) : [];
  const checks = p.route ? checkPath({ path, rover: p.habitat, durationH: p.route.roundTripS / 3600, slope: p.slopeAt ? { at: p.slopeAt, stepM: .5 } : { at: q => sample(p.data, q)?.slope, stepM: p.data.meta.stepM / 2 } }) : [];
  const chosenWalk = p.walks.find(w => w.id === compare);
  return <section className="closer-marswalk" aria-label="Limits, saved walks and scenario">
    {p.boxwork && <GroundPanorama />}
    <div className="wall-label closer-limits">
      <h2>Suit limits for the chosen route</h2>
      {p.route ? <>
        <p className="caption">{p.routeName}. Distances from the habitat H, where every walk starts and ends. Time includes the way back.</p>
        <table className="limits-table">
          <thead><tr><th scope="col">Limit</th><th scope="col">This route</th><th scope="col">Limit value</th><th scope="col">State</th></tr></thead>
          <tbody>{checks.map(c => <tr key={c.id} className={`is-${c.status.replace(' ', '-')}`}>
            <th scope="row">{c.label}<InfoMark title={c.label} does={c.method} source={LIMITS[c.id].source} coverage={`${LIMITS[c.id].body}. ${LIMITS[c.id].note}`} /></th>
            <td>{fmt(c.value, c.unit, c.unit === 'h' ? 2 : c.unit === 'deg' ? 1 : 0)}</td>
            <td>{fmt(c.limit, c.unit)}</td>
            <td>{STATUS_WORD[c.status]}</td>
          </tr>)}</tbody>
        </table>
        <p className="caption">One astronaut is simulated, so the distance between the two reads no data. Close to limit means a margin under {CAUTION_FRACTION.value * 100} percent, a Marswalk design choice.</p>
      </> : <p>Choose a route under Routes to check it against the suit limits.</p>}
    </div>
    {p.boxwork && <div className="wall-label">
      <h2>Against Curiosity's path <InfoMark title="Curiosity path" does="Measures, for every point of the route, the straight distance to the nearest part of the path Curiosity drove." source="NASA/JPL MMGIS: MSL waypoints. NASA/PDS public data; no licence is stated on the source page." /></h2>
      <p>{p.route ? `${p.routeName}: ${sep(compareWithReference(path, curiosityLine()))} from the path Curiosity drove.` : 'Choose a route to compare it with the path Curiosity drove.'}</p>
      <p className="caption">Curiosity drove sols {CURIOSITY_PATH.sols[0]} to {CURIOSITY_PATH.sols[1]}, {CURIOSITY_PATH.count} waypoints. A rover track is a record, not proof that the ground is safe on foot.</p>
    </div>}
    <div className="wall-label">
      <h2>Saved walks</h2>
      {p.walks.length ? <ul className="saved-walks">{p.walks.map((w, i) => <li key={w.id} className={w.id === compare ? 'is-chosen' : undefined}>
        <span><strong>{w.label}</strong><small>{walkLengthM(w).toFixed(0)} m walked · {w.samples.length} points</small></span>
        <button type="button" className="secondary" aria-pressed={w.id === compare} aria-label={`Compare saved walk ${i + 1}`} onClick={() => setCompare(w.id === compare ? undefined : w.id)}>Compare</button>
      </li>)}</ul> : <p>No saved walks yet. A walk saves when you open this tablet or end the excursion.</p>}
      {chosenWalk && <dl className="walk-compare">
        {p.boxwork && <div><dt>From Curiosity's path</dt><dd>{sep(compareWithReference(chosenWalk.samples, curiosityLine()))}</dd></div>}
        <div><dt>From the chosen route</dt><dd>{p.route ? sep(compareWithReference(chosenWalk.samples, points(p.route))) : 'No route chosen'}</dd></div>
        {p.walks.filter(w => w.id !== chosenWalk.id).slice(-1).map(w => <div key={w.id}><dt>From {w.label}</dt><dd>{sep(compareWithReference(chosenWalk.samples, w.samples))}</dd></div>)}
      </dl>}
      <p className="caption">{p.walksPersistent ? 'Kept in this browser.' : 'This browser blocks storage: walks last until the page reloads.'} One point is kept per {p.data.meta.stepM} m walked.</p>
    </div>
    <div className="wall-label closer-storm">
      <h2>Solar storm <span className="origin-tag is-scenario">scenario</span></h2>
      <p>{SEP_EVENT.note} Event {SEP_EVENT.id}, {SEP_EVENT.instrument}.</p>
      {p.stormMessage ? <>
        <p className="closer-storm__state"><Icon name="warning" />{p.stormMessage.headline}, scenario. {p.stormMessage.advice}</p>
        <div className="button-row">
          {p.storm.returning ? <button type="button" className="secondary" onClick={p.onCancelReturn}>Cancel return</button> : <button type="button" className="secondary" onClick={p.onResumeReturn}>Restart the way back</button>}
          {p.storm.warning !== 'shown' && <button type="button" className="secondary" onClick={p.onShowStorm}>Show the notice again</button>}
          <button type="button" className="text-button" onClick={p.onResetStorm}>End the scenario</button>
        </div>
      </> : <button type="button" className="secondary closer-storm__run" disabled={!p.spaceWeather} onClick={p.onRunStorm}><Icon name="sun" />Run the solar storm scenario</button>}
      <p className="caption">{p.spaceWeather ? `With Space weather on, it also starts by itself ${HAZARD_START.value} ${HAZARD_START.unit} into a walk (an assumption). The helmet notice fades to the side list after about ${AUTO_FADE.value / 1000} s.` : 'Space weather is off for this walk. Switch it on under Display to run the scenario.'}</p>
      <p className="caption">{SEP_EVENT.citation} <a href={SEP_EVENT.link} target="_blank" rel="noreferrer">DONKI event ↗</a></p>
    </div>
  </section>;
}
