import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import InfoMark from '../design/InfoMark';
import { Icon } from '../design/icons';
import { HAZARD_ZONES, LEGEND, type HatchId } from './hazards';

const LINE = '#FFF3D6', CASE = 'rgba(14,11,9,.82)';
const lines = (deg: number) => `repeating-linear-gradient(${deg}deg, ${CASE} 0 1px, ${LINE} 1px 2.4px, ${CASE} 2.4px 3.4px, transparent 3.4px 9px)`;

/** CSS swatches drawn like the map hatch: light lines with a dark casing, nothing under them. */
export const HATCH_SWATCH: Partial<Record<HatchId, string>> = {
  'hatch-scarp': `${lines(0)}, ${lines(90)}`,
  'hatch-loose': `${lines(45)}, ${lines(-45)}`,
};

const USED = [...new Set(HAZARD_ZONES.map(z => z.hatch))];
const PANEL_W = 260, GAP = 8;

export interface LegendPlace { button: CSSProperties; panel: CSSProperties; beside: boolean }

/**
 * Where the legend goes, in the overlay box's coordinates: the button sits in the map's top left corner; the open
 * panel sits beside the map when the free space left or right of it is wide enough, else over the map.
 */
export function placeLegend(map: { left: number; top: number; right: number; bottom: number }, box: { width: number }): LegendPlace {
  const button = { left: map.left + GAP, top: map.top + GAP };
  const room = PANEL_W + 2 * GAP;
  if (map.left >= room) return { button, panel: { left: map.left - PANEL_W - GAP, top: map.top, maxHeight: map.bottom - map.top }, beside: true };
  if (box.width - map.right >= room) return { button, panel: { left: map.right + GAP, top: map.top, maxHeight: map.bottom - map.top }, beside: true };
  return { button, panel: { left: map.left + GAP, top: map.top + GAP + 40, maxHeight: Math.max(120, map.bottom - map.top - 56), width: Math.min(PANEL_W, map.right - map.left - 2 * GAP) }, beside: false };
}

/** The map key: a small Legend button in the map corner, closed by default; one hatch per danger, what it means and where it comes from. */
export default function HazardLegend({ zones, stops, drills }: { zones: boolean; stops: boolean; drills: boolean }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<LegendPlace>();
  const box = useRef<HTMLDivElement>(null), toggle = useRef<HTMLButtonElement>(null);
  const panelId = `legend-${useId().replace(/:/g, '')}`;
  const any = zones || stops || drills;

  useLayoutEffect(() => {
    const el = box.current, workspace = el?.closest<HTMLElement>('.terrain-workspace');
    if (!el || !workspace) return;
    let frame = 0;
    const measure = () => {
      const canvas = workspace.querySelector<HTMLCanvasElement>('.surface-map canvas');
      if (!canvas) return;
      const c = canvas.getBoundingClientRect(), o = el.getBoundingClientRect();
      if (!c.width) return;
      setPlace(placeLegend({ left: c.left - o.left, top: c.top - o.top, right: c.right - o.left, bottom: c.bottom - o.top }, { width: o.width }));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(workspace);
    const canvas = workspace.querySelector('.surface-map canvas');
    if (canvas) observer.observe(canvas);
    window.addEventListener('resize', schedule);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); };
  }, [any]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.info-wrap[data-open]')) return;
      e.stopPropagation(); e.preventDefault(); setOpen(false); toggle.current?.focus();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [open]);

  if (!any) return null;
  return <div ref={box} className="hazard-legend-box">
    <button ref={toggle} type="button" className="hazard-legend__toggle" aria-expanded={open} aria-controls={panelId} style={place?.button} hidden={!place} onClick={() => setOpen(v => !v)}>
      <Icon name="layers" />Legend
    </button>
    {open && place && <section id={panelId} className={`hazard-legend${place.beside ? ' is-beside' : ' is-over'}`} aria-label="Map legend" style={place.panel}>
      <ul className="hazard-legend__rows">
        {zones && USED.map(h => <li key={h}>
          <span className="hazard-legend__swatch" style={{ backgroundImage: HATCH_SWATCH[h] }} />
          <span className="hazard-legend__text">{LEGEND[h].danger}<span className={`origin-tag is-${LEGEND[h].origin}`}>{LEGEND[h].origin}</span></span>
          <InfoMark title={LEGEND[h].danger} does="The route planner keeps the science walk out of this area. Your own steps are not blocked; the helmet shows a hazard symbol when you are inside or near it." source={LEGEND[h].note} coverage={HAZARD_ZONES.filter(z => z.hatch === h).map(z => z.label).join('; ')} />
        </li>)}
        {stops && <li><span className="map-mark map-mark--stop">1</span><span className="hazard-legend__text">Science stop, tap for its task<span className="origin-tag is-assumption">assumption</span></span></li>}
        {drills && <li><span className="map-mark map-mark--drill" /><span className="hazard-legend__text">Curiosity drill site, approximate<span className="origin-tag is-source">source</span></span></li>}
      </ul>
    </section>}
  </div>;
}
