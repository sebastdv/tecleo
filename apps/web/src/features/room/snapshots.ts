/** Una posición recibida del servidor, con la hora local (`performance.now()`) de llegada. */
export interface ProgressSample {
  readonly at: number;
  readonly progress: number;
}

/** Lo que se dibuja va este tiempo por detrás del último dato: siempre hay dos para interpolar. */
export const RENDER_DELAY_MS = 250;
const MAX_SAMPLES = 8;

/** Agrega una muestra al búfer de un corredor, conservando solo las últimas. */
export function pushSample(
  buffer: readonly ProgressSample[],
  sample: ProgressSample,
): ProgressSample[] {
  const next = [...buffer, sample];
  return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
}

/**
 * Progreso de un rival en `time` interpolando entre las muestras que lo rodean (spec 7.3).
 * Antes de la primera se queda en ella y después de la última no extrapola: un rival nunca
 * aparece más adelante de lo que el servidor dijo.
 */
export function progressAt(buffer: readonly ProgressSample[], time: number): number {
  const first = buffer[0];
  if (!first) return 0;
  if (time <= first.at) return first.progress;
  for (let index = 1; index < buffer.length; index++) {
    const next = buffer[index];
    const previous = buffer[index - 1];
    if (!next || !previous || time > next.at) continue;
    const span = next.at - previous.at;
    const fraction = span > 0 ? (time - previous.at) / span : 1;
    return previous.progress + (next.progress - previous.progress) * fraction;
  }
  return buffer[buffer.length - 1]?.progress ?? 0;
}
