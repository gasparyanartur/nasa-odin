import type { Point } from '../mission/data';
import type { HazardZone } from './hazards';

const LINE = '#FFF3D6', CASE = 'rgba(14,11,9,0.82)';

type ToPixel = (p: Point) => number[];

function trace(ctx: CanvasRenderingContext2D, zone: HazardZone, pixel: ToPixel) {
  ctx.beginPath();
  zone.polygon.forEach(([x, y], i) => { const [px, py] = pixel({ x, y }); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath();
}

function cased(ctx: CanvasRenderingContext2D, width: number) {
  ctx.strokeStyle = CASE; ctx.lineWidth = width * 2.6; ctx.stroke();
  ctx.strokeStyle = LINE; ctx.lineWidth = width; ctx.stroke();
}

/**
 * Hatched no-go areas on the 2D map: cased light lines and a dashed outline, no fill, so the orbital image under the
 * hatch keeps its colour. `period` and `width` are in canvas units for the current zoom (the caller keeps them legible).
 */
export function drawZones(ctx: CanvasRenderingContext2D, zones: HazardZone[], pixel: ToPixel, period: number, width: number) {
  for (const zone of zones) {
    const pts = zone.polygon.map(([x, y]) => pixel({ x, y }));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), h = y1 - y0;
    ctx.save();
    trace(ctx, zone, pixel); ctx.clip();
    ctx.beginPath();
    if (zone.hatch === 'hatch-scarp') {
      for (let x = x0; x <= x1; x += period) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      for (let y = y0; y <= y1; y += period) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    } else {
      // Both diagonals: the same pattern the 3D scene draws for this zone (scene3d.js channel 1, "cross").
      for (let t = x0 - h; t <= x1 + h; t += period * Math.SQRT2) { ctx.moveTo(t, y1); ctx.lineTo(t + h, y0); ctx.moveTo(t, y0); ctx.lineTo(t + h, y1); }
    }
    cased(ctx, width);
    ctx.restore();
    ctx.save();
    trace(ctx, zone, pixel);
    ctx.setLineDash([period * .9, period * .55]);
    cased(ctx, width * 1.1);
    ctx.restore();
  }
}

/** A line drawn as cased light dashes, for the way back to the habitat during the storm scenario. */
export function drawWayBack(ctx: CanvasRenderingContext2D, points: Point[], pixel: ToPixel, width: number) {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => { const [x, y] = pixel(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.setLineDash([width * 3, width * 2]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = CASE; ctx.lineWidth = width * 2.4; ctx.stroke();
  ctx.strokeStyle = '#7A9DF0'; ctx.lineWidth = width; ctx.stroke();
  ctx.restore();
}

export interface MapStop extends Point { id: number; kind: 'ridge' | 'hollow'; visited?: boolean; next?: boolean }

/** Numbered stop squares (filled for a ridge, open for a hollow, as in Marswalk) and drill rings. */
export function drawStops(ctx: CanvasRenderingContext2D, stops: MapStop[], drills: Point[], pixel: ToPixel, scale: number, selected?: number) {
  ctx.save();
  for (const d of drills) {
    const [x, y] = pixel(d);
    ctx.beginPath(); ctx.arc(x, y, 7 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = CASE; ctx.lineWidth = 4 * scale; ctx.stroke();
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.6 * scale; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.4 * scale, 0, Math.PI * 2); ctx.fillStyle = LINE; ctx.fill();
  }
  for (const s of stops) {
    const [x, y] = pixel(s), r = 9 * scale, on = s.id === selected;
    ctx.fillStyle = CASE; ctx.fillRect(x - r - 2 * scale, y - r - 2 * scale, 2 * r + 4 * scale, 2 * r + 4 * scale);
    ctx.fillStyle = s.kind === 'ridge' ? LINE : 'rgba(21,20,18,.9)'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.strokeStyle = on ? '#7A9DF0' : LINE; ctx.lineWidth = (on ? 3 : 1.6) * scale; ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
    ctx.fillStyle = s.kind === 'ridge' ? '#26211C' : LINE;
    ctx.font = `700 ${11 * scale}px Overpass, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(s.id), x, y + .5 * scale);
  }
  ctx.restore();
}
