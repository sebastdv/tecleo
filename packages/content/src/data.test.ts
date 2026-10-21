import { createRng, createTypingState, normalizeText, stateText } from '@tecleo/engine';
import { describe, expect, it } from 'vitest';

import { CODE_SNIPPETS, loadQuotes, loadWords, pickQuote, TEXT_LANGUAGES } from './index.js';

describe.each(TEXT_LANGUAGES)('corpus %s', (language) => {
  it('tiene al menos 150 fragmentos con las tres longitudes', async () => {
    const quotes = await loadQuotes(language);
    expect(quotes.length).toBeGreaterThanOrEqual(150);
    for (const category of ['short', 'medium', 'long'] as const) {
      expect(quotes.filter((q) => q.lengthCategory === category).length).toBeGreaterThanOrEqual(40);
    }
  });

  it('cada fragmento está normalizado, atribuido y con metadatos coherentes', async () => {
    const quotes = await loadQuotes(language);
    const ids = new Set<string>();
    for (const quote of quotes) {
      expect(quote.language).toBe(language);
      expect(normalizeText(quote.content)).toBe(quote.content);
      expect(quote.length).toBe(quote.content.length);
      expect(quote.author).not.toBe('');
      expect(quote.source).not.toBe('');
      expect(quote.gutenbergId).toBeGreaterThan(0);
      expect(quote.difficulty).toBeGreaterThanOrEqual(0);
      expect(quote.difficulty).toBeLessThanOrEqual(100);
      expect(quote.content).not.toMatch(/gutenberg/i);
      expect(ids.has(quote.id)).toBe(false);
      ids.add(quote.id);
    }
  });

  it('las listas de palabras están ordenadas, sin repetidos y anidadas por tamaño', async () => {
    const top200 = await loadWords(language, 200);
    const top5000 = await loadWords(language, 5000);
    expect(top200).toHaveLength(200);
    expect(top5000).toHaveLength(5000);
    expect(top5000.slice(0, 200)).toEqual(top200);
    expect(new Set(top5000).size).toBe(5000);
    for (const word of top5000) expect(word).toMatch(/^\p{L}+$/u);
  });
});

describe('fragmentos de código', () => {
  it('se pueden escribir con el motor conservando líneas y sangría', () => {
    const ids = new Set(CODE_SNIPPETS.map((snippet) => snippet.id));
    expect(ids.size).toBe(CODE_SNIPPETS.length);
    for (const snippet of CODE_SNIPPETS) {
      const state = createTypingState({ text: snippet.content, preserveLines: true });
      expect(stateText(state)).toBe(snippet.content);
    }
  });
});

describe('pickQuote', () => {
  it('es determinista, filtra por longitud y evita repetir', async () => {
    const quotes = await loadQuotes('es');
    const a = pickQuote(quotes, createRng(5), { lengthCategory: 'short' });
    expect(pickQuote(quotes, createRng(5), { lengthCategory: 'short' })).toBe(a);
    expect(a.lengthCategory).toBe('short');
    const single = quotes.slice(0, 2);
    expect(pickQuote(single, createRng(1), { excludeId: single[0]?.id ?? '' })).toBe(single[1]);
  });

  it('falla si no queda ningún texto', () => {
    expect(() => pickQuote([], createRng(1))).toThrow();
  });
});
