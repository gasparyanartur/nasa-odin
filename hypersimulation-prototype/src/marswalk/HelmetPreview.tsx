import { Icon } from '../design/icons';
import type { HudSettings } from '../mission/HudSettings';
import { HATCH_SWATCH } from './HazardLegend';
import { effective, type Setup } from './presets';
import { WALK_STOPS } from './sciencewalk';

const RIM = 'M500 0C800 0 930 20 970 90C995 140 1000 200 1000 250C1000 300 995 360 970 410C930 480 800 500 500 500C200 500 70 480 30 410C5 360 0 300 0 250C0 200 5 140 30 90C70 20 200 0 500 0Z';

/** A small schematic of the helmet view for the current switches: which symbols and marks appear, not the terrain. */
export default function HelmetPreview({ setup, hud }: { setup: Setup; hud: HudSettings }) {
  const on = effective(setup);
  const compass = hud.visor, minimap = hud.minimap, clocks = hud.marsTime || hud.earthTime;
  const stops = on.stops && hud.waypoints, zones = on.nogo, first = WALK_STOPS[0];
  const shown = [compass && 'compass', minimap && (zones ? 'round minimap with hatched hazard areas' : 'round minimap'), clocks && 'clocks',
    stops && 'stop marks with number and short task', zones && 'hazard symbol in the status row', 'alert, time and return symbols'].filter(Boolean) as string[];
  const raised = ['RETURN NOW (scenario), with the way back', ...(on.stops ? ['arrival at a stop'] : [])];
  return <figure className="helmet-preview" data-tour="helmet-preview" aria-label="Helmet preview">
    <div className="helmet-preview__view" aria-hidden="true">
      <span className="helmet-preview__horizon" />
      {hud.visor && <svg className="helmet-preview__rim" viewBox="0 0 1000 500" preserveAspectRatio="none"><path d={RIM} /></svg>}
      {compass && <span className="helmet-preview__compass"><i /><i /><b>N</b><i /><i /></span>}
      {(minimap || clocks) && <span className="helmet-preview__corner">
        {minimap && <span className="helmet-preview__map">{zones && <span className="helmet-preview__zone" style={{ backgroundImage: HATCH_SWATCH['hatch-scarp'] }} />}<b>N</b></span>}
        {clocks && <span className="helmet-preview__pill"><Icon name="sun" />12:00</span>}
      </span>}
      {stops && <span className="helmet-preview__stop"><b>{first.id}</b><small>{first.short}</small></span>}
      <span className="helmet-preview__status">
        <span><Icon name="fine" /></span><span><Icon name="clock" /></span><span><Icon name="back" /></span>
        {zones && <span className="is-warning"><Icon name="nogo" /></span>}
      </span>
    </div>
    <figcaption>
      <strong>In the helmet now</strong>
      <span>{shown.join(' · ')}</span>
      <strong>Only when raised</strong>
      <span>{raised.join(' · ')}</span>
      <small>Schematic, not to scale. Details stay in this tablet.</small>
    </figcaption>
  </figure>;
}
