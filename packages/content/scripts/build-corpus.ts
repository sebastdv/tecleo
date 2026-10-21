/**
 * Genera `src/data/quotes.{es,en}.json` y `src/data/words.{es,en}.json`.
 *
 *   pnpm --filter @tecleo/content build:corpus
 *
 * Descarga las obras de `sources.ts` (se guardan en `.cache/`), quita la cabecera y la licencia
 * de Project Gutenberg (no se redistribuye su marca), corta fragmentos en límites de oración y
 * calcula su dificultad. Es determinista: la misma entrada produce los mismos JSON.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createRng, normalizeText, seedFromString, type Rng } from '@tecleo/engine';

import { bigramFrequencies, textDifficulty } from '../src/difficulty.ts';
import type { LengthCategory, Quote, TextLanguage } from '../src/types.ts';
import {
  BLOCKLIST,
  CONTRACTION_FRAGMENTS_EN,
  SOURCES,
  WORD_FREQUENCY_URL,
  type Source,
} from './sources.ts';

const ROOT = join(import.meta.dirname, '..');
const CACHE = join(ROOT, '.cache');
const DATA = join(ROOT, 'src', 'data');

const BINS: Readonly<Record<LengthCategory, { min: number; max: number; count: number }>> = {
  short: { min: 80, max: 140, count: 60 },
  medium: { min: 200, max: 320, count: 60 },
  long: { min: 420, max: 600, count: 40 },
};
const WORD_LIST_LENGTH = 5_000;

const ALLOWED_CHARS: Record<TextLanguage, RegExp> = {
  es: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .,;:¿?¡!'"()-]+$/,
  en: /^[A-Za-z .,;:?!'"()-]+$/,
};
/** Abreviaturas que confunden el corte por oraciones. */
const ABBREVIATION =
  /\b(?:Sr|Sra|Srta|Dr|Dra|D|Dª|Ud|Vd|Uds|Mr|Mrs|Ms|St|Mt|Capt|Col|Gen|etc)\.(?=\s|$)/;
/** Ortografía anterior a 1911: "á" como preposición, "fué", "dió"... Se descarta. */
const ARCHAIC_ES =
  /(?:^|\s)[áéóú](?=[\s,.;:]|$)|(?<!\p{L})(?:fué|dió|vió|fuí|pié|dél|dést[eo]s?|désta)(?!\p{L})/iu;
/** Inglés dialectal con letras omitidas: "th'", "nothin'". */
const DIALECT_EN = /\bth'|in'(?=[\s,.;:!?]|$)/;
const SENTENCE_BREAK = /(?<=[.!?]["']?)\s+(?=["¿¡(]?[A-ZÁÉÍÓÚÑ])/u;

async function cached(name: string, url: string): Promise<string> {
  const path = join(CACHE, name);
  if (existsSync(path)) return readFile(path, 'utf8');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  const text = await response.text();
  await writeFile(path, text);
  return text;
}

function stripGutenberg(raw: string, source: Source): string {
  const start = /\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i.exec(raw);
  const end = /\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.exec(raw);
  if (!start || !end)
    throw new Error(`Marcas de Gutenberg no encontradas en ${source.gutenbergId}`);
  return raw.slice(start.index + start[0].length, end.index);
}

function paragraphsOf(body: string): string[] {
  const paragraphs = body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // Prólogos, índices y notas suelen ocupar los extremos del libro.
  const margin = Math.floor(paragraphs.length * 0.03);
  return paragraphs.slice(margin, paragraphs.length - margin);
}

function isBalanced(text: string): boolean {
  const quotes = text.split('"').length - 1;
  const opens = text.split('(').length - 1;
  const closes = text.split(')').length - 1;
  return quotes % 2 === 0 && opens === closes;
}

function isCleanFragment(text: string, language: TextLanguage): boolean {
  if (!ALLOWED_CHARS[language].test(text)) return false;
  if (!/^["¿¡]?[A-ZÁÉÍÓÚÑ]/u.test(text) || !/[.!?]["']?$/.test(text)) return false;
  // Rayas de diálogo (normalizadas a "-") y guiones dobles de las ediciones antiguas.
  if (/(?:^|\s)-|-(?:\s|$)|--/.test(text)) return false;
  if (ABBREVIATION.test(text) || !isBalanced(text)) return false;
  if (language === 'es' && ARCHAIC_ES.test(text)) return false;
  if (language === 'en' && DIALECT_EN.test(text)) return false;
  const letters = text.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '');
  return upper.length / letters.length < 0.08;
}

interface Candidate {
  readonly source: Source;
  readonly paragraph: number;
  readonly content: string;
}

/** Para cada párrafo y longitud, la primera ventana de oraciones que cae en el rango. */
function candidatesOf(source: Source, paragraphs: string[]): Map<LengthCategory, Candidate[]> {
  const result = new Map<LengthCategory, Candidate[]>(
    Object.keys(BINS).map((bin) => [bin as LengthCategory, []]),
  );
  paragraphs.forEach((raw, paragraph) => {
    const sentences = normalizeText(raw).split(SENTENCE_BREAK);
    for (const [bin, { min, max }] of Object.entries(BINS) as [
      LengthCategory,
      (typeof BINS)[LengthCategory],
    ][]) {
      search: for (let first = 0; first < sentences.length; first++) {
        let content = '';
        for (let last = first; last < sentences.length; last++) {
          content = content ? `${content} ${sentences[last] ?? ''}` : (sentences[last] ?? '');
          if (content.length > max) break;
          if (content.length >= min) {
            if (isCleanFragment(content, source.language)) {
              result.get(bin)?.push({ source, paragraph, content });
              break search;
            }
            break;
          }
        }
      }
    }
  });
  return result;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

/** Reparte cada longitud entre todas las obras por turnos, sin repetir párrafo. */
function selectQuotes(
  language: TextLanguage,
  perSource: Map<Source, Map<LengthCategory, Candidate[]>>,
): Candidate[] {
  const rng = createRng(seedFromString(`corpus-${language}`));
  const used = new Set<string>();
  const selected: Candidate[] = [];
  for (const [bin, { count }] of Object.entries(BINS) as [
    LengthCategory,
    (typeof BINS)[LengthCategory],
  ][]) {
    const pools = [...perSource.values()].map((bins) => shuffle([...(bins.get(bin) ?? [])], rng));
    let taken = 0;
    while (taken < count && pools.some((pool) => pool.length > 0)) {
      for (const pool of pools) {
        if (taken >= count) break;
        let candidate = pool.pop();
        while (candidate && used.has(`${candidate.source.gutenbergId}:${candidate.paragraph}`)) {
          candidate = pool.pop();
        }
        if (!candidate) continue;
        used.add(`${candidate.source.gutenbergId}:${candidate.paragraph}`);
        selected.push(candidate);
        taken++;
      }
    }
    if (taken < count) throw new Error(`${language}/${bin}: solo ${taken} de ${count} fragmentos`);
  }
  return selected;
}

function lengthCategory(length: number): LengthCategory {
  if (length <= BINS.short.max) return 'short';
  return length <= BINS.medium.max ? 'medium' : 'long';
}

function buildWordList(
  language: TextLanguage,
  frequencyList: string,
  corpusWords: Set<string>,
): string[] {
  const blocked = new Set([
    ...BLOCKLIST[language],
    ...(language === 'en' ? CONTRACTION_FRAGMENTS_EN : []),
  ]);
  const valid = language === 'es' ? /^[a-záéíóúüñ]+$/ : /^[a-z]+$/;
  const words: string[] = [];
  for (const line of frequencyList.split('\n')) {
    const word = line.split(' ')[0]?.normalize('NFC') ?? '';
    if (!valid.test(word) || blocked.has(word)) continue;
    if (language === 'en' && word === 'i') {
      words.push('I');
    } else if (corpusWords.has(word) && (word.length > 1 || 'aeouy'.includes(word))) {
      words.push(word);
    }
    if (words.length === WORD_LIST_LENGTH) break;
  }
  if (words.length < WORD_LIST_LENGTH)
    throw new Error(`Lista ${language} incompleta: ${words.length}`);
  return words;
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  await mkdir(DATA, { recursive: true });

  for (const language of ['es', 'en'] as const) {
    const sources = SOURCES.filter((source) => source.language === language);
    const perSource = new Map<Source, Map<LengthCategory, Candidate[]>>();
    const corpusWords = new Set<string>();
    const allParagraphs: string[] = [];

    for (const source of sources) {
      const raw = await cached(
        `pg${source.gutenbergId}.txt`,
        `https://www.gutenberg.org/cache/epub/${source.gutenbergId}/pg${source.gutenbergId}.txt`,
      );
      const paragraphs = paragraphsOf(stripGutenberg(raw, source));
      allParagraphs.push(...paragraphs);
      for (const paragraph of paragraphs) {
        for (const token of normalizeText(paragraph).split(/[^\p{L}]+/u)) {
          if (token !== '' && token === token.toLowerCase()) corpusWords.add(token);
        }
      }
      const candidates = candidatesOf(source, paragraphs);
      perSource.set(source, candidates);
      const counts = [...candidates].map(([bin, list]) => `${bin} ${list.length}`).join(', ');
      console.log(`${language} #${source.gutenbergId} ${source.title}: ${counts}`);
    }

    const bigrams = bigramFrequencies(allParagraphs);
    const quotes: Quote[] = selectQuotes(language, perSource).map(({ source, content }) => ({
      id: `${language}-${seedFromString(content).toString(36)}`,
      language,
      content,
      author: source.author,
      source: source.title,
      gutenbergId: source.gutenbergId,
      length: content.length,
      lengthCategory: lengthCategory(content.length),
      difficulty: textDifficulty(content, bigrams),
    }));
    if (new Set(quotes.map((quote) => quote.id)).size !== quotes.length) {
      throw new Error(`IDs repetidos en ${language}`);
    }
    await writeFile(join(DATA, `quotes.${language}.json`), `${JSON.stringify(quotes, null, 2)}\n`);

    const frequencyList = await cached(`${language}_50k.txt`, WORD_FREQUENCY_URL(language));
    const words = buildWordList(language, frequencyList, corpusWords);
    await writeFile(join(DATA, `words.${language}.json`), `${JSON.stringify(words)}\n`);

    console.log(`→ ${language}: ${quotes.length} fragmentos, ${words.length} palabras`);
  }
}

await main();
