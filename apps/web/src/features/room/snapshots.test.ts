import { describe, expect, it } from 'vitest';

import { progressAt, pushSample, type ProgressSample } from './snapshots';

describe('interpolación de rivales', () => {
  const buffer: ProgressSample[] = [
    { at: 1_000, progress: 0.1 },
    { at: 1_150, progress: 0.2 },
    { at: 1_300, progress: 0.5 },
  ];

  it('interpola linealmente entre las muestras que rodean el instante', () => {
    expect(progressAt(buffer, 1_075)).toBeCloseTo(0.15);
    expect(progressAt(buffer, 1_225)).toBeCloseTo(0.35);
    expect(progressAt(buffer, 1_150)).toBeCloseTo(0.2);
  });

  it('no extrapola más allá del último dato ni antes del primero', () => {
    expect(progressAt(buffer, 5_000)).toBe(0.5);
    expect(progressAt(buffer, 0)).toBe(0.1);
    expect(progressAt([], 1_000)).toBe(0);
  });

  it('conserva solo las últimas muestras', () => {
    let samples: ProgressSample[] = [];
    for (let index = 0; index < 20; index++) {
      samples = pushSample(samples, { at: index, progress: index / 20 });
    }
    expect(samples).toHaveLength(8);
    expect(samples[0]?.at).toBe(12);
  });
});
