/** Station rules that need no globe: the planet-view hint and the Enter surface guard. */

/** Camera height above the Mars surface below which the planet-wide extent of a global layer is out of view. */
export const PLANET_VIEW_HEIGHT_M = 5_000_000;
export const zoomedIn = (heightM: number) => heightM < PLANET_VIEW_HEIGHT_M;

export interface GlobalLayers { basemapId: string; basemapVisible: boolean; basemapOpacity: number; environmentLayer: string; environmentOpacity: number }
export const layerKey = (l: GlobalLayers) => `${l.basemapId}|${l.basemapVisible}|${l.basemapOpacity}|${l.environmentLayer}|${l.environmentOpacity}`;
/** A global layer is on screen: the basemap is shown or an environmental layer is chosen. */
export const globalLayerShown = (l: GlobalLayers) => l.basemapVisible || l.environmentLayer !== 'none';

export type HintEvent =
  | { type: 'layer'; zoomedIn: boolean; shown: boolean }
  | { type: 'zoom'; zoomedIn: boolean }
  | { type: 'dismiss' };

/** Shown after a global layer change while zoomed in; gone on zoom out or dismiss, and never in planet view. */
export function planetHint(shown: boolean, event: HintEvent): boolean {
  if (event.type === 'dismiss') return false;
  if (event.type === 'zoom') return shown && event.zoomedIn;
  return event.zoomedIn && event.shown;
}

/** Enter surface with no planned or chosen route asks first; with one it enters directly. */
export const surfaceGuard = (hasPlan: boolean): 'enter' | 'confirm' => hasPlan ? 'enter' : 'confirm';
