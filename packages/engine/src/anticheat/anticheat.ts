import type { RaceMetrics } from '../metrics/metrics.js';
import { BACKSPACE, DELETE_WORD, type Keystroke } from '../typing/types.js';

/** ppm neto a partir del cual un resultado se considera implausible (spec 7.4). */
export const MAX_PLAUSIBLE_WPM = 250;
/** Mejor ventana de 5 s implausible incluso para récords humanos. */
export const MAX_PLAUSIBLE_PEAK_WPM = 320;
/** Variación mínima entre teclas: por debajo, el ritmo es demasiado regular para una persona. */
export const MIN_INTERVAL_VARIATION = 0.12;
const MIN_INTERVALS_TO_JUDGE = 30;

export type CheatReason = 'implausible-wpm' | 'implausible-peak' | 'uniform-intervals';

export interface CheatReport {
  readonly flagged: boolean;
  readonly reasons: readonly CheatReason[];
}

function intervalVariation(keystrokes: readonly Keystroke[]): number | null {
  const times = keystrokes
    .filter((keystroke) => keystroke.input !== BACKSPACE && keystroke.input !== DELETE_WORD)
    .map((keystroke) => keystroke.t);
  const intervals = times.slice(1).map((t, index) => t - (times[index] ?? 0));
  if (intervals.length < MIN_INTERVALS_TO_JUDGE) return null;
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (mean <= 0) return 0;
  const variance =
    intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Señales de trampa en un resultado ya reproducido por el motor. Un resultado marcado se guarda
 * pero no cuenta para rankings. La validación de progreso en vivo llega con el multijugador.
 */
export function inspectRun(metrics: RaceMetrics, keystrokes: readonly Keystroke[]): CheatReport {
  const reasons: CheatReason[] = [];
  if (metrics.wpm > MAX_PLAUSIBLE_WPM) reasons.push('implausible-wpm');
  if (metrics.peakWpm > MAX_PLAUSIBLE_PEAK_WPM) reasons.push('implausible-peak');
  const variation = intervalVariation(keystrokes);
  if (variation !== null && variation < MIN_INTERVAL_VARIATION) reasons.push('uniform-intervals');
  return { flagged: reasons.length > 0, reasons };
}
