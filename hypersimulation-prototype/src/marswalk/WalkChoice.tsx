import { useEffect, useRef } from 'react';
import type { RegionId } from '../datasets/catalog';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import { MISSIONS, summary, type MissionId, type Setup } from './presets';
import { MISSION_ICON, WORD_STATE_TEXT, missionWords } from './ui';

/**
 * Station step two, in the left rail under the region list: one compact row per mission preset. The sentence and the
 * "turns on" words show under the chosen row only and in each row's info mark. Every feature stays switchable in the
 * tablet Display tool.
 */
export default function WalkChoice({ setup, region, persistent, onPick }: { setup: Setup; region: RegionId; persistent: boolean; onPick: (m: MissionId) => void }) {
  const box = useRef<HTMLElement>(null);
  // A new region brings step two into view in the rail, which scrolls on short windows.
  useEffect(() => { box.current?.scrollIntoView?.({ block: 'nearest' }); }, [region]);
  return <section ref={box} className="walk-choice" aria-label="Choose your task">
    <div className="section-label">02 / CHOOSE YOUR TASK</div>
    <ul className="walk-choice__rows">{MISSIONS.map(m => {
      const chosen = setup.mission === m.id;
      const words = missionWords(m.id, region);
      const s = summary({ ...setup, region, mission: m.id, features: m.features });
      const list = <ul className="walk-row__words" aria-label={`${m.label} turns on`}>{m.id === 'custom'
        ? <li>Every switch, in the tablet Display tool</li>
        : words.map(w => w.state === 'on' ? <li key={w.word}>{w.word}</li> : <li key={w.word} className="is-off" title={w.note || undefined}><s>{w.word}</s> <em>{WORD_STATE_TEXT[w.state]}</em></li>)}</ul>;
      return <li key={m.id} className={`walk-row${chosen ? ' is-chosen' : ''}`}>
        <div className="walk-row__head">
          <button type="button" className="walk-row__pick" data-tour={`task-${m.id}`} aria-pressed={chosen} onClick={() => onPick(m.id)}>
            <Icon name={MISSION_ICON[m.id]} />
            <strong>{m.label}</strong>
          </button>
          <InfoMark title={m.label} tour={`task-info-${m.id}`}
            does={m.id === 'custom' ? 'Keeps your current switches and lets you set every feature yourself in the tablet Display tool.' : `${m.sentence} Turns on ${s.turnsOn.length} features here and keeps ${s.alwaysOn.length} safety features always on. ${s.unavailable.length} features have no data in this region.`}
            source="The feature sets come from the Marswalk team. Each feature is marked on or off for this region by whether its data (NASA orbital images and terrain, Curiosity instruments, USGS maps) covers the region.">
            {m.id === 'custom' ? null : <><p className="walk-row__more-label">Turns on here</p>{list}</>}
          </InfoMark>
        </div>
        {chosen && <div className="walk-row__detail"><p>{m.sentence}</p>{list}</div>}
      </li>;
    })}</ul>
    <p className="caption walk-choice__note">Change any feature later in the tablet, under Display.{persistent ? '' : ' Storage is blocked in this browser: the choice lasts until the page reloads.'}</p>
  </section>;
}
