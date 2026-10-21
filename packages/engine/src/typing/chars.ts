import { stripAccents } from './normalize.js';
import type { CharState, WordState } from './types.js';

export function charsMatch(typed: string, expected: string, ignoreAccents: boolean): boolean {
  if (typed === expected) return true;
  return ignoreAccents && stripAccents(typed) === stripAccents(expected);
}

/** Índice del primer carácter que no coincide; `input.length` si todo lo escrito está bien. */
export function firstErrorIndex(input: string, target: string, ignoreAccents: boolean): number {
  for (let i = 0; i < input.length; i++) {
    const expected = target[i];
    if (expected === undefined || !charsMatch(input[i] ?? '', expected, ignoreAccents)) return i;
  }
  return input.length;
}

export function wordMatches(
  word: Pick<WordState, 'input' | 'target'>,
  ignoreAccents: boolean,
): boolean {
  return (
    word.input.length === word.target.length &&
    firstErrorIndex(word.input, word.target, ignoreAccents) === word.input.length
  );
}

/** Caracteres de la palabra que coinciden con el objetivo en su misma posición. */
export function countCorrectChars(word: WordState, ignoreAccents: boolean): number {
  let count = 0;
  const limit = Math.min(word.input.length, word.target.length);
  for (let i = 0; i < limit; i++) {
    if (charsMatch(word.input[i] ?? '', word.target[i] ?? '', ignoreAccents)) count++;
  }
  return count;
}

/** Estado de cada carácter para renderizar: largo = máx(objetivo, escrito). */
export function wordCharStates(word: WordState, ignoreAccents: boolean): CharState[] {
  const length = Math.max(word.target.length, word.input.length);
  const states: CharState[] = [];
  for (let i = 0; i < length; i++) {
    const expected = word.target[i];
    const typed = word.input[i];
    if (expected === undefined) states.push('extra');
    else if (typed === undefined) states.push('pending');
    else if (!charsMatch(typed, expected, ignoreAccents)) states.push('incorrect');
    else states.push(word.wrongAt.includes(i) ? 'corrected' : 'correct');
  }
  return states;
}
