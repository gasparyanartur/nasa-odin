/** DOM reads for the tour: find a data-tour anchor that a visitor could use right now. */

const byName = (name: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(name)}"]`));

/** On screen (has a box), not inside an inert or hidden subtree. */
export function visible(el: Element): boolean {
  return el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert],[hidden]');
}

/** The first anchor with this name that is visible and enabled, or null. */
export function ready(name: string): HTMLElement | null {
  return byName(name).find(el => visible(el) && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true') ?? null;
}

/** The first anchor with this name that is on screen, enabled or not: a result to wait for or to show. */
export function present(name: string): HTMLElement | null {
  return byName(name).find(visible) ?? null;
}

export function pressed(el: Element | null): boolean {
  return el?.getAttribute('aria-pressed') === 'true';
}

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function centre(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export interface Rect { left: number; top: number; right: number; bottom: number }

/** The part of the element a visitor can see: cut to every clipping parent and the window; null when none of it shows. */
export function shownRect(el: Element): Rect | null {
  if (!visible(el)) return null;
  const r = el.getBoundingClientRect();
  let left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(window.innerWidth, r.right), bottom = Math.min(window.innerHeight, r.bottom);
  for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (p !== el && /(auto|scroll|hidden|clip)/.test(s.overflowY + s.overflowX)) {
      const b = p.getBoundingClientRect();
      left = Math.max(left, b.left); top = Math.max(top, b.top); right = Math.min(right, b.right); bottom = Math.min(bottom, b.bottom);
    }
    if (s.position === 'fixed') break;
  }
  return right - left > 1 && bottom - top > 1 ? { left, top, right, bottom } : null;
}

/** Boxes of every visible element matching the selectors, as left / top / width / height. */
export function boxes(selectors: string[]): { left: number; top: number; width: number; height: number }[] {
  const out: { left: number; top: number; width: number; height: number }[] = [];
  for (const sel of selectors) for (const el of Array.from(document.querySelectorAll(sel))) {
    const r = shownRect(el);
    if (r) out.push({ left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top });
  }
  return out;
}

/** Every node the tour itself puts in the page. None of them may remain once the tour is off. */
export const TOUR_NODES = '.tour-layer, .tour-ring, .tour-pointer, .tour-card, .tour-invite';
/** Marks the tour sets on page elements, as attributes. */
export const TOUR_MARKS = ['data-tour-invite'];

interface SweepDoc {
  documentElement: { removeAttribute(name: string): void };
  querySelectorAll(selector: string): ArrayLike<{ remove(): void; removeAttribute(name: string): void }>;
}

/**
 * Removes every tour node and mark still in the page. Safe to call any number of times. Called after the tour is off,
 * when React has already unmounted its own nodes, so it only catches strays.
 */
export function sweepTour(doc: SweepDoc = document): void {
  for (const name of TOUR_MARKS) {
    doc.documentElement.removeAttribute(name);
    for (const el of Array.from(doc.querySelectorAll(`[${name}]`))) el.removeAttribute(name);
  }
  for (const el of Array.from(doc.querySelectorAll(TOUR_NODES))) el.remove();
}

/** Scrolls only when the element is not fully inside its scrolling parents and the window. */
export function bringIntoView(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const inside = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
  let clipped = !inside;
  for (let p = el.parentElement; p && !clipped; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (!/(auto|scroll|hidden)/.test(s.overflowY + s.overflowX)) continue;
    const b = p.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom || r.left < b.left || r.right > b.right) clipped = true;
  }
  if (clipped) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  return clipped;
}
