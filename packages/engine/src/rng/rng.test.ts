import { describe, expect, it } from 'vitest';

import { createRng, randomInt, randomLogNormal, randomNormal, seedFromString } from './rng.js';

function sample(count: number, draw: () => number): number[] {
  return Array.from({ length: count }, draw);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe('createRng', () => {
  it('produce la misma secuencia con la misma semilla', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(sample(100, a)).toEqual(sample(100, b));
  });

  it('produce secuencias distintas con semillas distintas', () => {
    expect(sample(10, createRng(1))).not.toEqual(sample(10, createRng(2)));
  });

  it('devuelve valores en [0, 1)', () => {
    const values = sample(10_000, createRng(7));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('es aproximadamente uniforme', () => {
    expect(mean(sample(20_000, createRng(123)))).toBeCloseTo(0.5, 1);
  });
});

describe('seedFromString', () => {
  it('es estable y de 32 bits sin signo', () => {
    const seed = seedFromString('2026-10-21');
    expect(seedFromString('2026-10-21')).toBe(seed);
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it('distingue textos parecidos, incluidos los acentuados', () => {
    expect(seedFromString('año')).not.toBe(seedFromString('ano'));
    expect(seedFromString('sala-1')).not.toBe(seedFromString('sala-2'));
  });
});

describe('randomInt', () => {
  it('cubre el rango completo con ambos extremos', () => {
    const rng = createRng(9);
    const seen = new Set(sample(1_000, () => randomInt(rng, 1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rechaza rangos inválidos', () => {
    const rng = createRng(1);
    expect(() => randomInt(rng, 5, 1)).toThrow(RangeError);
    expect(() => randomInt(rng, 0.5, 2)).toThrow(RangeError);
  });
});

describe('randomNormal', () => {
  it('respeta media y desviación', () => {
    const rng = createRng(2026);
    const values = sample(20_000, () => randomNormal(rng, 60, 5));
    const m = mean(values);
    const sd = Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
    expect(m).toBeCloseTo(60, 0);
    expect(sd).toBeGreaterThan(4.8);
    expect(sd).toBeLessThan(5.2);
  });
});

describe('randomLogNormal', () => {
  it('siempre es positiva y su mediana coincide con la pedida', () => {
    const rng = createRng(31);
    const values = sample(20_001, () => randomLogNormal(rng, 180, 0.35)).sort((a, b) => a - b);
    expect(values[0]).toBeGreaterThan(0);
    const median = values[10_000] ?? Number.NaN;
    expect(median).toBeGreaterThan(170);
    expect(median).toBeLessThan(190);
  });

  it('rechaza medianas no positivas', () => {
    expect(() => randomLogNormal(createRng(1), 0, 0.3)).toThrow(RangeError);
  });
});
