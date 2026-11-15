/** First-visit memory for the tour. The app must work without storage, so every access is guarded. */

export const TOUR_KEY = 'marswalk.tour.v1';
export type TourMemoryValue = 'dismissed' | 'started' | 'finished';

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function tourMemory(storage: () => StorageLike | undefined = () => window.localStorage) {
  let fallback: TourMemoryValue | undefined;
  return {
    /** True once the visitor has started the tour, finished it or said Not now. */
    seen(): boolean {
      if (fallback) return true;
      try { return !!storage()?.getItem(TOUR_KEY); } catch { return false; }
    },
    remember(value: TourMemoryValue): void {
      fallback = value;
      try { storage()?.setItem(TOUR_KEY, value); } catch { /* blocked storage: remembered until reload */ }
    },
  };
}
