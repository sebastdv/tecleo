import { describe, expect, it } from 'vitest';

import { decodeKeystrokes, encodeKeystrokes } from './codec.js';
import { playKeystrokes, replayKeystrokes } from './replay.js';
import { applyInput, createTypingState } from './state.js';
import { typeText } from './test-helpers.js';
import { BACKSPACE } from './types.js';

describe('encodeKeystrokes / decodeKeystrokes', () => {
  it('ida y vuelta conserva tiempos y caracteres (tildes, ñ y borrados)', () => {
    let state = typeText(createTypingState({ text: 'año ñandú' }), 'añp', 1_000, 137);
    state = applyInput(state, { type: 'deleteBackward' }, 2_000);
    state = typeText(state, 'o ñandú', 2_150, 91);
    const encoded = encodeKeystrokes(state.keystrokes);
    expect(Array.from(encoded.inputs)).toHaveLength(state.keystrokes.length);
    expect(encoded.inputs).toContain(BACKSPACE);
    const decoded = decodeKeystrokes(encoded);
    expect(decoded).toEqual(state.keystrokes.map(({ t, input }) => ({ t, input })));
    expect(replayKeystrokes(state, decoded).keystrokes).toEqual(state.keystrokes);
  });

  it('rechaza un registro con distinta cantidad de tiempos y caracteres', () => {
    expect(() => decodeKeystrokes({ deltas: [0, 1], inputs: 'abc' })).toThrow();
  });
});

describe('playKeystrokes', () => {
  it('respeta el límite de tiempo: descarta lo escrito después y cierra en el límite', () => {
    const template = createTypingState({ text: 'uno dos tres', timeLimitMs: 1_000 });
    const keystrokes = Array.from('uno dos').map((input, index) => ({ t: index * 200, input }));
    const result = playKeystrokes(template, keystrokes);
    expect(result.phase).toBe('finished');
    expect(result.finishedAt).toBe(1_000);
    expect(result.keystrokes.every((keystroke) => keystroke.t < 1_000)).toBe(true);
  });

  it('un registro que no completa un texto sin límite queda en curso', () => {
    const template = createTypingState({ text: 'hola mundo' });
    expect(playKeystrokes(template, [{ t: 0, input: 'h' }]).phase).toBe('running');
  });
});
