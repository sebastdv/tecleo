import { createRng } from '@tecleo/engine';
import { describe, expect, it } from 'vitest';

import { bigramFrequencies, textDifficulty } from './difficulty.js';
import { generateWords } from './words.js';

const LIST = ['casa', 'sol', 'río', 'año', 'luz', 'mar'];

describe('generateWords', () => {
  it('genera la cantidad pedida, de la lista y sin repetir la anterior', () => {
    const words = generateWords(LIST, { language: 'es', count: 200, rng: createRng(1) }).split(' ');
    expect(words).toHaveLength(200);
    for (const word of words) expect(LIST).toContain(word);
    for (let i = 1; i < words.length; i++) expect(words[i]).not.toBe(words[i - 1]);
  });

  it('es determinista para la misma semilla', () => {
    const a = generateWords(LIST, {
      language: 'es',
      count: 30,
      rng: createRng(9),
      punctuation: true,
    });
    const b = generateWords(LIST, {
      language: 'es',
      count: 30,
      rng: createRng(9),
      punctuation: true,
    });
    expect(a).toBe(b);
  });

  it('con puntuación en español abre ¿ y ¡ y empieza oraciones con mayúscula', () => {
    const text = generateWords(LIST, {
      language: 'es',
      count: 400,
      rng: createRng(3),
      punctuation: true,
    });
    const sentences = text.match(/[¿¡]?[^.?!]+[.?!]/g) ?? [];
    expect(sentences.length).toBeGreaterThan(30);
    for (const sentence of sentences.map((s) => s.trim())) {
      if (sentence.endsWith('?')) expect(sentence.startsWith('¿')).toBe(true);
      if (sentence.endsWith('!')) expect(sentence.startsWith('¡')).toBe(true);
      expect(sentence.replace(/^[¿¡]/, '')).toMatch(/^\p{Lu}/u);
    }
  });

  it('en inglés no usa signos de apertura', () => {
    const text = generateWords(['red', 'blue', 'green'], {
      language: 'en',
      count: 200,
      rng: createRng(3),
      punctuation: true,
    });
    expect(text).not.toMatch(/[¿¡]/);
    expect(text).toMatch(/[?!]/);
  });

  it('intercala números y mayúsculas cuando se piden', () => {
    const text = generateWords(LIST, {
      language: 'es',
      count: 300,
      rng: createRng(4),
      numbers: true,
      capitals: true,
    });
    expect(text).toMatch(/\b\d{1,4}\b/);
    expect(text).toMatch(/(^|\s)\p{Lu}/u);
  });

  it('rechaza listas demasiado cortas', () => {
    expect(() => generateWords(['a'], { language: 'es', count: 3, rng: createRng(1) })).toThrow();
  });
});

describe('textDifficulty', () => {
  const bigrams = bigramFrequencies(['el sol sale por el este y la casa es blanca']);

  it('da más dificultad a palabras largas, símbolos y mayúsculas', () => {
    const easy = textDifficulty('el sol sale por el este', bigrams);
    const hard = textDifficulty('Extraordinariamente, ¡INCOMPRENSIBLE! (¿Murciélago?)', bigrams);
    expect(easy).toBeLessThan(hard);
    expect(easy).toBeGreaterThanOrEqual(0);
    expect(hard).toBeLessThanOrEqual(100);
  });

  it('vale 0 para un texto vacío', () => {
    expect(textDifficulty('   ', bigrams)).toBe(0);
  });
});
