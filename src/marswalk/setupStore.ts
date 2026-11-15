import { DEFAULT_SETUP, normal, type Setup } from './presets';

export const SETUP_KEY = 'martian-map.marswalk-setup.v1';

type GetStorage = () => Storage | null | undefined;

// Private browsing and blocked cookies throw on the localStorage getter itself, not only on setItem.
function storage(get: GetStorage): Storage | null {
  try { return get() ?? null; } catch { return null; }
}

/** The walk choice from the last visit; a missing, broken or blocked store gives the default Geology walk. */
export function loadSetup(get: GetStorage = () => globalThis.localStorage): Setup {
  const s = storage(get);
  if (!s) return DEFAULT_SETUP;
  try { const raw = s.getItem(SETUP_KEY); return raw ? normal(JSON.parse(raw)) : DEFAULT_SETUP; }
  catch { return DEFAULT_SETUP; }
}

/** The walk choice stored by an earlier visit, or null when none is stored (then nothing is re-applied on load). */
export function savedSetup(get: GetStorage = () => globalThis.localStorage): Setup | null {
  const s = storage(get);
  if (!s) return null;
  try { const raw = s.getItem(SETUP_KEY); return raw ? normal(JSON.parse(raw)) : null; }
  catch { return null; }
}

/** False when the browser blocks storage: the choice then lives until the page reloads. */
export function saveSetup(setup: Setup, get: GetStorage = () => globalThis.localStorage): boolean {
  const s = storage(get);
  if (!s) return false;
  try { s.setItem(SETUP_KEY, JSON.stringify(normal(setup))); return true; } catch { return false; }
}
