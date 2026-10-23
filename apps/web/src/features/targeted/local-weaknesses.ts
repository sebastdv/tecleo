import type { Attempted } from '@tecleo/content';
import {
  analyze,
  createTypingState,
  decodeKeystrokes,
  playKeystrokes,
  type CharStat,
} from '@tecleo/engine';
import type { SubmitResultInput } from '@tecleo/shared';

function add(totals: Map<string, Attempted>, stats: Readonly<Record<string, CharStat>>) {
  for (const [key, stat] of Object.entries(stats)) {
    const current = totals.get(key);
    totals.set(key, {
      key,
      attempts: (current?.attempts ?? 0) + stat.attempts,
      errors: (current?.errors ?? 0) + stat.errors,
    });
  }
}

/**
 * Teclas y pares de letras de un invitado, a partir de los resultados que guardó en este
 * navegador: se reproducen con el motor igual que lo haría el servidor.
 */
export function localWeaknesses(results: readonly SubmitResultInput[]): {
  keys: Attempted[];
  bigrams: Attempted[];
} {
  const keys = new Map<string, Attempted>();
  const bigrams = new Map<string, Attempted>();
  for (const result of results) {
    try {
      const template = createTypingState({
        text: result.content,
        preserveLines: result.preserveLines,
        timeLimitMs: result.timeLimitMs,
        rules: result.rules,
        startOn: result.mode === 'bots' || result.mode === 'ghost' ? 'signal' : 'firstInput',
      });
      const metrics = analyze(playKeystrokes(template, decodeKeystrokes(result.keystrokes)));
      add(keys, metrics.keyStats);
      add(bigrams, metrics.bigramStats);
    } catch {
      // Un resultado guardado que ya no se puede reproducir no aporta nada.
    }
  }
  return { keys: [...keys.values()], bigrams: [...bigrams.values()] };
}
