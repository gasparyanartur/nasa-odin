import { CURIOSITY_PATH } from './pathlog';
import { LIMITS } from './limits';
import { SEP_EVENT } from './storm';

/** Source and licence lines for the Marswalk data and the faces, as in src/marswalk/README.md and public/fonts/. */
export default function MarswalkCredits({ boxwork }: { boxwork: boolean }) {
  const limitSources = [...new Set(Object.values(LIMITS).map(l => l.source))];
  return <div className="marswalk-credits">
    <p><strong>Marswalk data</strong>{boxwork ? '' : ' (Boxwork walk area only)'}</p>
    <ul>
      <li>Science stops and tasks: chosen by the Marswalk team (assumption); relief from the USGS Astrogeology 1 m terrain. Data: Marswalk app, commit d2ed7bb0.</li>
      <li>Hazard areas: drawn by the Marswalk team (assumption); no published source.</li>
      <li>Drill sites: Curiosity rover position on the named sol, NASA Curiosity blog and NASA/JPL MMGIS MSL waypoints.</li>
      <li>Curiosity path: sols {CURIOSITY_PATH.sols[0]} to {CURIOSITY_PATH.sols[1]}, NASA/JPL MMGIS MSL waypoints. NASA/PDS public data; no licence is stated on the source page.</li>
      <li>Suit limits: {limitSources.join('; ')}. Only cited; nothing is copied from them.</li>
      <li>Solar storm scenario: {SEP_EVENT.citation}</li>
      <li>Walk choices and feature texts: project code under this repository's licence; each feature names its data owner.</li>
    </ul>
    <p><strong>Faces</strong> Gloock and Overpass, SIL Open Font License 1.1 (licence texts in public/fonts/).</p>
  </div>;
}
