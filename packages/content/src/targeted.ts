import type { Rng } from '@tecleo/engine';

/** Intentos y errores de una tecla o un par de letras (de `KeyStat` o de `analyze`). */
export interface Attempted {
  readonly key: string;
  readonly attempts: number;
  readonly errors: number;
}

export interface WeakSpots {
  readonly keys: readonly string[];
  readonly bigrams: readonly string[];
}

const MIN_ATTEMPTS = 5;
const LIMIT = 6;
/** Suavizado: con pocos intentos, un error pesa menos (evita que una tecla rara domine). */
const PRIOR = 5;

function weakest(stats: readonly Attempted[], valid: (key: string) => boolean): string[] {
  return stats
    .filter((stat) => stat.attempts >= MIN_ATTEMPTS && stat.errors > 0 && valid(stat.key))
    .map((stat) => ({ key: stat.key, rate: stat.errors / (stat.attempts + PRIOR) }))
    .sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key))
    .slice(0, LIMIT)
    .map((stat) => stat.key.toLowerCase());
}

const LETTER = /^\p{L}$/u;
const LETTERS = /^\p{L}{2}$/u;

/**
 * Las teclas y pares de letras donde más falla una persona (spec 5.7). Solo letras: los
 * espacios y signos no se pueden ejercitar con palabras de la lista.
 */
export function weakSpots(keys: readonly Attempted[], bigrams: readonly Attempted[]): WeakSpots {
  return {
    keys: [...new Set(weakest(keys, (key) => LETTER.test(key)))],
    bigrams: [...new Set(weakest(bigrams, (key) => LETTERS.test(key)))],
  };
}

function occurrences(word: string, part: string): number {
  let count = 0;
  for (let index = word.indexOf(part); index !== -1; index = word.indexOf(part, index + 1)) count++;
  return count;
}

/** Peso de una palabra para el ejercicio: cuánto practica los puntos débiles. */
export function targetWeight(word: string, spots: WeakSpots): number {
  const lower = word.toLowerCase();
  let weight = 0;
  for (const bigram of spots.bigrams) weight += 3 * occurrences(lower, bigram);
  for (const key of spots.keys) weight += occurrences(lower, key);
  return weight;
}

/**
 * Ejercicio dirigido: `count` palabras de la lista elegidas al azar con probabilidad
 * proporcional a cuánto practican los puntos débiles. Devuelve `null` si casi ninguna palabra
 * los contiene (no hay con qué armar el ejercicio). Es determinista para una misma semilla.
 */
export function targetedWords(
  list: readonly string[],
  spots: WeakSpots,
  count: number,
  rng: Rng,
): string | null {
  const pool = list
    .map((word) => ({ word, weight: targetWeight(word, spots) }))
    .filter((entry) => entry.weight > 0);
  if (pool.length < 10) return null;
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  const words: string[] = [];
  while (words.length < count) {
    let roll = rng() * total;
    const picked = pool.find((entry) => (roll -= entry.weight) < 0) ?? pool[pool.length - 1];
    if (picked && picked.word !== words.at(-1)) words.push(picked.word);
  }
  return words.join(' ');
}
