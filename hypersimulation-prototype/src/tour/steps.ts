import type { Chapter, TourStep } from './engine';

/**
 * The tour, one entry per card. Edit captions here. Rules: one sentence of at most 14 words, plain English,
 * only numbers the app itself shows. doIt is the default hands-on text, in the imperative for action steps; caption
 * shows while the tour plays (Show me) and when a control cannot be brought back. Targets are data-tour names (docs/tour-anchors.md); a renamed anchor fails
 * src/tour/steps.test.ts.
 */
export const STEPS: TourStep[] = [
  // Station
  { id: 'globe', chapter: 'Station', target: 'globe', action: 'drag', via: ['close-tablet', 'station-tab', 'atlas-tab'],
    caption: 'This globe is Mars. Drag it to turn it.', doIt: 'This globe is Mars. Drag it to turn it.' },
  { id: 'region', chapter: 'Station', target: 'region-boxwork', action: 'click', expect: 'task-geology', timeoutMs: 8000,
    caption: 'Gale · Boxwork is the suggested region. The globe flies there.', doIt: 'Choose Gale · Boxwork, the suggested region. The globe flies there.' },
  { id: 'task', chapter: 'Station', target: 'task-geology', action: 'click',
    caption: 'Under 02 / Choose your task, the Geology walk is picked.', doIt: 'Under 02 / Choose your task, pick Geology walk.' },
  { id: 'task-info', chapter: 'Station', target: 'task-info-geology', action: 'click', expect: 'task-info-geology-pop', show: 'task-info-geology-pop',
    leave: { reclickIfExpanded: true }, keep: ['[data-tour="task-info-geology"]'], avoid: ['.map-region-context'],
    caption: 'Each small i opens the details, only when you ask for them.', doIt: 'Click the small i beside Geology walk. It opens the details.' },
  { id: 'open-tablet', chapter: 'Station', target: 'open-tablet', action: 'click', expect: 'routes-tab', timeoutMs: 20000,
    caption: 'The blue bar opens the tablet. You plan the walk there.', doIt: 'Click the blue Open tablet bar. You plan the walk there.' },

  // Tablet
  { id: 'routes', chapter: 'Tablet', target: 'routes-tab', action: 'click', expect: 'plan-new-route',
    caption: 'Routes: plan a new walk, or load an earlier one.', doIt: 'Click Routes. There you plan a new walk or load one.' },
  { id: 'science-walk', chapter: 'Tablet', target: 'science-walk-card', action: 'point', via: ['plan-new-route'],
    caption: 'The prepared science walk: 8 stops, its length and the time in the suit.', doIt: 'This is the prepared science walk: 8 stops, length and suit time.' },
  { id: 'previous', chapter: 'Tablet', target: 'load-previous-path', action: 'click', expect: 'previous-paths',
    leave: { restorePressed: ['plan-new-route', 'load-previous-path'] }, avoid: ['.terrain-workspace'],
    caption: "Load previous path lists Curiosity's path and your saved walks.", doIt: "Click Load previous path. It lists Curiosity's path and your walks." },
  { id: 'display', chapter: 'Tablet', target: 'feature-stops', action: 'click', via: ['display-tab'], flip: 'helmet-preview-stop', show: 'helmet-preview-stop',
    keep: ['[data-tour="helmet-preview"]'], avoid: ['.mission-features__top'],
    caption: 'In Display, a switch changes the helmet preview. Watch the stop mark.', doIt: 'Open Display, then flip Science stops. Watch the stop mark.' },
  { id: 'events', chapter: 'Tablet', target: 'events-tab', action: 'click', expect: 'trigger-event', show: 'trigger-event',
    caption: 'Events simulate a hazard, such as local dust. Trigger now starts one.', doIt: 'Click Events. Events simulate a hazard, such as local dust.' },
  { id: 'preview', chapter: 'Tablet', target: 'preview-route', action: 'click', via: ['routes-tab'], expect: 'preview-controls', timeoutMs: 8000,
    caption: 'Preview route plays the walk in the helmet. Nothing is walked or saved.', doIt: 'Open Routes, then click Preview route. It plays the walk in the helmet.' },

  // Helmet: the route preview runs; the pointer stays away from the view.
  { id: 'compass', chapter: 'Helmet', target: 'hud-compass', action: 'point', pointer: false, optional: true,
    caption: 'Top centre, the compass shows where you are facing.', doIt: 'Top centre, the compass shows where you are facing.' },
  { id: 'minimap', chapter: 'Helmet', target: 'hud-minimap', action: 'point', pointer: false, optional: true,
    caption: 'Top right, the minimap. Hatched areas mark hazards to keep away from.', doIt: 'Top right, the minimap. Hatched areas mark hazards to keep away from.' },
  { id: 'notices', chapter: 'Helmet', target: 'hud-notices', action: 'point', pointer: false, optional: true,
    caption: 'Notices show briefly under the compass, then wait here. Key N lists them.', doIt: 'Notices show briefly under the compass, then wait here. Key N lists them.' },
  { id: 'stop', chapter: 'Helmet', target: 'preview-stop', action: 'click', pointer: false, expect: 'walk-route',
    caption: 'Stop ends the preview and brings you back to the tablet.', doIt: 'Click Stop to end the preview and return to the tablet.' },
  { id: 'ready', chapter: 'Tablet', target: 'walk-route', action: 'point', pointer: false, optional: true, final: true,
    caption: 'The tour ends here on Tablet Routes. Walk this route, or explore freely.', doIt: 'The tour ends here on Tablet Routes. Walk this route, or explore freely.' },
];

/** Used by Resume tour: the way back into a chapter from wherever the visitor went. */
export const RECOVER: Record<Chapter, string[]> = {
  Station: ['close-tablet', 'station-tab', 'atlas-tab'],
  Tablet: ['tablet-tab'],
  Helmet: ['tablet-tab', 'routes-tab', 'preview-route'],
};
