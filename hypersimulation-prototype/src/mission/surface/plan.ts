import type { GraphicsQuality } from '../conditions';

/** The quality the HUD walk scene starts at (App.tsx). */
export const DEFAULT_QUALITY: GraphicsQuality = 'medium';

/**
 * What the walk scene loads per quality on a terrain with the Marswalk detail data (FULLDATA-WIRING.md): the 1 m core
 * height grid at every quality, every second 1 m sample in the mesh below High, and the 0.25 m image tiles only at High.
 */
export function surfacePlan(quality: GraphicsQuality, detail: boolean) {
  return {
    coreHeight: detail ? 'dem_core' as const : 'analysis grid' as const,
    lowDetail: quality === 'low' || (detail && quality === 'medium'),
    coreTiles: detail && quality === 'high',
  };
}
