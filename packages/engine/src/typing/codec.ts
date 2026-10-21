import type { KeystrokeInput } from './replay.js';
import type { Keystroke } from './types.js';

/** Formato compacto para enviar y guardar: diferencia de tiempo y carácter de cada pulsación. */
export interface EncodedKeystrokes {
  readonly deltas: readonly number[];
  /** Un punto de código por pulsación (`\b` = borrar, `\u0017` = borrar palabra). */
  readonly inputs: string;
}

export function encodeKeystrokes(
  keystrokes: readonly Pick<Keystroke, 't' | 'input'>[],
): EncodedKeystrokes {
  let previous = 0;
  const deltas: number[] = [];
  for (const { t } of keystrokes) {
    deltas.push(Math.max(0, Math.round(t - previous)));
    previous = t;
  }
  return { deltas, inputs: keystrokes.map((keystroke) => keystroke.input).join('') };
}

export function decodeKeystrokes({ deltas, inputs }: EncodedKeystrokes): KeystrokeInput[] {
  const chars = Array.from(inputs);
  if (chars.length !== deltas.length) {
    throw new Error('Pulsaciones mal codificadas: hay distinta cantidad de tiempos y caracteres');
  }
  let t = 0;
  return chars.map((input, index) => {
    t += deltas[index] ?? 0;
    return { t, input };
  });
}
