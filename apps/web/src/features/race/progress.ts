import type { ProgressTimeline } from '@tecleo/engine';

/**
 * Progreso de un bot (o de una prueba grabada) en `t` interpolando entre pulsaciones, para que
 * en la pista avance de forma continua y no a saltos. Solo es visual: posiciones y resultados
 * usan los valores exactos.
 */
export function interpolatedProgress(run: ProgressTimeline, t: number): number {
  const { samples, totalChars } = run;
  if (totalChars === 0 || samples.length === 0) return 0;
  if (t >= run.finishMs) return 1;
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((samples[mid]?.t ?? 0) <= t) low = mid;
    else high = mid - 1;
  }
  const current = samples[low];
  const next = samples[low + 1];
  if (!current) return 0;
  if (!next || next.t === current.t) return current.correctChars / totalChars;
  const fraction = (t - current.t) / (next.t - current.t);
  const chars = current.correctChars + (next.correctChars - current.correctChars) * fraction;
  return Math.max(0, Math.min(1, chars / totalChars));
}
