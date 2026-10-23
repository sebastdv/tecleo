import { correctChars, createTypingState, replayKeystrokes } from '@tecleo/engine';
import { describe, expect, it } from 'vitest';

import { ReplayCursor } from './replay-cursor';

const template = createTypingState({ text: 'sol y mar' });
const keystrokes = Array.from('sol y mar').map((input, index) => ({ t: 100 * (index + 1), input }));

describe('ReplayCursor', () => {
  it('muestra lo escrito hasta cada instante, hacia adelante y hacia atrás', () => {
    const cursor = new ReplayCursor(template, keystrokes);
    expect(cursor.durationMs).toBe(900);
    expect(correctChars(cursor.at(0))).toBe(0);
    expect(correctChars(cursor.at(350))).toBe(3);
    expect(correctChars(cursor.at(900))).toBe(9);
    expect(cursor.at(900).phase).toBe('finished');
    expect(correctChars(cursor.at(150))).toBe(1);
  });

  it('al final coincide con reproducir todo de una vez', () => {
    const cursor = new ReplayCursor(template, keystrokes);
    cursor.at(400);
    expect(cursor.at(10_000).words).toEqual(replayKeystrokes(template, keystrokes).words);
  });
});
