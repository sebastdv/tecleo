import { randomInt, type Rng } from '@tecleo/engine';

import type { LengthCategory, Quote, TextLanguage, WordListSize } from './types.js';

export * from './types.js';
export { CODE_SNIPPETS } from './data/code.js';
export { generateWords, type GenerateWordsOptions } from './words.js';
export { bigramFrequencies, textDifficulty, type BigramFrequencies } from './difficulty.js';
export {
  targetedWords,
  targetWeight,
  weakSpots,
  type Attempted,
  type WeakSpots,
} from './targeted.js';

// Los JSON los genera `scripts/build-corpus.ts` y los validan los tests de `data.test.ts`;
// el tipo inferido de un JSON no conserva las uniones literales, de ahí las conversiones.

/** Fragmentos de un idioma. Se cargan bajo demanda para no inflar el bundle inicial. */
export async function loadQuotes(language: TextLanguage): Promise<readonly Quote[]> {
  const data =
    language === 'es'
      ? await import('./data/quotes.es.json', { with: { type: 'json' } })
      : await import('./data/quotes.en.json', { with: { type: 'json' } });
  return data.default as readonly Quote[];
}

/** Las `size` palabras más frecuentes del idioma, de más a menos frecuente. */
export async function loadWords(
  language: TextLanguage,
  size: WordListSize,
): Promise<readonly string[]> {
  const data =
    language === 'es'
      ? await import('./data/words.es.json', { with: { type: 'json' } })
      : await import('./data/words.en.json', { with: { type: 'json' } });
  return (data.default as readonly string[]).slice(0, size);
}

export interface PickQuoteOptions {
  readonly lengthCategory?: LengthCategory;
  /** Evita repetir el último texto. */
  readonly excludeId?: string;
}

export function pickQuote(
  quotes: readonly Quote[],
  rng: Rng,
  options: PickQuoteOptions = {},
): Quote {
  const pool = quotes.filter(
    (quote) =>
      (options.lengthCategory === undefined || quote.lengthCategory === options.lengthCategory) &&
      quote.id !== options.excludeId,
  );
  const quote = pool[randomInt(rng, 0, Math.max(0, pool.length - 1))];
  if (!quote) throw new Error('No hay textos que cumplan el filtro');
  return quote;
}
