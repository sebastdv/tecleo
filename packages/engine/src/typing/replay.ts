import { applyInput, start } from './state.js';
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

/**
 * Reproduce un registro de pulsaciones sobre el texto de `state`. Sirve para repeticiones,
 * fantasmas, gráficas y para que el servidor verifique lo que reporta el cliente.
 * `onStep` recibe el estado antes de cada pulsación (útil para estadísticas por posición).
 */
export function replayKeystrokes(
  state: TypingState,
  keystrokes: readonly Keystroke[],
  onStep?: (before: TypingState, keystroke: Keystroke) => void,
): TypingState {
  let current = blankRun(state);
  for (const keystroke of keystrokes) {
    onStep?.(current, keystroke);
    current = applyInput(current, keystrokeToAction(keystroke), keystroke.t);
  }
  return current;
}
