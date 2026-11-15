/** Pure placement of the tour caption card next to a target rectangle, inside the viewport. */

export interface Box { left: number; top: number; width: number; height: number }
export type Side = 'right' | 'left' | 'below' | 'above' | 'free';

/**
 * keep: boxes the card must never cover (the preview controls). busy: boxes it should cover as little as it can
 * (key context such as the region label, the local map or the tablet title). home: a fixed calm spot that wins
 * whenever it is clear of the target, keep and busy (the helmet chapter).
 */
export interface PlaceOptions { keep?: Box[]; busy?: Box[]; home?: { left: number; top: number } }

const GAP = 16, MARGIN = 12, HARD = 1e6;

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v));

/**
 * The card never covers the target or a keep box when any spot in the window allows it, and covers as little of the
 * busy boxes as it can. Among equal spots: beside the target (right, left, below, above) first, then free spots of the
 * window, then a side that had to be pushed back inside the window. Without a target the card sits at the bottom centre.
 */
export function placeCard(target: Box | null, card: { width: number; height: number }, view: { width: number; height: number }, opts: PlaceOptions = {}): { left: number; top: number; side: Side } {
  const maxLeft = view.width - card.width - MARGIN, maxTop = view.height - card.height - MARGIN;
  const hard = [...(target ? [target] : []), ...(opts.keep ?? [])], soft = opts.busy ?? [];
  const cost = (left: number, top: number) => {
    const b = { left, top, width: card.width, height: card.height };
    return hard.reduce((s, h) => s + overlap(b, h) * HARD, 0) + soft.reduce((s, h) => s + overlap(b, h), 0);
  };
  type Spot = { side: Side; left: number; top: number; rank: number };
  const spots: Spot[] = [];
  const add = (side: Side, left: number, top: number, rank: number) => spots.push({ side, left: clamp(left, MARGIN, maxLeft), top: clamp(top, MARGIN, maxTop), rank });

  if (opts.home) {
    const left = clamp(opts.home.left, MARGIN, maxLeft), top = clamp(opts.home.top, MARGIN, maxTop);
    if (cost(left, top) === 0) return { left, top, side: 'free' };
  }
  if (!target) {
    const left = clamp((view.width - card.width) / 2, MARGIN, maxLeft), top = clamp(view.height - card.height - 28, MARGIN, maxTop);
    if (cost(left, top) === 0) return { left, top, side: 'free' };
    add('free', left, top, 1);
  } else {
    const cy = target.top + target.height / 2 - card.height / 2, cx = target.left + target.width / 2 - card.width / 2;
    const ys = [cy, target.top, target.top + target.height - card.height], xs = [cx, target.left, target.left + target.width - card.width];
    const sides: [Side, number[], (a: number) => [number, number]][] = [
      ['right', ys, y => [target.left + target.width + GAP, y]],
      ['left', ys, y => [target.left - GAP - card.width, y]],
      ['below', xs, x => [x, target.top + target.height + GAP]],
      ['above', xs, x => [x, target.top - GAP - card.height]],
    ];
    for (const [side, along, at] of sides) for (const a of along) {
      const [left, top] = at(a);
      const fits = side === 'right' || side === 'left' ? left >= MARGIN && left <= maxLeft : top >= MARGIN && top <= maxTop;
      add(side, left, top, fits ? 0 : 2);
    }
  }
  if (opts.home) add('free', opts.home.left, opts.home.top, 1);
  for (const left of [MARGIN, (view.width - card.width) / 2, maxLeft]) for (const top of [MARGIN, (view.height - card.height) / 2, maxTop]) add('free', left, top, 1);

  let best: (Spot & { cost: number }) | undefined;
  for (const s of spots) {
    const c = cost(s.left, s.top);
    if (!best || c < best.cost || (c === best.cost && s.rank < best.rank)) best = { ...s, cost: c };
  }
  return { side: best!.side, left: best!.left, top: best!.top };
}
