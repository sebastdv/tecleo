export type Phase = 'idle' | 'countdown' | 'running' | 'finished';

/**
 * Estado visible de cada carácter:
 * - `corrected`: falló en algún momento y ahora está bien (sirve para estadísticas).
 * - `extra`: escrito más allá del final de la palabra.
 */
export type CharState = 'pending' | 'correct' | 'incorrect' | 'extra' | 'corrected';

export type TypingMode = 'strict' | 'free';

export interface TypingRules {
  /** Estricto: no se pasa de palabra con errores. Libre: el espacio salta aunque haya errores. */
  readonly mode: TypingMode;
  /** Trata á/a, ü/u, ñ/n como iguales. El resultado queda marcado y no cuenta para rankings. */
  readonly ignoreAccents: boolean;
  /** Cuántos caracteres se aceptan tras el primer error (estricto) o tras el final de la palabra (libre). */
  readonly maxExtraChars: number;
}

export const DEFAULT_RULES: TypingRules = {
  mode: 'strict',
  ignoreAccents: false,
  maxExtraChars: 10,
};

/** Acción de escritura ya traducida desde los eventos del navegador. */
export type TypingAction =
  | { readonly type: 'insert'; readonly text: string }
  | { readonly type: 'deleteBackward' }
  | { readonly type: 'deleteWord' };

/** Valores de `Keystroke.input` para los borrados. */
export const BACKSPACE = '\b';
export const DELETE_WORD = '\u0017';

/**
 * Una pulsación del registro. Con `t` e `input` basta para reproducir la carrera;
 * `expected` y `correct` se guardan para estadísticas (mapa de teclas, bigramas).
 * Los borrados llevan `expected: ''` y `correct: false` y no cuentan para la precisión.
 */
export interface Keystroke {
  /** Milisegundos desde el inicio de la carrera. */
  readonly t: number;
  readonly input: string;
  /** Carácter esperado en esa posición; `''` si era un carácter extra o un borrado. */
  readonly expected: string;
  readonly correct: boolean;
}

export interface WordState {
  readonly target: string;
  /**
   * Lo que sigue a la palabra: `' '`, `'\n'` más la sangría de la línea siguiente (código),
   * o `''` en la última palabra. Solo se escribe el primer carácter; la sangría es automática.
   */
  readonly separator: string;
  readonly input: string;
  /** Posiciones que alguna vez se escribieron mal (para `corrected`). */
  readonly wrongAt: readonly number[];
}

export type StartTrigger = 'firstInput' | 'signal';

export interface TypingState {
  readonly phase: Phase;
  readonly rules: TypingRules;
  readonly words: readonly WordState[];
  readonly wordIndex: number;
  /** En práctica arranca con la primera pulsación; en carreras, con la señal del servidor. */
  readonly startOn: StartTrigger;
  /** Marca de tiempo (reloj del llamador, en ms) en que empezó; `t` de cada pulsación se mide desde aquí. */
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
  /** Límite para el modo por tiempo; `null` si termina al completar el texto. */
  readonly timeLimitMs: number | null;
  readonly keystrokes: readonly Keystroke[];
}
