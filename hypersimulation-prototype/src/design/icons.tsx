// The fine engraved-stroke pictograms of design board 14 (from board 06, "Gold Visor"), ported from the Marswalk
// icon set. 24 x 24 grid, stroke = currentColor, round caps. Hidden from assistive technology: the word beside a
// pictogram carries its meaning.
import type { ReactNode } from 'react';

const P = (d: string) => <path d={d} />;
const RAD = 'M10.7 9.75L8 5.07A8 8 0 0 1 16 5.07L13.3 9.75A2.6 2.6 0 0 0 10.7 9.75Z';

const ICONS = {
  ground: P('M3 19h18M4 19L19 8.5M10 19A6 6 0 0 0 8.9 15.6'),
  time: P('M6.5 3.5h11M6.5 20.5h11M8 3.5c0 4.5 8 5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 5-8 8.5s8 4 8 8.5'),
  radiation: <><path d={RAD} /><path transform="rotate(120 12 12)" d={RAD} /><path transform="rotate(240 12 12)" d={RAD} /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  fine: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" /></>,
  limit: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /><path d="M12 .8v3.4M12 19.8v3.4" /></>,
  halt: <><circle cx="12" cy="12" r="9" /><path d="M7.8 7.8l8.4 8.4M16.2 7.8l-8.4 8.4" strokeWidth="2" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="M12 6.5l2.6 7.5L12 12.6 9.4 14z" /></>,
  north: P('M12 2.5l5.5 16-5.5-3.5-5.5 3.5z'),
  stop: <><path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" /><path d="M12 9l3 3-3 3-3-3z" /></>,
  ridge: <><circle cx="12" cy="14.5" r="6" /><path d="M7 6.8l5-4.4 5 4.4" /></>,
  hollow: <><circle cx="12" cy="9.5" r="6" /><path d="M7 17.2l5 4.4 5-4.4" /></>,
  rover: <><path d="M3.5 15h17M5 15v-4h10l2.5 4M9 11V8h4" /><circle cx="7" cy="18" r="1.8" /><circle cx="12" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  route: <><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="5.5" r="2" /><path d="M7 17C10 12 9 8.5 16.5 6.5" /><path d="M7.5 19c6 0 9.5-3 11-11.5" strokeDasharray="2 2.6" /></>,
  back: P('M9 5L4 10l5 5M4 10h10a5 5 0 0 1 0 10h-3'),
  ahead: P('M12 20V4.5M6.5 10L12 4.5 17.5 10'),
  'bear-right': P('M7 20v-6.5a6 6 0 0 1 6-6h4.5M14 4l3.5 3.5L14 11'),
  'bear-left': P('M17 20v-6.5a6 6 0 0 0-6-6H6.5M10 4L6.5 7.5 10 11'),
  turn: P('M8 20V10a5 5 0 0 1 10 0v4M14.5 11l3.5 3.5 3.5-3.5'),
  next: P('M9 5l7 7-7 7'),
  place: <><path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  pause: <path d="M9 5.5v13M15 5.5v13" strokeWidth="2" />,
  play: P('M8 5.5v13l10-6.5z'),
  tablet: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M10 17.5h4" /></>,
  station: P('M2.5 19.5h19M4.5 19.5v-3a7.5 7.5 0 0 1 15 0v3M10 19.5V16h4v3.5'),
  helmet: P('M4 18.5V13a8 8 0 0 1 16 0v5.5zM7.5 13.5a4.5 3 0 0 1 9 0v1.5h-9z'),
  note: P('M5 3.5h10l4 4v13H5zM15 3.5v4h4M8 12h8M8 15.5h8'),
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  warning: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.2v.3" strokeWidth="2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10.5v6M12 7.3v.4" strokeWidth="2" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5M12 14.5v2.4" /></>,
  check: P('M5 12.5l4.5 4.5L19 7.5'),
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
  dial: <><circle cx="12" cy="12" r="9.5" /><path d="M12 2.5v2.2M21.5 12h-2.2M12 21.5v-2.2M2.5 12h2.2M12 12l3.6-4.6" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  geology: P('M3 7c3-1.5 6 1.5 9 0s6-1.5 9 0M3 12c3-1.5 6 1.5 9 0s6-1.5 9 0M3 17c3-1.5 6 1.5 9 0s6-1.5 9 0'),
  safety: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 7.9-7.5 9.5-4.3-1.6-7.5-4.9-7.5-9.5V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  water: <><path d="M12 3.2c3.6 4.6 6 8 6 11.1a6 6 0 0 1-12 0c0-3.1 2.4-6.5 6-11.1z" /><path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.7" /></>,
  custom: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  layers: <><path d="M12 4l9 4.5-9 4.5-9-4.5z" /><path d="M3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" /></>,
  drill: <><circle cx="12" cy="12" r="7.5" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" /></>,
  thermo: <><path d="M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z" /><path d="M12 9v7.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  nogo: <><circle cx="12" cy="12" r="8.5" /><path d="M6 18L18 6" /></>,
  height: <><path d="M2.5 19.5l6-9 4 5 3-4 6 8z" /><path d="M8.5 4v4M6.8 5.7L8.5 4l1.7 1.7" /></>,
  look: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></>,
  photo: <><rect x="3.5" y="5" width="17" height="14" rx="1.5" /><path d="M3.5 16l5-5 4 4 2.5-2.5 5 5" /><circle cx="15.5" cy="9" r="1.4" /></>,
  flag: P('M6 21V3.5M6 4h11.5l-2.3 4 2.3 4H6'),
  area: P('M3 6.5l6-2.3 6 2.3 6-2.3v13.3l-6 2.3-6-2.3-6 2.3zM9 4.2v13.3M15 6.5v13.3'),
  history: P('M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4l3 2'),
  close: P('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className, size }: { name: IconName; className?: string; size?: number | string }) {
  return <svg className={`pict${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width={size} height={size}>{ICONS[name]}</svg>;
}
