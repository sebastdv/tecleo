import {
  CODE_SNIPPETS,
  generateWords,
  loadQuotes,
  loadWords,
  pickQuote,
  type CodeSnippet,
  type LengthCategory,
  type Quote,
  type TextLanguage,
  type WordListSize,
} from '@tecleo/content';
import { createRng, randomInt, type TypingMode } from '@tecleo/engine';

export type PracticeMode = 'time' | 'words' | 'text';
export type TextKind = 'quote' | 'code';

export const DURATIONS = [15, 30, 60, 120] as const;
export const WORD_COUNTS = [10, 25, 50, 100] as const;

export interface PracticeConfig {
  readonly mode: PracticeMode;
  readonly durationSeconds: (typeof DURATIONS)[number];
  readonly wordCount: (typeof WORD_COUNTS)[number];
  readonly language: TextLanguage;
  readonly listSize: WordListSize;
  readonly punctuation: boolean;
  readonly numbers: boolean;
  readonly textKind: TextKind;
  readonly quoteLength: LengthCategory | 'any';
  readonly typingMode: TypingMode;
  readonly ignoreAccents: boolean;
}

export const DEFAULT_CONFIG: PracticeConfig = {
  mode: 'time',
  durationSeconds: 30,
  wordCount: 25,
  language: 'es',
  listSize: 200,
  punctuation: false,
  numbers: false,
  textKind: 'quote',
  quoteLength: 'any',
  // En práctica el modo libre es el habitual; las carreras usan estricto.
  typingMode: 'free',
  ignoreAccents: false,
};

/** Palabras iniciales del modo por tiempo y cuántas se agregan cuando quedan pocas. */
export const TIME_MODE_INITIAL_WORDS = 60;
export const TIME_MODE_REFILL_WORDS = 40;
export const TIME_MODE_REFILL_THRESHOLD = 20;

export interface PracticeText {
  readonly text: string;
  readonly preserveLines: boolean;
  readonly quote: Quote | null;
  readonly snippet: CodeSnippet | null;
  /** Solo en modo por tiempo: genera más palabras con la misma semilla. */
  readonly more: ((count: number) => string) | null;
}

/** Arma el texto de una prueba. Es determinista para una misma semilla y configuración. */
export async function buildPracticeText(
  config: PracticeConfig,
  seed: number,
  excludeId?: string,
): Promise<PracticeText> {
  const rng = createRng(seed);

  if (config.mode === 'text') {
    if (config.textKind === 'code') {
      const pool = CODE_SNIPPETS.filter((snippet) => snippet.id !== excludeId);
      const snippet = pool[randomInt(rng, 0, pool.length - 1)] ?? CODE_SNIPPETS[0];
      if (!snippet) throw new Error('No hay fragmentos de código');
      return { text: snippet.content, preserveLines: true, quote: null, snippet, more: null };
    }
    const quotes = await loadQuotes(config.language);
    const quote = pickQuote(quotes, rng, {
      ...(config.quoteLength !== 'any' && { lengthCategory: config.quoteLength }),
      ...(excludeId !== undefined && { excludeId }),
    });
    return { text: quote.content, preserveLines: false, quote, snippet: null, more: null };
  }

  const list = await loadWords(config.language, config.listSize);
  const words = (count: number) =>
    generateWords(list, {
      language: config.language,
      count,
      rng,
      punctuation: config.punctuation,
      numbers: config.numbers,
    });
  const initial = config.mode === 'time' ? TIME_MODE_INITIAL_WORDS : config.wordCount;
  return {
    text: words(initial),
    preserveLines: false,
    quote: null,
    snippet: null,
    more: config.mode === 'time' ? words : null,
  };
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? Date.now() >>> 0;
}
