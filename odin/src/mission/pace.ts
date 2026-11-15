export const PACE_KEY = 'martian-map.pace.v1';
export const PACES = [1, 5, 20] as const;
export const DEFAULT_PACE = 20;

// Private browsing and blocked cookies throw on the localStorage getter itself, so the getter runs inside the try.
const local = () => globalThis.localStorage;

/** The simulation pace: the user's stored choice when it is one of the offered steps, else the default. */
export function storedPace(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const value = Number((storage ?? local())?.getItem(PACE_KEY));
    return (PACES as readonly number[]).includes(value) ? value : DEFAULT_PACE;
  } catch { return DEFAULT_PACE; }
}

export function savePace(value: number, storage?: Pick<Storage, 'setItem'>) {
  try { (storage ?? local())?.setItem(PACE_KEY, String(value)); } catch { /* The choice lasts for this session. */ }
}
