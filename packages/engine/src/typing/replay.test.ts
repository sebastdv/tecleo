import { describe, expect, it } from 'vitest';

import { createRng, randomInt } from '../rng/rng.js';
import { replayKeystrokes } from './replay.js';
import { applyInput, createTypingState } from './state.js';
import type { TypingAction, TypingMode, TypingState } from './types.js';

const TEXT = '¿Dónde está el niño? Allí, junto al árbol.';

/** Escritura aleatoria pero reproducible: aciertos, errores, borrados y espacios. */
function randomSession(mode: TypingMode, seed: number): TypingState {
  const rng = createRng(seed);
  let state = createTypingState({ text: TEXT, rules: { mode } });
  let now = 1_000;
  for (let i = 0; i < 400 && state.phase !== 'finished'; i++) {
    now += randomInt(rng, 20, 400);
    const word = state.words[state.wordIndex];
    const expected = word?.target[word.input.length] ?? ' ';
    const roll = rng();
    let action: TypingAction;
    if (roll < 0.7) action = { type: 'insert', text: expected };
    else if (roll < 0.8) action = { type: 'insert', text: 'xñé '.charAt(randomInt(rng, 0, 3)) };
    else if (roll < 0.95) action = { type: 'deleteBackward' };
    else action = { type: 'deleteWord' };
    state = applyInput(state, action, now);
  }
  return state;
}

describe('replayKeystrokes', () => {
  it.each(['strict', 'free'] as const)(
    'reproduce exactamente sesiones aleatorias en modo %s',
    (mode) => {
      for (let seed = 1; seed <= 25; seed++) {
        const original = randomSession(mode, seed);
        const replayed = replayKeystrokes(original, original.keystrokes);
        expect(replayed.words.map((w) => w.input)).toEqual(original.words.map((w) => w.input));
        expect(replayed.wordIndex).toBe(original.wordIndex);
        expect(replayed.keystrokes).toEqual(original.keystrokes);
        expect(replayed.phase).toBe(original.phase);
      }
    },
  );

  it('un registro manipulado no produce el texto completo', () => {
    let state = createTypingState({ text: 'hola' });
    for (const [t, ch] of [
      [0, 'h'],
      [100, 'o'],
      [200, 'l'],
      [300, 'a'],
    ] as const) {
      state = applyInput(state, { type: 'insert', text: ch }, t);
    }
    const tampered = state.keystrokes.map((k, i) => (i === 2 ? { ...k, input: 'x' } : k));
    expect(replayKeystrokes(state, tampered).phase).not.toBe('finished');
  });
});
