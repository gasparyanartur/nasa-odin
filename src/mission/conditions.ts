import type { Environment } from './data';

// NASA Mars24 mean solar day in SI seconds, rounded to milliseconds.
// https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
export const SOL_SECONDS = 88775.244;
export const LMST_HOUR_SECONDS = SOL_SECONDS / 24;
export function historicalAt(environment: Environment, hour: number) {
  return hour >= 0 && hour < 24 ? environment.weather.find(w => w.hour === Math.floor(hour)) : undefined;
}
export function lmstLabel(hour: number) {
  const minutes = Math.floor(hour * 60 + 1e-7);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${hour >= 24 ? ' (+1 sol)' : ''} LMST`;
}
export type GraphicsQuality = 'low' | 'medium' | 'high';
export const GRAPHICS: Record<GraphicsQuality, { scale: number; cap: number; label: string }> = {
  low: { scale: .65, cap: 1, label: 'Low · 65% resolution' },
  medium: { scale: 1, cap: 1, label: 'Medium · native resolution' },
  high: { scale: 1, cap: 2, label: 'High · up to 2× resolution' },
};
export function drawingRatio(quality: GraphicsQuality, deviceRatio: number) {
  const preset = GRAPHICS[quality];
  return Math.min(deviceRatio, preset.cap) * preset.scale;
}
