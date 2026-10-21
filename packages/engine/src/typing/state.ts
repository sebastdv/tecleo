import { charsMatch, firstErrorIndex, wordMatches } from './chars.js';
import { normalizeChars, normalizeText } from './normalize.js';
import {
  BACKSPACE,
  DEFAULT_RULES,
  DELETE_WORD,
  type Keystroke,
  type StartTrigger,
  type TypingAction,
  type TypingRules,
  type TypingState,
  type WordState,
} from './types.js';

export interface CreateTypingStateOptions {
  readonly text: string;
  readonly rules?: Partial<TypingRules>;
  readonly startOn?: StartTrigger;
  readonly timeLimitMs?: number | null;
  /** Conserva saltos de línea y sangría (fragmentos de código). */
  readonly preserveLines?: boolean;
}

/** Separa el texto normalizado en palabras; el separador queda pegado a la palabra anterior. */
export function tokenize(text: string): WordState[] {
  const words: WordState[] = [];
  const separator = /( |\n *)/g;
  let start = 0;
  for (let match = separator.exec(text); match; match = separator.exec(text)) {
    words.push({
      target: text.slice(start, match.index),
      separator: match[0],
      input: '',
      wrongAt: [],
    });
    start = match.index + match[0].length;
  }
  words.push({ target: text.slice(start), separator: '', input: '', wrongAt: [] });
  return words;
}

export function createTypingState(options: CreateTypingStateOptions): TypingState {
  const text = normalizeText(options.text, { preserveLines: options.preserveLines ?? false });
  if (text === '') throw new Error('El texto a escribir está vacío');
  const timeLimitMs = options.timeLimitMs ?? null;
  if (timeLimitMs !== null && !(timeLimitMs > 0))
    throw new RangeError('timeLimitMs debe ser positivo');
  return {
    phase: 'idle',
    rules: { ...DEFAULT_RULES, ...options.rules },
    words: tokenize(text),
    wordIndex: 0,
    startOn: options.startOn ?? 'firstInput',
    startedAt: null,
    finishedAt: null,
    timeLimitMs,
    keystrokes: [],
  };
}

/** El texto completo tal como se escribe (sin la sangría automática del código). */
export function stateText(state: Pick<TypingState, 'words'>): string {
  return state.words.map((word) => word.target + word.separator).join('');
}

/** Cuenta regresiva de una carrera: mientras dura se ignora la entrada. */
export function beginCountdown(state: TypingState): TypingState {
  return state.phase === 'idle' ? { ...state, phase: 'countdown' } : state;
}

/** Señal de salida (carreras). En práctica no hace falta: arranca con la primera pulsación. */
export function start(state: TypingState, timestamp: number): TypingState {
  if (state.phase !== 'idle' && state.phase !== 'countdown') return state;
  return { ...state, phase: 'running', startedAt: timestamp };
}

export function finish(state: TypingState, timestamp: number): TypingState {
  if (state.phase === 'finished') return state;
  return {
    ...state,
    phase: 'finished',
    startedAt: state.startedAt ?? timestamp,
    finishedAt: timestamp,
  };
}

/** Cierra la prueba por tiempo si ya se cumplió el límite. Llamar periódicamente desde la UI. */
export function tick(state: TypingState, now: number): TypingState {
  if (state.phase !== 'running' || state.timeLimitMs === null || state.startedAt === null)
    return state;
  const deadline = state.startedAt + state.timeLimitMs;
  return now >= deadline ? finish(state, deadline) : state;
}

/** Agrega texto al final (modo por tiempo: las palabras se generan a medida que se escriben). */
export function appendText(state: TypingState, text: string): TypingState {
  if (state.phase === 'finished') return state;
  const normalized = normalizeText(text);
  if (normalized === '') return state;
  const words = [...state.words];
  const lastIndex = words.length - 1;
  const last = words[lastIndex];
  if (last) words[lastIndex] = { ...last, separator: ' ' };
  return { ...state, words: [...words, ...tokenize(normalized)] };
}

/**
 * Aplica una acción de escritura. Función pura: devuelve un estado nuevo y no toca el anterior.
 * `timestamp` está en el mismo reloj que `start()` (p. ej. `performance.now()` o `event.timeStamp`).
 */
export function applyInput(
  state: TypingState,
  action: TypingAction,
  timestamp: number,
): TypingState {
  let current = state;
  if (current.phase === 'idle' && current.startOn === 'firstInput' && action.type === 'insert') {
    current = start(current, timestamp);
  }
  const { startedAt } = current;
  if (current.phase !== 'running' || startedAt === null) return state;

  current = tick(current, timestamp);
  if (current.phase !== 'running') return current;

  // El reloj del llamador puede dar valores iguales o, por redondeo, menores: el registro es monótono.
  const lastT = current.keystrokes.at(-1)?.t ?? 0;
  const t = Math.max(lastT, Math.round(timestamp - startedAt));

  switch (action.type) {
    case 'insert': {
      for (const ch of normalizeChars(action.text)) {
        current = insertChar(current, ch, t);
        if (current.phase === 'finished') break;
      }
      return current;
    }
    case 'deleteBackward':
      return deleteBackward(current, t);
    case 'deleteWord':
      return deleteWord(current, t);
  }
}

function insertChar(state: TypingState, ch: string, t: number): TypingState {
  const word = state.words[state.wordIndex];
  if (!word) return state;
  const { mode, ignoreAccents, maxExtraChars } = state.rules;
  const isWhitespace = ch === ' ' || ch === '\n';
  const isLastWord = state.wordIndex === state.words.length - 1;

  if (isWhitespace) {
    const expected = word.separator.charAt(0);
    const complete = wordMatches(word, ignoreAccents);
    if (mode === 'free') {
      // Un espacio al inicio de una palabra no hace nada (evita saltarse palabras por error).
      if (word.input === '') return state;
      const correct = complete && ch === expected;
      const next = record(state, { t, input: ch, expected, correct });
      return isLastWord ? finishAt(next, t) : { ...next, wordIndex: state.wordIndex + 1 };
    }
    if (complete && ch === expected && !isLastWord) {
      const next = record(state, { t, input: ch, expected, correct: true });
      return { ...next, wordIndex: state.wordIndex + 1 };
    }
    // Estricto con la palabra incompleta o mal escrita: el espacio es un carácter erróneo más.
  }

  const position = word.input.length;
  const limit =
    mode === 'strict'
      ? firstErrorIndex(word.input, word.target, ignoreAccents) + maxExtraChars
      : word.target.length + maxExtraChars;
  if (position >= limit) return state;

  const expected = word.target.charAt(position);
  const correct = expected !== '' && charsMatch(ch, expected, ignoreAccents);
  const wrongAt =
    !correct && expected !== '' && !word.wrongAt.includes(position)
      ? [...word.wrongAt, position]
      : word.wrongAt;
  const updated: WordState = { ...word, input: word.input + ch, wrongAt };
  const next = record(replaceWord(state, state.wordIndex, updated), {
    t,
    input: ch,
    expected,
    correct,
  });
  return isLastWord && wordMatches(updated, ignoreAccents) ? finishAt(next, t) : next;
}

function deleteBackward(state: TypingState, t: number): TypingState {
  const word = state.words[state.wordIndex];
  if (!word) return state;
  if (word.input !== '') {
    const updated = { ...word, input: word.input.slice(0, -1) };
    return record(replaceWord(state, state.wordIndex, updated), deletion(t, BACKSPACE));
  }
  const previous = previousEditableWord(state);
  if (previous === null) return state;
  return record({ ...state, wordIndex: previous }, deletion(t, BACKSPACE));
}

function deleteWord(state: TypingState, t: number): TypingState {
  const word = state.words[state.wordIndex];
  if (!word) return state;
  if (word.input !== '') {
    return record(
      replaceWord(state, state.wordIndex, { ...word, input: '' }),
      deletion(t, DELETE_WORD),
    );
  }
  const previous = previousEditableWord(state);
  const previousWord = previous === null ? undefined : state.words[previous];
  if (previous === null || !previousWord) return state;
  const cleared = replaceWord(state, previous, { ...previousWord, input: '' });
  return record({ ...cleared, wordIndex: previous }, deletion(t, DELETE_WORD));
}

/** Solo en modo libre se puede volver a una palabra anterior, y solo si quedó con errores. */
function previousEditableWord(state: TypingState): number | null {
  if (state.rules.mode !== 'free' || state.wordIndex === 0) return null;
  const previous = state.words[state.wordIndex - 1];
  if (!previous || wordMatches(previous, state.rules.ignoreAccents)) return null;
  return state.wordIndex - 1;
}

function deletion(t: number, input: string): Keystroke {
  return { t, input, expected: '', correct: false };
}

function record(state: TypingState, keystroke: Keystroke): TypingState {
  return { ...state, keystrokes: [...state.keystrokes, keystroke] };
}

function replaceWord(state: TypingState, index: number, word: WordState): TypingState {
  const words = [...state.words];
  words[index] = word;
  return { ...state, words };
}

function finishAt(state: TypingState, t: number): TypingState {
  return finish(state, (state.startedAt ?? 0) + t);
}
