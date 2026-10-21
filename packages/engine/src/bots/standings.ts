export interface RunnerResult {
  readonly id: string;
  /** Momento de llegada en ms desde la salida; `null` si no terminó (DNF). */
  readonly finishMs: number | null;
  /** Fracción del texto escrita correctamente (0–1), para ordenar a quienes no terminaron. */
  readonly progress: number;
}

export interface Standing extends RunnerResult {
  /** Puesto, empezando en 1. Empates en el mismo milisegundo comparten puesto. */
  readonly position: number;
}

/**
 * Orden de llegada: primero quienes terminaron, por tiempo; después quienes no, por progreso.
 * El servidor usa la misma función para los resultados oficiales.
 */
export function rankRunners(runners: readonly RunnerResult[]): Standing[] {
  const sorted = [...runners].sort((a, b) => {
    if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs;
    if (a.finishMs !== null) return -1;
    if (b.finishMs !== null) return 1;
    return b.progress - a.progress;
  });
  const standings: Standing[] = [];
  sorted.forEach((runner, index) => {
    const previous = standings[index - 1];
    const tied =
      previous?.finishMs === runner.finishMs &&
      (runner.finishMs !== null || previous.progress === runner.progress);
    standings.push({ ...runner, position: tied ? previous.position : index + 1 });
  });
  return standings;
}
