import { createBotProfile, simulateBot } from '@tecleo/engine';
import { describe, expect, it } from 'vitest';

import { interpolatedProgress } from './progress';

const run = simulateBot({
  text: 'El sol sale por el este y se pone por el oeste.',
  profile: createBotProfile({ level: 'intermediate', seed: 2 }),
  seed: 2,
});

describe('interpolatedProgress', () => {
  it('va de 0 a 1 y se queda en 1 después de llegar', () => {
    expect(interpolatedProgress(run, 0)).toBe(0);
    expect(interpolatedProgress(run, run.finishMs)).toBe(1);
    expect(interpolatedProgress(run, run.finishMs * 2)).toBe(1);
  });

  it('entre dos pulsaciones queda entre sus valores', () => {
    const [, a, b] = run.samples;
    if (!a || !b || a.t === b.t) throw new Error('muestras insuficientes');
    const middle = interpolatedProgress(run, (a.t + b.t) / 2);
    const low = Math.min(a.correctChars, b.correctChars) / run.totalChars;
    const high = Math.max(a.correctChars, b.correctChars) / run.totalChars;
    expect(middle).toBeGreaterThanOrEqual(low);
    expect(middle).toBeLessThanOrEqual(high);
  });
});
