import { describe, expect, it } from 'vitest';

import { heatByKey, keyFor } from './keyboard-layouts';

describe('keyFor', () => {
  it('lleva mayúsculas y tildes a su tecla', () => {
    expect(keyFor('A', 'es-LA')).toBe('a');
    expect(keyFor('é', 'es-ES')).toBe('e');
    expect(keyFor('ñ', 'es-LA')).toBe('ñ');
    expect(keyFor('ñ', 'en-US')).toBe('n');
  });

  it('ubica los signos con Shift según la distribución', () => {
    expect(keyFor('?', 'en-US')).toBe('/');
    expect(keyFor('?', 'es-ES')).toBe("'");
    expect(keyFor('¿', 'es-ES')).toBe('¡');
    expect(keyFor('¿', 'es-LA')).toBe('¿');
    expect(keyFor('"', 'en-US')).toBe("'");
    expect(keyFor('"', 'es-LA')).toBe('2');
  });

  it('devuelve null para lo que no está en el teclado', () => {
    expect(keyFor('€', 'en-US')).toBeNull();
  });
});

describe('heatByKey', () => {
  it('suma en la misma tecla las variantes de un carácter', () => {
    const heat = heatByKey(
      [
        { key: 'a', attempts: 10, errors: 1 },
        { key: 'á', attempts: 5, errors: 2 },
        { key: 'A', attempts: 5, errors: 1 },
      ],
      'es-LA',
    );
    expect(heat.get('a')).toEqual({ attempts: 20, errors: 4, rate: 0.2 });
  });
});
