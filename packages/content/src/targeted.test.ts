import { createRng } from '@tecleo/engine';
import { describe, expect, it } from 'vitest';

import { targetedWords, targetWeight, weakSpots } from './targeted.js';

describe('práctica dirigida', () => {
  it('elige las letras y pares con más errores, con un mínimo de intentos', () => {
    const spots = weakSpots(
      [
        { key: 'ñ', attempts: 20, errors: 8 },
        { key: 'a', attempts: 200, errors: 4 },
        { key: 'q', attempts: 2, errors: 2 },
        { key: ' ', attempts: 50, errors: 30 },
        { key: 'e', attempts: 100, errors: 0 },
      ],
      [
        { key: 'rr', attempts: 30, errors: 9 },
        { key: 'Ñe', attempts: 10, errors: 1 },
        { key: 'a,', attempts: 40, errors: 30 },
      ],
    );
    expect(spots.keys).toEqual(['ñ', 'a']);
    expect(spots.bigrams).toEqual(['rr', 'ñe']);
  });

  it('las palabras pesan según cuánto practican los puntos débiles', () => {
    const spots = { keys: ['ñ'], bigrams: ['rr'] };
    expect(targetWeight('perro', spots)).toBe(3);
    expect(targetWeight('Ñoño', spots)).toBe(2);
    expect(targetWeight('casa', spots)).toBe(0);
  });

  it('arma el ejercicio con palabras que contienen los puntos débiles', () => {
    const list = Array.from({ length: 30 }, (_, index) =>
      index % 2 === 0 ? `perro${String(index)}` : `casa${String(index)}`,
    );
    const text = targetedWords(list, { keys: [], bigrams: ['rr'] }, 25, createRng(1));
    const words = text?.split(' ') ?? [];
    expect(words).toHaveLength(25);
    expect(words.every((word) => word.includes('rr'))).toBe(true);
    expect(targetedWords(list, { keys: [], bigrams: ['rr'] }, 25, createRng(1))).toBe(text);
  });

  it('sin palabras que los contengan no hay ejercicio', () => {
    expect(
      targetedWords(['sol', 'mar', 'luz'], { keys: ['ñ'], bigrams: [] }, 10, createRng(2)),
    ).toBeNull();
  });
});
