import { applyInput } from './state.js';
import { wordCharStates } from './chars.js';
import type { CharState, TypingState } from './types.js';

/** Escribe `text` carácter a carácter, uno cada `stepMs`, empezando en `from`. Solo para tests. */
export function typeText(state: TypingState, text: string, from = 0, stepMs = 100): TypingState {
  let current = state;
  let at = from;
  // Por puntos de código: cada carácter compuesto (á, ñ) es una pulsación.
  for (const ch of text) {
    current = applyInput(current, { type: 'insert', text: ch }, at);
    at += stepMs;
  }
  return current;
}

export function backspace(state: TypingState, at: number, times = 1): TypingState {
  let current = state;
  for (let i = 0; i < times; i++) current = applyInput(current, { type: 'deleteBackward' }, at);
  return current;
}

export function inputs(state: TypingState): string[] {
  return state.words.map((word) => word.input);
}

export function charStatesAt(state: TypingState, wordIndex: number): CharState[] {
  const word = state.words[wordIndex];
  if (!word) throw new Error(`No existe la palabra ${wordIndex}`);
  return wordCharStates(word, state.rules.ignoreAccents);
}
