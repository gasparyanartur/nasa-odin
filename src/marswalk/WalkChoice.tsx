import { useLayoutEffect, useRef } from 'react';
import type { RegionId } from '../datasets/catalog';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import { MISSIONS, summary, type MissionId, type Setup } from './presets';
import { MISSION_ICON, WORD_STATE_TEXT, missionWords } from './ui';

/** Station step two: pick a mission preset for the chosen region. Every feature stays switchable in the tablet Display tool. */
export default function WalkChoice({ setup, region, persistent, onPick }: { setup: Setup; region: RegionId; persistent: boolean; onPick: (m: MissionId) => void }) {
  const box = useRef<HTMLElement>(null);
  // The region card above sits on this block's measured height, so neither covers the other at any window size.
  useLayoutEffect(() => {
    const el = box.current, panel = el?.closest<HTMLElement>('.map-panel');
    if (!el || !panel) return;
    const set = () => panel.style.setProperty('--walk-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(set);
    observer.observe(el); set();
    return () => { observer.disconnect(); panel.style.removeProperty('--walk-h'); };
  }, []);
  return <section ref={box} className="walk-choice" aria-label="Choose your walk">
    <header className="walk-choice__head">
      <span className="eyebrow">02 / CHOOSE YOUR WALK</span>
      <span className="walk-choice__note">Change any feature later in the tablet, under Display.{persistent ? '' : ' Storage is blocked in this browser: the choice lasts until the page reloads.'}</span>
    </header>
    <div className="walk-choice__cards">{MISSIONS.map(m => {
      const chosen = setup.mission === m.id;
      const words = missionWords(m.id, region);
      const s = summary({ ...setup, region, mission: m.id, features: m.features });
      return <article key={m.id} className={`walk-card${chosen ? ' is-chosen' : ''}`}>
        <button type="button" className="walk-card__pick" aria-pressed={chosen} onClick={() => onPick(m.id)}>
          <Icon name={MISSION_ICON[m.id]} />
          <strong>{m.label}</strong>
          <span>{m.sentence}</span>
        </button>
        <InfoMark title={m.label} does={m.id === 'custom' ? 'Keeps your current switches and lets you set every feature yourself in the tablet Display tool.' : `${m.sentence} Turns on ${s.turnsOn.length} features here and keeps ${s.alwaysOn.length} safety features always on. ${s.unavailable.length} features have no data in this region.`} source="Feature sets from the Marswalk app; availability per region checked against this app's data files (src/marswalk/EVIDENCE.md)." />
        <ul className="walk-card__words" aria-label={`${m.label} turns on`}>{m.id === 'custom'
          ? <li>Every switch, in the tablet Display tool</li>
          : words.map(w => w.state === 'on' ? <li key={w.word}>{w.word}</li> : <li key={w.word} className="is-off" title={w.note || undefined}><s>{w.word}</s> <em>{WORD_STATE_TEXT[w.state]}</em></li>)}</ul>
      </article>;
    })}</div>
  </section>;
}
