import { describe, expect, it } from 'vitest';

import { rankRunners } from './standings.js';

describe('rankRunners', () => {
  it('ordena por llegada y después por progreso a quienes no terminaron', () => {
    const standings = rankRunners([
      { id: 'c', finishMs: null, progress: 0.4 },
      { id: 'a', finishMs: 30_000, progress: 1 },
      { id: 'd', finishMs: null, progress: 0.9 },
      { id: 'b', finishMs: 25_000, progress: 1 },
    ]);
    expect(standings.map((s) => [s.id, s.position])).toEqual([
      ['b', 1],
      ['a', 2],
      ['d', 3],
      ['c', 4],
    ]);
  });

  it('los empates comparten puesto', () => {
    const standings = rankRunners([
      { id: 'a', finishMs: 10_000, progress: 1 },
      { id: 'b', finishMs: 10_000, progress: 1 },
      { id: 'c', finishMs: 12_000, progress: 1 },
    ]);
    expect(standings.map((s) => s.position)).toEqual([1, 1, 3]);
  });
});
