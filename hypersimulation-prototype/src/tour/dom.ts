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
