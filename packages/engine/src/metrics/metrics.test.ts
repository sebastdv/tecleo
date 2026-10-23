import { describe, expect, it } from 'vitest';

import { applyInput, createTypingState, tick } from '../typing/state.js';
import { typeText } from '../typing/test-helpers.js';
import type { TypingAction, TypingState } from '../typing/types.js';
import { analyze, consistency, liveMetrics, progressTimeline, wpmFrom } from './metrics.js';

/** Aplica una secuencia de acciones en tiempos dados. `'⌫'` es backspace. */
function play(state: TypingState, steps: readonly [number, string][]): TypingState {
  return steps.reduce((current, [t, key]) => {
    const action: TypingAction =
      key === '⌫' ? { type: 'deleteBackward' } : { type: 'insert', text: key };
    return applyInput(current, action, t);
  }, state);
}

describe('wpmFrom', () => {
  it('usa palabras de 5 caracteres', () => {
    expect(wpmFrom(50, 60_000)).toBe(10);
    expect(wpmFrom(10, 0)).toBe(0);
  });
});

describe('analyze', () => {
  it('texto perfecto: WPM neto = bruto, precisión 100 y consistencia 100', () => {
    const state = typeText(createTypingState({ text: 'hola mundo' }), 'hola mundo', 0, 100);
    const metrics = analyze(state);
    expect(metrics.durationMs).toBe(900);
    expect(metrics.correctChars).toBe(10);
    expect(metrics.wpm).toBeCloseTo(133.333, 2);
    expect(metrics.rawWpm).toBeCloseTo(133.333, 2);
    expect(metrics.accuracy).toBe(100);
    expect(metrics.consistency).toBe(100);
    expect(metrics.peakWpm).toBeCloseTo(metrics.wpm, 6);
    expect(metrics.timeline).toEqual([
      { second: 1, wpm: metrics.wpm, raw: metrics.rawWpm, errors: 0 },
    ]);
  });

  it('error corregido: precisión, bruto, línea de tiempo y estadísticas por tecla', () => {
    const state = play(createTypingState({ text: 'sol' }), [
      [0, 's'],
      [500, 'x'],
      [1_000, '⌫'],
      [1_500, 'o'],
      [2_000, 'l'],
    ]);
    const metrics = analyze(state);
    expect(metrics.durationMs).toBe(2_000);
    expect(metrics.accuracy).toBe(75);
    expect(metrics.typedChars).toBe(4);
    expect(metrics.incorrectKeystrokes).toBe(1);
    expect(metrics.wpm).toBeCloseTo(18, 6);
    expect(metrics.rawWpm).toBeCloseTo(24, 6);
    expect(metrics.timeline).toEqual([
      { second: 1, wpm: 12, raw: 24, errors: 1 },
      { second: 2, wpm: 18, raw: 24, errors: 0 },
    ]);
    expect(metrics.keyStats).toEqual({
      s: { attempts: 1, errors: 0 },
      o: { attempts: 2, errors: 1 },
      l: { attempts: 1, errors: 0 },
    });
    expect(metrics.bigramStats).toEqual({
      so: { attempts: 2, errors: 1 },
      ol: { attempts: 1, errors: 0 },
    });
  });

  it('modo libre: lo no escrito cuenta como error y no suma caracteres correctos', () => {
    const state = typeText(
      createTypingState({ text: 'casa roja', rules: { mode: 'free' } }),
      'cas roja',
      0,
      250,
    );
    const metrics = analyze(state);
    expect(state.phase).toBe('finished');
    expect(metrics.missedChars).toBe(1);
    expect(metrics.correctChars).toBe(7);
    expect(metrics.accuracy).toBeCloseTo((7 / 9) * 100, 6);
  });

  it('pico de WPM: mejor ventana de 5 segundos', () => {
    const text = 'a'.repeat(75);
    let state = createTypingState({ text });
    for (let i = 0; i < 50; i++) state = applyInput(state, { type: 'insert', text: 'a' }, i * 100);
    for (let j = 0; j < 25; j++) {
      state = applyInput(state, { type: 'insert', text: 'a' }, 5_000 + j * 200);
    }
    const metrics = analyze(state);
    expect(metrics.durationMs).toBe(9_800);
    expect(metrics.peakWpm).toBeCloseTo(120, 6);
    expect(metrics.wpm).toBeCloseTo(75 / 5 / (9.8 / 60), 6);
    expect(metrics.timeline).toHaveLength(10);
    expect(metrics.timeline[4]?.wpm).toBeCloseTo(120, 6);
    expect(metrics.consistency).toBeLessThan(100);
  });

  it('modo por tiempo: la duración es el límite aunque la última pulsación sea anterior', () => {
    let state = createTypingState({ text: 'uno dos tres cuatro', timeLimitMs: 15_000 });
    state = typeText(state, 'uno dos', 0, 200);
    state = tick(state, 15_000);
    const metrics = analyze(state);
    expect(metrics.durationMs).toBe(15_000);
    expect(metrics.timeline).toHaveLength(15);
    expect(metrics.correctChars).toBe(7);
    expect(metrics.wpm).toBeCloseTo(wpmFrom(7, 15_000), 6);
  });

  it('un último tramo de menos de medio segundo se une al segundo anterior', () => {
    // 2,05 s: sin unir, el tramo final de 50 ms daría un WPM bruto absurdo.
    let state = createTypingState({ text: 'abcdefghij' });
    for (let i = 0; i < 9; i++)
      state = applyInput(state, { type: 'insert', text: 'abcdefghi'.charAt(i) }, i * 250);
    state = applyInput(state, { type: 'insert', text: 'j' }, 2_050);
    const metrics = analyze(state);
    expect(metrics.durationMs).toBe(2_050);
    expect(metrics.timeline).toHaveLength(2);
    // Segundo 2: de 1000 a 2050 ms, 6 pulsaciones (t = 1000, 1250, 1500, 1750, 2000, 2050).
    expect(metrics.timeline[1]?.raw).toBeCloseTo(wpmFrom(6, 1_050), 6);
    expect(Math.max(...metrics.timeline.map((sample) => sample.raw))).toBeLessThan(100);
    // Con el tramo de 50 ms separado, la consistencia caería a 0.
    expect(metrics.consistency).toBeGreaterThan(50);
  });

  it('una prueba de menos de medio segundo tiene un solo tramo', () => {
    const state = typeText(createTypingState({ text: 'ab' }), 'ab', 0, 200);
    const metrics = analyze(state);
    expect(metrics.timeline).toHaveLength(1);
    expect(metrics.timeline[0]?.second).toBe(1);
  });

  it('solo analiza pruebas terminadas', () => {
    const running = typeText(createTypingState({ text: 'hola' }), 'ho');
    expect(() => analyze(running)).toThrow();
  });
});

describe('consistency', () => {
  it('es 100 − coeficiente de variación', () => {
    expect(consistency([60, 30])).toBeCloseTo(100 - (15 / 45) * 100, 6);
    expect(consistency([50, 50, 50])).toBe(100);
  });

  it('se acota a 0 y vale 0 sin escritura', () => {
    expect(consistency([200, 0, 0, 0, 0, 0])).toBe(0);
    expect(consistency([0, 0])).toBe(0);
    expect(consistency([])).toBe(0);
  });
});

describe('liveMetrics', () => {
  it('muestra 0 WPM durante el primer segundo y luego el neto', () => {
    const state = typeText(createTypingState({ text: 'hola mundo' }), 'hola ', 0, 100);
    expect(liveMetrics(state, 900).wpm).toBe(0);
    expect(liveMetrics(state, 1_200).wpm).toBeCloseTo(wpmFrom(5, 1_200), 6);
    expect(liveMetrics(state, 1_200).progress).toBeCloseTo(0.5, 6);
    expect(liveMetrics(state, 1_200).accuracy).toBe(100);
  });

  it('antes de empezar todo está en cero y la precisión en 100', () => {
    expect(liveMetrics(createTypingState({ text: 'hola' }), 50_000)).toEqual({
      wpm: 0,
      accuracy: 100,
      elapsedMs: 0,
      progress: 0,
    });
  });
});

describe('progressTimeline', () => {
  it('sigue los caracteres correctos tras cada pulsación y marca la llegada', () => {
    const template = createTypingState({ text: 'ab c', startOn: 'signal' });
    const timeline = progressTimeline(template, [
      { t: 100, input: 'a' },
      { t: 200, input: 'x' },
      { t: 300, input: '\b' },
      { t: 400, input: 'b' },
      { t: 500, input: ' ' },
      { t: 650, input: 'c' },
    ]);
    expect(timeline.totalChars).toBe(4);
    expect(timeline.finishMs).toBe(650);
    expect(timeline.samples.map((sample) => sample.correctChars)).toEqual([0, 1, 1, 1, 2, 3, 4]);
  });

  it('una prueba sin terminar no tiene llegada', () => {
    const template = createTypingState({ text: 'hola', startOn: 'signal' });
    expect(progressTimeline(template, [{ t: 50, input: 'h' }]).finishMs).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
