import { randomInt, type Rng } from '@tecleo/engine';

import type { TextLanguage } from './types.js';

export interface GenerateWordsOptions {
  readonly language: TextLanguage;
  readonly count: number;
  readonly rng: Rng;
  /** Agrupa en oraciones con mayúscula inicial, comas y cierre (¿…? ¡…! en español). */
  readonly punctuation?: boolean;
  /** Intercala números de 1 a 4 cifras. */
  readonly numbers?: boolean;
  /** Pone mayúscula inicial a algunas palabras. */
  readonly capitals?: boolean;
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase() + word.slice(1);
}

/**
 * Palabras al azar de la lista (sin repetir la anterior), con los adornos pedidos.
 * Es determinista para una misma semilla.
 */
export function generateWords(list: readonly string[], options: GenerateWordsOptions): string {
  if (list.length < 2) throw new Error('La lista necesita al menos dos palabras');
  const { language, count, rng, punctuation = false, numbers = false, capitals = false } = options;

  const words: string[] = [];
  let previous = '';
  for (let i = 0; i < count; i++) {
    let word: string;
    if (numbers && rng() < 0.1) {
      word = String(randomInt(rng, 0, 9_999));
    } else {
      do word = list[randomInt(rng, 0, list.length - 1)] ?? '';
      while (word === previous);
      if (capitals && rng() < 0.25) word = capitalize(word);
    }
    words.push(word);
    previous = word;
  }
  return punctuation ? punctuate(words, language, rng) : words.join(' ');
}

function punctuate(words: string[], language: TextLanguage, rng: Rng): string {
  const out: string[] = [];
  let index = 0;
  while (index < words.length) {
    const length = Math.min(randomInt(rng, 3, 10), words.length - index);
    const sentence = words.slice(index, index + length);
    index += length;
    for (let i = 0; i < sentence.length - 1; i++) {
      if (rng() < 0.12) sentence[i] = `${sentence[i] ?? ''},`;
    }
    sentence[0] = capitalize(sentence[0] ?? '');

    const roll = rng();
    const ending = roll < 0.7 ? '.' : roll < 0.85 ? '?' : '!';
    const last = sentence.length - 1;
    sentence[last] = `${sentence[last] ?? ''}${ending}`;
    if (language === 'es' && ending !== '.') {
      sentence[0] = `${ending === '?' ? '¿' : '¡'}${sentence[0]}`;
    }
    out.push(...sentence);
  }
  return out.join(' ');
}
