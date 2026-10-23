import { applyInput, createTypingState, encodeKeystrokes } from '@tecleo/engine';
import type { SubmitResultInput } from '@tecleo/shared';
import { describe, expect, it } from 'vitest';

import { localWeaknesses } from './local-weaknesses';

function result(text: string, typed: string): SubmitResultInput {
  let state = createTypingState({ text, rules: { mode: 'free' } });
  Array.from(typed).forEach((input, index) => {
    const action =
      input === '\b'
        ? { type: 'deleteBackward' as const }
        : { type: 'insert' as const, text: input };
    state = applyInput(state, action, 150 * index);
  });
  return {
    mode: 'practice',
    textId: null,
    content: text,
    preserveLines: false,
    language: 'es',
    rules: { mode: 'free', ignoreAccents: false },
    timeLimitMs: null,
    practiceKind: 'words',
    bots: null,
    keystrokes: encodeKeystrokes(state.keystrokes) as SubmitResultInput['keystrokes'],
    playedAt: new Date().toISOString(),
  };
}

describe('puntos débiles de un invitado', () => {
  it('suma intentos y errores de todas sus pruebas guardadas', () => {
    const { keys, bigrams } = localWeaknesses([
      // Una «r» equivocada (x) que se corrige.
      result('perro', 'pex\brro'),
      result('perro', 'perro'),
      { ...result('sol', 'sol'), keystrokes: { deltas: [1], inputs: 'xy' } },
    ]);
    expect(keys.find((stat) => stat.key === 'r')).toEqual({ key: 'r', attempts: 5, errors: 1 });
    expect(bigrams.find((stat) => stat.key === 'er')?.errors).toBe(1);
  });
});
