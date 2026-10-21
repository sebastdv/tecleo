import { countCorrectChars, wordMatches } from '../typing/chars.js';
import { replayKeystrokes } from '../typing/replay.js';
import { BACKSPACE, DELETE_WORD, type Keystroke, type TypingState } from '../typing/types.js';

const CHARS_PER_WORD = 5;
const MS_PER_MINUTE = 60_000;
const PEAK_WINDOW_SECONDS = 5;

export function wpmFrom(chars: number, durationMs: number): number {
  return durationMs > 0 ? chars / CHARS_PER_WORD / (durationMs / MS_PER_MINUTE) : 0;
}

function isDeletion(keystroke: Keystroke): boolean {
  return keystroke.input === BACKSPACE || keystroke.input === DELETE_WORD;
}

/**
 * Caracteres correctos del estado actual: los que coinciden en su posición más cada
 * separador que sigue a una palabra confirmada sin errores.
 */
export function correctChars(state: TypingState): number {
  const { ignoreAccents } = state.rules;
  let count = 0;
  for (let i = 0; i <= state.wordIndex && i < state.words.length; i++) {
    const word = state.words[i];
    if (!word) continue;
    count += countCorrectChars(word, ignoreAccents);
    if (i < state.wordIndex && wordMatches(word, ignoreAccents)) count += 1;
  }
  return count;
}

/** Total de caracteres a escribir (los separadores cuentan uno; la sangría es automática). */
export function totalChars(state: TypingState): number {
  return state.words.reduce((sum, word) => sum + word.target.length + (word.separator ? 1 : 0), 0);
}

/** Caracteres que quedaron sin escribir en palabras ya confirmadas (modo libre). */
export function missedChars(state: TypingState): number {
  const lastCommitted =
    state.phase === 'finished' && state.wordIndex === state.words.length - 1
      ? state.wordIndex
      : state.wordIndex - 1;
  let missed = 0;
  for (let i = 0; i <= lastCommitted; i++) {
    const word = state.words[i];
    if (word) missed += Math.max(0, word.target.length - word.input.length);
  }
  return missed;
}

/** Precisión = pulsaciones correctas / pulsaciones totales × 100 (lo no escrito cuenta como error). */
export function accuracy(state: TypingState): number {
  let total = 0;
  let correct = 0;
  for (const keystroke of state.keystrokes) {
    if (isDeletion(keystroke)) continue;
    total++;
    if (keystroke.correct) correct++;
  }
  total += missedChars(state);
  return total === 0 ? 100 : (correct / total) * 100;
}

export function elapsedMs(state: TypingState, now: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.finishedAt ?? now) - state.startedAt);
}

export interface LiveMetrics {
  readonly wpm: number;
  readonly accuracy: number;
  readonly elapsedMs: number;
  /** Fracción del texto escrita correctamente, 0–1 (la pista de carrera la usa). */
  readonly progress: number;
}

/** Métricas para mostrar mientras se escribe. El WPM se muestra desde el primer segundo. */
export function liveMetrics(state: TypingState, now: number): LiveMetrics {
  const elapsed = elapsedMs(state, now);
  const correct = correctChars(state);
  const total = totalChars(state);
  return {
    wpm: elapsed >= 1_000 ? wpmFrom(correct, elapsed) : 0,
    accuracy: accuracy(state),
    elapsedMs: elapsed,
    progress: total === 0 ? 0 : Math.min(1, correct / total),
  };
}

export interface SecondSample {
  /** Segundo que cierra la muestra (1, 2, …); el último puede ser parcial. */
  readonly second: number;
  /** WPM neto acumulado hasta ese segundo. */
  readonly wpm: number;
  /** WPM bruto dentro de ese segundo. */
  readonly raw: number;
  /** Pulsaciones erróneas dentro de ese segundo. */
  readonly errors: number;
}

export interface CharStat {
  readonly attempts: number;
  readonly errors: number;
}

export interface RaceMetrics {
  readonly wpm: number;
  readonly rawWpm: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly peakWpm: number;
  readonly durationMs: number;
  readonly correctChars: number;
  /** Todos los caracteres escritos, incluidos los que luego se borraron. */
  readonly typedChars: number;
  readonly incorrectKeystrokes: number;
  readonly missedChars: number;
  readonly timeline: readonly SecondSample[];
  /** Intentos y errores por carácter esperado. */
  readonly keyStats: Readonly<Record<string, CharStat>>;
  /** Intentos y errores por par de letras dentro de una palabra (p. ej. "ñe"). */
  readonly bigramStats: Readonly<Record<string, CharStat>>;
}

function bump(
  stats: Record<string, { attempts: number; errors: number }>,
  key: string,
  error: boolean,
) {
  const stat = (stats[key] ??= { attempts: 0, errors: 0 });
  stat.attempts++;
  if (error) stat.errors++;
}

/**
 * Métricas finales de una prueba terminada. Reproduce el registro con el motor para obtener
 * la evolución segundo a segundo, así el cálculo es idéntico en cliente y servidor.
 */
export function analyze(state: TypingState): RaceMetrics {
  if (state.phase !== 'finished' || state.startedAt === null || state.finishedAt === null) {
    throw new Error('Solo se puede analizar una prueba terminada');
  }
  const durationMs = state.finishedAt - state.startedAt;
  const seconds = Math.max(1, Math.ceil(durationMs / 1_000));
  const boundaryOf = (second: number) => Math.min(second * 1_000, durationMs);

  const inserted = new Array<number>(seconds).fill(0);
  const errors = new Array<number>(seconds).fill(0);
  const correctAt = new Array<number>(seconds + 1).fill(0);
  const keyStats: Record<string, { attempts: number; errors: number }> = {};
  const bigramStats: Record<string, { attempts: number; errors: number }> = {};
  let nextBoundary = 1;

  const final = replayKeystrokes(state, state.keystrokes, (before, keystroke) => {
    while (nextBoundary < seconds && keystroke.t >= boundaryOf(nextBoundary)) {
      correctAt[nextBoundary++] = correctChars(before);
    }
    if (isDeletion(keystroke)) return;
    const bucket = Math.min(seconds - 1, Math.floor(keystroke.t / 1_000));
    inserted[bucket] = (inserted[bucket] ?? 0) + 1;
    if (!keystroke.correct) errors[bucket] = (errors[bucket] ?? 0) + 1;
    if (keystroke.expected === '') return;

    bump(keyStats, keystroke.expected, !keystroke.correct);
    const word = before.words[before.wordIndex];
    const position = word?.input.length ?? 0;
    const previous = word?.target[position - 1];
    if (word && previous !== undefined && position < word.target.length) {
      bump(bigramStats, previous + keystroke.expected, !keystroke.correct);
    }
  });
  while (nextBoundary <= seconds) correctAt[nextBoundary++] = correctChars(final);

  const bucketMs = (index: number) => boundaryOf(index + 1) - index * 1_000;
  const rawPerSecond = inserted.map((count, index) => wpmFrom(count, bucketMs(index)));
  const timeline: SecondSample[] = rawPerSecond.map((raw, index) => ({
    second: index + 1,
    wpm: wpmFrom(correctAt[index + 1] ?? 0, boundaryOf(index + 1)),
    raw,
    errors: errors[index] ?? 0,
  }));

  const typedChars = inserted.reduce((sum, count) => sum + count, 0);
  const correct = correctChars(state);
  const wpm = wpmFrom(correct, durationMs);

  return {
    wpm,
    rawWpm: wpmFrom(typedChars, durationMs),
    accuracy: accuracy(state),
    consistency: consistency(rawPerSecond, bucketMs(seconds - 1)),
    peakWpm: peakWpm(correctAt, seconds, boundaryOf, wpm),
    durationMs,
    correctChars: correct,
    typedChars,
    incorrectKeystrokes: errors.reduce((sum, count) => sum + count, 0),
    missedChars: missedChars(state),
    timeline,
    keyStats,
    bigramStats,
  };
}

/**
 * Consistencia = 100 − coeficiente de variación (%) del WPM bruto por segundo, acotado a 0–100.
 * El último segundo se descarta si duró menos de medio segundo: con tan poco tiempo distorsiona.
 */
export function consistency(rawPerSecond: readonly number[], lastBucketMs = 1_000): number {
  const samples =
    rawPerSecond.length > 1 && lastBucketMs < 500 ? rawPerSecond.slice(0, -1) : [...rawPerSecond];
  if (samples.length === 0) return 0;
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  if (mean === 0) return 0;
  const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  const coefficient = (Math.sqrt(variance) / mean) * 100;
  return Math.min(100, Math.max(0, 100 - coefficient));
}

/** Mejor WPM neto en una ventana de 5 s; si la prueba duró menos, el WPM final. */
function peakWpm(
  correctAt: readonly number[],
  seconds: number,
  boundaryOf: (second: number) => number,
  finalWpm: number,
): number {
  if (seconds < PEAK_WINDOW_SECONDS) return finalWpm;
  let peak = 0;
  for (let end = PEAK_WINDOW_SECONDS; end <= seconds; end++) {
    const begin = end - PEAK_WINDOW_SECONDS;
    const chars = (correctAt[end] ?? 0) - (correctAt[begin] ?? 0);
    peak = Math.max(peak, wpmFrom(chars, boundaryOf(end) - boundaryOf(begin)));
  }
  return peak;
}
