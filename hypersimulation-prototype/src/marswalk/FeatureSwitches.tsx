import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import type { HudSettings } from '../mission/HudSettings';
import HelmetPreview from './HelmetPreview';
import { FEATURES, GROUPS, MISSIONS, effective, type FeatureId, type MissionId, type Setup } from './presets';
import { FEATURE_ICON, MISSION_ICON, stateWord } from './ui';

/** The Display tool's "infographic toggles": every preset feature as a labelled switch, grouped, with a live helmet preview. */
export default function FeatureSwitches({ setup, hud, onToggle, onMission }: { setup: Setup; hud: HudSettings; onToggle: (id: FeatureId) => void; onMission: (id: MissionId) => void }) {
  const on = effective(setup);
  return <section className="mission-features" aria-label="Mission features">
    <div className="mission-features__main">
      <div className="mission-features__top">
        <span className="eyebrow">TABLET / MISSION FEATURES</span>
        <h1>What your walk shows.</h1>
        <p className="subtle">A walk choice switches a set of features on. Change any switch and the walk becomes Custom. Nothing switches by itself at a stop.</p>
        <div className="mission-pick" role="group" aria-label="Walk choice">{MISSIONS.map(m =>
          <button key={m.id} type="button" className="mission-pick__item" aria-pressed={setup.mission === m.id} onClick={() => onMission(m.id)}><Icon name={MISSION_ICON[m.id]} />{m.label}</button>)}</div>
      </div>
    <div className="configuration-grid mission-features__groups">{GROUPS.map(g =>
      <fieldset key={g.id}><legend>{g.label}</legend>{FEATURES.filter(f => f.group === g.id).map(f => {
        const a = f.availability[setup.region], word = stateWord(on[f.id], f.locked, a.available, a.note);
        const live = a.available && !f.locked;
        return <div className={`setting-row feature-row${live ? '' : ' is-fixed'}`} key={f.id} data-state={word}>
          <label className="hud-setting">
            <input type="checkbox" aria-label={`${f.label} feature`} checked={on[f.id]} disabled={!live} onChange={() => onToggle(f.id)} />
            <Icon name={f.locked ? 'lock' : FEATURE_ICON[f.id]} />
            <span><strong>{f.label}</strong><small className="feature-row__state">{word}</small></span>
          </label>
          <InfoMark title={f.label} does={f.info} source={f.source || 'Built in this app; no external data.'} coverage={a.note || undefined} />
        </div>;
      })}</fieldset>)}
    </div>
    </div>
    <div className="mission-features__aside"><HelmetPreview setup={setup} hud={hud} /></div>
  </section>;
}
