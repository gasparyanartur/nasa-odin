/** Pure placement of the tour caption card next to a target rectangle, inside the viewport. */

export interface Box { left: number; top: number; width: number; height: number }
export type Side = 'right' | 'left' | 'below' | 'above' | 'free';

const GAP = 16, MARGIN = 12;

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v));

/**
 * Tries right, left, below and above the target; the first side where the card fits without touching the target wins.
 * When none fits (a target as large as the window), the side that covers least of the target wins.
 * Without a target the card sits at the bottom centre.
 */
export function placeCard(target: Box | null, card: { width: number; height: number }, view: { width: number; height: number }): { left: number; top: number; side: Side } {
  const maxLeft = view.width - card.width - MARGIN, maxTop = view.height - card.height - MARGIN;
  if (!target) return { left: clamp((view.width - card.width) / 2, MARGIN, maxLeft), top: clamp(view.height - card.height - 28, MARGIN, maxTop), side: 'free' };
  const cy = target.top + target.height / 2 - card.height / 2, cx = target.left + target.width / 2 - card.width / 2;
  const options: { side: Side; left: number; top: number }[] = [
    { side: 'right', left: target.left + target.width + GAP, top: cy },
    { side: 'left', left: target.left - GAP - card.width, top: cy },
    { side: 'below', left: cx, top: target.top + target.height + GAP },
    { side: 'above', left: cx, top: target.top - GAP - card.height },
  ];
  let best: { side: Side; left: number; top: number; cover: number } | undefined;
  for (const o of options) {
    const fits = o.side === 'right' || o.side === 'left' ? o.left >= MARGIN && o.left <= maxLeft : o.top >= MARGIN && o.top <= maxTop;
    const left = clamp(o.left, MARGIN, maxLeft), top = clamp(o.top, MARGIN, maxTop);
    const cover = overlap({ left, top, width: card.width, height: card.height }, target);
    if (fits && cover === 0) return { side: o.side, left, top };
    if (!best || cover < best.cover) best = { ...o, left, top, cover };
  }
  return { side: best!.side, left: best!.left, top: best!.top };
}
