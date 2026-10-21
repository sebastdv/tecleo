import { describe, expect, it } from 'vitest';

import {
  appendText,
  applyInput,
  beginCountdown,
  createTypingState,
  start,
  stateText,
  tick,
  tokenize,
} from './state.js';
import { backspace, charStatesAt, inputs, typeText } from './test-helpers.js';
import { BACKSPACE, DELETE_WORD, type TypingRules } from './types.js';

const strict: Partial<TypingRules> = { mode: 'strict' };
const free: Partial<TypingRules> = { mode: 'free' };

describe('tokenize', () => {
  it('separa prosa por espacios y deja la última palabra sin separador', () => {
    expect(tokenize('el sol sale').map((w) => [w.target, w.separator])).toEqual([
      ['el', ' '],
      ['sol', ' '],
      ['sale', ''],
    ]);
  });

  it('en código el separador incluye el salto y la sangría siguiente', () => {
    expect(tokenize('if (a) {\n  b();\n}').map((w) => [w.target, w.separator])).toEqual([
      ['if', ' '],
      ['(a)', ' '],
      ['{', '\n  '],
      ['b();', '\n'],
      ['}', ''],
    ]);
  });
});

describe('createTypingState', () => {
  it('normaliza el texto y empieza en idle', () => {
    const state = createTypingState({ text: '  “Hola”   mundo… ' });
    expect(stateText(state)).toBe('"Hola" mundo...');
    expect(state.phase).toBe('idle');
    expect(state.rules).toEqual({ mode: 'strict', ignoreAccents: false, maxExtraChars: 10 });
  });

  it('rechaza textos vacíos y límites de tiempo inválidos', () => {
    expect(() => createTypingState({ text: '   ' })).toThrow();
    expect(() => createTypingState({ text: 'a', timeLimitMs: 0 })).toThrow(RangeError);
  });
});

describe('inicio y fin', () => {
  it('en práctica arranca con la primera pulsación y mide t desde ahí', () => {
    let state = createTypingState({ text: 'ab' });
    state = applyInput(state, { type: 'insert', text: 'a' }, 5_000);
    expect(state.phase).toBe('running');
    expect(state.startedAt).toBe(5_000);
    state = applyInput(state, { type: 'insert', text: 'b' }, 5_250);
    expect(state.phase).toBe('finished');
    expect(state.finishedAt).toBe(5_250);
    expect(state.keystrokes).toEqual([
      { t: 0, input: 'a', expected: 'a', correct: true },
      { t: 250, input: 'b', expected: 'b', correct: true },
    ]);
  });

  it('un borrado no arranca la prueba', () => {
    const state = applyInput(createTypingState({ text: 'ab' }), { type: 'deleteBackward' }, 10);
    expect(state.phase).toBe('idle');
  });

  it('en carrera ignora la entrada hasta la señal de salida', () => {
    let state = createTypingState({ text: 'ab', startOn: 'signal' });
    state = applyInput(state, { type: 'insert', text: 'a' }, 100);
    expect(state.phase).toBe('idle');
    state = beginCountdown(state);
    state = applyInput(state, { type: 'insert', text: 'a' }, 200);
    expect(state.phase).toBe('countdown');
    expect(state.keystrokes).toHaveLength(0);
    state = start(state, 1_000);
    state = typeText(state, 'ab', 1_400, 100);
    expect(state.phase).toBe('finished');
    expect(state.keystrokes.map((k) => k.t)).toEqual([400, 500]);
  });

  it('ignora toda entrada después de terminar', () => {
    const done = typeText(createTypingState({ text: 'a' }), 'a');
    expect(applyInput(done, { type: 'insert', text: 'x' }, 999)).toBe(done);
  });

  it('el registro de tiempos es monótono aunque el reloj retroceda', () => {
    let state = createTypingState({ text: 'abc' });
    state = applyInput(state, { type: 'insert', text: 'a' }, 100);
    state = applyInput(state, { type: 'insert', text: 'b' }, 300);
    state = applyInput(state, { type: 'insert', text: 'c' }, 250);
    expect(state.keystrokes.map((k) => k.t)).toEqual([0, 200, 200]);
  });

  it('no modifica el estado anterior (función pura)', () => {
    const before = createTypingState({ text: 'hola mundo' });
    const snapshot: unknown = JSON.parse(JSON.stringify(before));
    typeText(before, 'hola m');
    expect(before).toEqual(snapshot);
  });
});

describe('modo estricto', () => {
  it('termina al escribir bien el último carácter, sin espacio final', () => {
    const state = typeText(createTypingState({ text: 'el sol', rules: strict }), 'el sol');
    expect(state.phase).toBe('finished');
    expect(state.wordIndex).toBe(1);
  });

  it('no avanza de palabra con errores: el espacio cuenta como carácter erróneo', () => {
    const state = typeText(createTypingState({ text: 'el sol', rules: strict }), 'ek ');
    expect(state.wordIndex).toBe(0);
    expect(inputs(state)).toEqual(['ek ', '']);
    expect(charStatesAt(state, 0)).toEqual(['correct', 'incorrect', 'extra']);
    expect(state.keystrokes.at(-1)).toEqual({ t: 200, input: ' ', expected: '', correct: false });
  });

  it('al corregir, el carácter queda como corrected y ya se puede avanzar', () => {
    let state = typeText(createTypingState({ text: 'el sol', rules: strict }), 'ek');
    state = backspace(state, 300);
    state = typeText(state, 'l ', 400);
    expect(state.wordIndex).toBe(1);
    expect(charStatesAt(state, 0)).toEqual(['correct', 'corrected']);
    expect(state.keystrokes.find((k) => k.input === BACKSPACE)).toEqual({
      t: 300,
      input: BACKSPACE,
      expected: '',
      correct: false,
    });
  });

  it('limita los caracteres después del primer error', () => {
    const state = typeText(
      createTypingState({ text: 'casa', rules: { ...strict, maxExtraChars: 3 } }),
      'cxxxxxxx',
    );
    expect(inputs(state)).toEqual(['cxxx']);
    expect(state.keystrokes).toHaveLength(4);
  });

  it('no se puede retroceder a una palabra ya confirmada', () => {
    let state = typeText(createTypingState({ text: 'el sol', rules: strict }), 'el ');
    state = backspace(state, 500, 3);
    state = applyInput(state, { type: 'deleteWord' }, 600);
    expect(state.wordIndex).toBe(1);
    expect(inputs(state)).toEqual(['el', '']);
  });
});

describe('modo libre', () => {
  it('el espacio salta de palabra aunque haya errores y lo no escrito queda pendiente', () => {
    const state = typeText(createTypingState({ text: 'casa roja', rules: free }), 'cas ');
    expect(state.wordIndex).toBe(1);
    expect(charStatesAt(state, 0)).toEqual(['correct', 'correct', 'correct', 'pending']);
    expect(state.keystrokes.at(-1)).toMatchObject({ input: ' ', expected: ' ', correct: false });
  });

  it('ignora el espacio al inicio de una palabra', () => {
    const state = typeText(createTypingState({ text: 'a b', rules: free }), 'a  ');
    expect(state.wordIndex).toBe(1);
    expect(state.keystrokes).toHaveLength(2);
  });

  it('el backspace vuelve a una palabra anterior con errores, no a una correcta', () => {
    let state = typeText(createTypingState({ text: 'uno dos tres', rules: free }), 'uno dis ');
    state = backspace(state, 1_000);
    expect(state.wordIndex).toBe(1);
    expect(inputs(state)).toEqual(['uno', 'dis', '']);
    state = backspace(state, 1_100, 3);
    state = backspace(state, 1_200);
    expect(state.wordIndex).toBe(1);
  });

  it('limita los caracteres extra más allá del final de la palabra', () => {
    const state = typeText(
      createTypingState({ text: 'sol luna', rules: { ...free, maxExtraChars: 2 } }),
      'solazo',
    );
    expect(inputs(state)[0]).toBe('solaz');
    expect(charStatesAt(state, 0)).toEqual(['correct', 'correct', 'correct', 'extra', 'extra']);
  });

  it('termina con el último carácter correcto o con espacio en la última palabra', () => {
    const exact = typeText(createTypingState({ text: 'ab cd', rules: free }), 'ab cd');
    expect(exact.phase).toBe('finished');
    const withError = typeText(createTypingState({ text: 'ab cd', rules: free }), 'ab cx');
    expect(withError.phase).toBe('running');
    expect(typeText(withError, ' ', 2_000).phase).toBe('finished');
  });
});

describe('Ctrl/Alt+Backspace', () => {
  it('borra la palabra actual', () => {
    let state = typeText(createTypingState({ text: 'hola mundo' }), 'hola mun');
    state = applyInput(state, { type: 'deleteWord' }, 2_000);
    expect(inputs(state)).toEqual(['hola', '']);
    expect(state.keystrokes.at(-1)?.input).toBe(DELETE_WORD);
  });

  it('en modo libre, al inicio de palabra vuelve a la anterior con errores y la vacía', () => {
    let state = typeText(createTypingState({ text: 'hola mundo', rules: free }), 'hila ');
    state = applyInput(state, { type: 'deleteWord' }, 2_000);
    expect(state.wordIndex).toBe(0);
    expect(inputs(state)).toEqual(['', '']);
  });
});

describe('español: tildes, ñ y teclas muertas', () => {
  it('acepta tildes, ñ, ü, ¿ y ¡ escritos directamente', () => {
    const text = '¿Qué año? ¡Pingüino!';
    const state = typeText(createTypingState({ text }), text);
    expect(state.phase).toBe('finished');
    expect(state.keystrokes.every((k) => k.correct)).toBe(true);
  });

  it('la vocal sin tilde es un error salvo con "ignorar tildes"', () => {
    const exact = typeText(createTypingState({ text: 'canción' }), 'cancion');
    expect(exact.phase).toBe('running');
    expect(charStatesAt(exact, 0)[5]).toBe('incorrect');

    const lenient = typeText(
      createTypingState({ text: 'canción año', rules: { ignoreAccents: true } }),
      'cancion ano',
    );
    expect(lenient.phase).toBe('finished');
  });

  it('una composición de tecla muerta llega como un solo insert y vale como un carácter', () => {
    let state = typeText(createTypingState({ text: 'él' }), '');
    state = applyInput(state, { type: 'insert', text: 'é' }, 0);
    state = applyInput(state, { type: 'insert', text: 'l' }, 120);
    expect(state.phase).toBe('finished');
    expect(state.keystrokes.map((k) => k.input)).toEqual(['é', 'l']);
  });

  it('tilde descompuesta (e + ◌́) se compone antes de compararse', () => {
    const state = applyInput(createTypingState({ text: 'é' }), { type: 'insert', text: 'é' }, 0);
    expect(state.phase).toBe('finished');
  });

  it('tecla muerta seguida de consonante produce dos caracteres con el mismo tiempo', () => {
    let state = createTypingState({ text: 'ab cd', rules: free });
    state = typeText(state, 'ab ');
    state = applyInput(state, { type: 'insert', text: '´c' }, 500);
    expect(inputs(state)[1]).toBe('´c');
    expect(state.keystrokes.slice(-2)).toEqual([
      { t: 500, input: '´', expected: 'c', correct: false },
      { t: 500, input: 'c', expected: 'd', correct: false },
    ]);
  });

  it('acepta comillas y puntos suspensivos tipográficos o de teclado', () => {
    const text = '“Sí”… dijo';
    expect(typeText(createTypingState({ text }), '"Sí"... dijo').phase).toBe('finished');
    const state = applyInput(
      createTypingState({ text: 'ya...' }),
      { type: 'insert', text: 'ya…' },
      0,
    );
    expect(state.phase).toBe('finished');
  });
});

describe('código', () => {
  it('Enter confirma la línea y la sangría se salta sola', () => {
    const text = 'if (a) {\n  b();\n}';
    const state = typeText(createTypingState({ text, preserveLines: true }), 'if (a) {\nb();\n}');
    expect(state.phase).toBe('finished');
  });

  it('un espacio donde va un salto de línea es un error en modo estricto', () => {
    const state = typeText(createTypingState({ text: 'a\nb', preserveLines: true }), 'a ');
    expect(state.wordIndex).toBe(0);
    expect(inputs(state)[0]).toBe('a ');
  });
});

describe('modo por tiempo', () => {
  it('tick cierra la prueba al cumplirse el límite', () => {
    let state = createTypingState({ text: 'uno dos tres', timeLimitMs: 15_000 });
    state = typeText(state, 'uno', 1_000);
    expect(tick(state, 15_999).phase).toBe('running');
    const done = tick(state, 16_000);
    expect(done.phase).toBe('finished');
    expect(done.finishedAt).toBe(16_000);
  });

  it('una pulsación después del límite cierra en el límite y no se registra', () => {
    let state = createTypingState({ text: 'uno dos', timeLimitMs: 1_000 });
    state = typeText(state, 'un', 0);
    state = applyInput(state, { type: 'insert', text: 'o' }, 5_000);
    expect(state.phase).toBe('finished');
    expect(state.finishedAt).toBe(1_000);
    expect(state.keystrokes).toHaveLength(2);
  });

  it('appendText agrega palabras y la que era última pasa a tener separador', () => {
    let state = typeText(createTypingState({ text: 'uno dos', timeLimitMs: 60_000 }), 'uno do');
    state = appendText(state, 'tres cuatro');
    expect(stateText(state)).toBe('uno dos tres cuatro');
    state = typeText(state, 's tres', 5_000);
    expect(state.wordIndex).toBe(2);
    expect(state.phase).toBe('running');
  });
});
