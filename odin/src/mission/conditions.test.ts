import { describe, expect, it } from 'vitest';
import environment from '../../public/gale/environment.json';
import { drawingRatio, historicalAt, LMST_HOUR_SECONDS, lmstLabel, SOL_SECONDS } from './conditions';

describe('shared historical clock and drawing presets',()=>{
  it('holds observed medians within bins without wrapping or filling missing data',()=>{
    expect(historicalAt(environment,12.9)?.temperatureK).toBe(249.38);
    expect(historicalAt(environment,13)?.temperatureK).toBe(253.795);
    expect(historicalAt(environment,24)).toBeUndefined();
    expect(historicalAt(environment,-.1)).toBeUndefined();
    expect(historicalAt(environment,12)?.windMps).toBeNull();
  });
  it('converts physical elapsed seconds to LMST and preserves the sol boundary',()=>{
    expect(LMST_HOUR_SECONDS*24).toBe(SOL_SECONDS);
    expect(lmstLabel(12+LMST_HOUR_SECONDS/LMST_HOUR_SECONDS)).toBe('13:00 LMST');
    expect(lmstLabel(24.5)).toBe('00:30 (+1 sol) LMST');
  });
  it('reduces drawing pixels and caps high density without changing mission data',()=>{
    expect(drawingRatio('low',2)).toBe(.65);
    expect(drawingRatio('medium',2)).toBe(1);
    expect(drawingRatio('high',3)).toBe(2);
    expect(drawingRatio('high',1)).toBe(1);
  });
});
