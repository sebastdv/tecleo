import { describe, expect, it } from 'vitest';

import { analyze } from '../metrics/metrics.js';
import { replayKeystrokes } from '../typing/replay.js';
import { createTypingState, start } from '../typing/state.js';
import { BACKSPACE } from '../typing/types.js';
import {
  botProgressAt,
  botWpmAt,
  createBotProfile,
  createBots,
  simulateBot,
  type BotRun,
} from './bot.js';
import { BOT_LEVEL_IDS, BOT_LEVELS } from './levels.js';

const TEXT =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía ' +
  'un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.';

/** Reproduce el registro del bot con el motor, como haría el servidor para validarlo. */
function finalState(run: BotRun, text = TEXT) {
  const template = start(
    createTypingState({ text, startOn: 'signal', rules: { mode: 'strict' } }),
    0,
  );
  return replayKeystrokes(template, run.keystrokes);
}

function intervals(run: BotRun): number[] {
  const inserts = run.keystrokes.filter((k) => k.input !== BACKSPACE);
  return inserts.slice(1).map((k, i) => k.t - (inserts[i]?.t ?? 0));
}

function coefficientOfVariation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

describe('createBotProfile', () => {
  it('muestrea el ppm objetivo dentro del rango del nivel', () => {
    for (const level of BOT_LEVEL_IDS) {
      for (let seed = 0; seed < 200; seed++) {
        const { targetWpm } = createBotProfile({ level, seed });
        expect(targetWpm).toBeGreaterThanOrEqual(BOT_LEVELS[level].minWpm);
        expect(targetWpm).toBeLessThanOrEqual(BOT_LEVELS[level].maxWpm);
      }
    }
  });
});

describe.each(BOT_LEVEL_IDS)('bot %s', (level) => {
  const spec = BOT_LEVELS[level];
  const runs = Array.from({ length: 12 }, (_, seed) =>
    simulateBot({ text: TEXT, profile: createBotProfile({ level, seed }), seed: seed * 7 + 1 }),
  );

  it('termina el texto y su ppm final (medido por el motor) cae en el rango del nivel', () => {
    for (const run of runs) {
      const state = finalState(run);
      expect(state.phase).toBe('finished');
      const { wpm } = analyze(state);
      expect(wpm).toBeGreaterThanOrEqual(spec.minWpm - 0.5);
      expect(wpm).toBeLessThanOrEqual(spec.maxWpm + 0.5);
      expect(wpm).toBeCloseTo(run.profile.targetWpm, 0);
    }
  });

  it('tiene un ritmo irregular, no lineal', () => {
    for (const run of runs) {
      expect(coefficientOfVariation(intervals(run))).toBeGreaterThan(0.25);
    }
  });

  it('se equivoca a veces y corrige con backspace', () => {
    const backspaces = runs.flatMap((run) => run.keystrokes).filter((k) => k.input === BACKSPACE);
    const errors = runs
      .flatMap((run) => run.keystrokes)
      .filter((k) => k.expected !== '' && !k.correct);
    expect(errors.length).toBeGreaterThan(0);
    expect(backspaces.length).toBeGreaterThanOrEqual(errors.length);
    const accuracies = runs.map((run) => analyze(finalState(run)).accuracy);
    expect(Math.min(...accuracies)).toBeLessThan(100);
  });
});

describe('simulateBot', () => {
  it('es determinista para la misma semilla', () => {
    const profile = createBotProfile({ level: 'advanced', seed: 3 });
    const a = simulateBot({ text: TEXT, profile, seed: 99 });
    const b = simulateBot({ text: TEXT, profile, seed: 99 });
    expect(a.keystrokes).toEqual(b.keystrokes);
    expect(simulateBot({ text: TEXT, profile, seed: 100 }).keystrokes).not.toEqual(a.keystrokes);
  });

  it('hace pausas más largas después de la puntuación', () => {
    const profile = {
      ...createBotProfile({ level: 'expert', seed: 1 }),
      finish: 'steady' as const,
    };
    const text = 'uno. dos, tres; cuatro. cinco, seis; siete. ocho, nueve; diez. once, doce.';
    const gaps = { afterPunctuation: [] as number[], normal: [] as number[] };
    for (let seed = 1; seed <= 20; seed++) {
      const inserts = simulateBot({ text, profile, seed }).keystrokes.filter(
        (k) => k.input !== BACKSPACE,
      );
      inserts.forEach((k, i) => {
        const prev = inserts[i - 1];
        if (!prev || !k.correct || !prev.correct) return;
        const gap = k.t - prev.t;
        // La pausa cae entre el signo y el espacio que lo sigue.
        if (/[.,;]/.test(prev.input) && k.input === ' ') gaps.afterPunctuation.push(gap);
        else if (/[a-z]/.test(prev.input) && /[a-z]/.test(k.input)) gaps.normal.push(gap);
      });
    }
    const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean(gaps.afterPunctuation)).toBeGreaterThan(mean(gaps.normal) * 1.5);
  });

  it('funciona con código (saltos de línea y sangría)', () => {
    const code = 'if (x) {\n  return y;\n}';
    const profile = createBotProfile({ level: 'intermediate', seed: 5 });
    const run = simulateBot({ text: code, preserveLines: true, profile, seed: 5 });
    expect(run.finishMs).toBeGreaterThan(0);
  });
});

describe('progreso en el tiempo', () => {
  const run = simulateBot({
    text: TEXT,
    profile: createBotProfile({ level: 'intermediate', seed: 8 }),
    seed: 8,
  });

  it('avanza de 0 a 1 de forma monótona', () => {
    expect(botProgressAt(run, 0)).toBe(0);
    expect(botProgressAt(run, run.finishMs)).toBe(1);
    expect(botProgressAt(run, run.finishMs + 10_000)).toBe(1);
    let previous = 0;
    for (let t = 0; t <= run.finishMs; t += 250) {
      const progress = botProgressAt(run, t);
      expect(progress).toBeGreaterThanOrEqual(previous - 0.05); // un error borrado retrocede poco
      previous = progress;
    }
  });

  it('el ppm en vivo converge al final', () => {
    expect(botWpmAt(run, 500)).toBe(0);
    expect(botWpmAt(run, run.finishMs)).toBeCloseTo(run.profile.targetWpm, 0);
    expect(botWpmAt(run, run.finishMs + 5_000)).toBeCloseTo(run.profile.targetWpm, 0);
  });
});

describe('createBots', () => {
  it('crea bots con nombres distintos y carreras distintas', () => {
    const bots = createBots({ text: TEXT, levels: ['advanced', 'advanced', 'advanced'], seed: 4 });
    expect(new Set(bots.map((bot) => bot.profile.name)).size).toBe(3);
    expect(new Set(bots.map((bot) => bot.finishMs)).size).toBe(3);
    expect(bots.map((bot) => bot.profile.id)).toEqual(['bot-0', 'bot-1', 'bot-2']);
  });
});
