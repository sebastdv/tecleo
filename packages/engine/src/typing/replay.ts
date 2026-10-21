import { applyInput, start, tick } from './state.js';
import {
  BACKSPACE,
  DELETE_WORD,
  type Keystroke,
  type TypingAction,
  type TypingState,
} from './types.js';

export function keystrokeToAction(keystroke: Pick<Keystroke, 'input'>): TypingAction {
  if (keystroke.input === BACKSPACE) return { type: 'deleteBackward' };
  if (keystroke.input === DELETE_WORD) return { type: 'deleteWord' };
  return { type: 'insert', text: keystroke.input };
}

/** Mismo texto y reglas, sin nada escrito, en marcha desde t = 0 y sin límite de tiempo. */
export function blankRun(state: TypingState): TypingState {
  const words = state.words.map((word) => ({ ...word, input: '', wrongAt: [] }));
  return start(
    {
      ...state,
      words,
      wordIndex: 0,
      phase: 'idle',
      startedAt: null,
      finishedAt: null,
      timeLimitMs: null,
      keystrokes: [],
    },
    0,
  );
}

/** Lo mínimo para reproducir una pulsación: cuándo y qué carácter. */
export type KeystrokeInput = Pick<Keystroke, 't' | 'input'>;

/**
 * Reproduce un registro de pulsaciones sobre el texto de `state`, sin límite de tiempo.
 * Sirve para repeticiones, fantasmas y gráficas. `onStep` recibe el estado antes de cada
 * pulsación (útil para estadísticas por posición).
 */
export function replayKeystrokes<K extends KeystrokeInput>(
  state: TypingState,
  keystrokes: readonly K[],
  onStep?: (before: TypingState, keystroke: K) => void,
): TypingState {
  let current = blankRun(state);
  for (const keystroke of keystrokes) {
    onStep?.(current, keystroke);
    current = applyInput(current, keystrokeToAction(keystroke), keystroke.t);
  }
  return current;
}

/**
 * Juega un registro respetando las reglas de `template`, incluido su límite de tiempo: lo
 * escrito después del límite se descarta y la prueba se cierra en el límite. Es lo que usa el
 * servidor para calcular el resultado oficial a partir de lo que envía el cliente.
 */
export function playKeystrokes(
  template: TypingState,
  keystrokes: readonly KeystrokeInput[],
): TypingState {
  let current = start(
    { ...blankRun(template), phase: 'idle', startedAt: null, timeLimitMs: template.timeLimitMs },
    0,
  );
  for (const keystroke of keystrokes) {
    current = applyInput(current, keystrokeToAction(keystroke), keystroke.t);
    if (current.phase === 'finished') break;
  }
  if (current.phase === 'running' && current.timeLimitMs !== null) {
    current = tick(current, current.timeLimitMs);
  }
  return current;
}
