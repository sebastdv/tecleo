import { describe, expect, it } from 'vitest';

import { normalizeChars, normalizeText, stripAccents } from './normalize.js';

describe('normalizeChars', () => {
  it('convierte comillas, rayas, puntos suspensivos y espacios tipográficos', () => {
    expect(normalizeChars('“Hola” —dijo— ‘sí’… «ya» fin')).toBe(`"Hola" -dijo- 'sí'... "ya" fin`);
  });

  it('compone tildes descompuestas (NFD → NFC)', () => {
    const decomposed = 'canción año';
    expect(normalizeChars(decomposed)).toBe('canción año');
    expect(normalizeChars(decomposed)).toHaveLength('canción año'.length);
  });

  it('respeta ¿ ¡ ñ ü y el resto de caracteres del español', () => {
    expect(normalizeChars('¿Qué? ¡Pingüino! Ñandú')).toBe('¿Qué? ¡Pingüino! Ñandú');
  });
});

describe('normalizeText', () => {
  it('en prosa deja un solo espacio entre palabras y quita los bordes', () => {
    expect(normalizeText('  Érase  una\tvez\n\nun   hombre.  ')).toBe('Érase una vez un hombre.');
  });

  it('en código conserva líneas y sangría, quita líneas vacías y espacios finales', () => {
    const code = '\nfunction f() {  \r\n\tif (a) {\n\n    return  1;\n  }\n}\n';
    expect(normalizeText(code, { preserveLines: true })).toBe(
      'function f() {\n  if (a) {\n    return 1;\n  }\n}',
    );
  });
});

describe('stripAccents', () => {
  it('quita tildes, diéresis y la virgulilla', () => {
    expect(['á', 'É', 'ü', 'ñ', 'Ñ', 'a', '?'].map(stripAccents)).toEqual([
      'a',
      'E',
      'u',
      'n',
      'N',
      'a',
      '?',
    ]);
  });
});
