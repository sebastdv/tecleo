import { describe, expect, it } from 'vitest';

import { createBots } from '../bots/bot.js';
import { BOT_LEVEL_IDS } from '../bots/levels.js';
import { analyze } from '../metrics/metrics.js';
import { playKeystrokes } from '../typing/replay.js';
import { createTypingState } from '../typing/state.js';
import { inspectRun } from './anticheat.js';

const TEXT =
  'Era un hombre de mediana estatura, de mirada viva y paso ligero, que conocía cada calle ' +
  'del pueblo y saludaba a todos por su nombre.';

function run(intervalMs: (index: number) => number) {
  let t = 0;
  const keystrokes = Array.from(TEXT).map((input, index) => {
    t += index === 0 ? 0 : intervalMs(index);
    return { t, input };
  });
  const state = playKeystrokes(createTypingState({ text: TEXT, startOn: 'signal' }), keystrokes);
  return inspectRun(analyze(state), state.keystrokes);
}

describe('inspectRun', () => {
  it('no marca a los bots de ningún nivel (ritmo humano)', () => {
    const bots = createBots({ text: TEXT, levels: [...BOT_LEVEL_IDS], seed: 12 });
    for (const bot of bots) {
      const state = playKeystrokes(
        createTypingState({ text: TEXT, startOn: 'signal', rules: { mode: 'strict' } }),
        bot.keystrokes,
      );
      expect(inspectRun(analyze(state), state.keystrokes)).toEqual({ flagged: false, reasons: [] });
    }
  });

  it('marca intervalos sospechosamente uniformes (script)', () => {
    expect(run(() => 150).reasons).toContain('uniform-intervals');
  });

  it('marca un ppm imposible', () => {
    // ~35 ms entre teclas: unos 340 ppm.
    const report = run((index) => 20 + (index % 7) * 5);
    expect(report.flagged).toBe(true);
    expect(report.reasons).toContain('implausible-wpm');
  });

  it('acepta un ritmo humano rápido pero plausible', () => {
    const report = run((index) => 90 + ((index * 37) % 11) * 12);
    expect(report).toEqual({ flagged: false, reasons: [] });
  });
});
