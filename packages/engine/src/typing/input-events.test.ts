import { describe, expect, it } from 'vitest';

import { actionFromBeforeInput, actionFromCompositionEnd } from './input-events.js';

describe('actionFromBeforeInput', () => {
  it('traduce escritura, saltos de línea y borrados', () => {
    expect(actionFromBeforeInput({ inputType: 'insertText', data: 'ñ' })).toEqual({
      type: 'insert',
      text: 'ñ',
    });
    expect(actionFromBeforeInput({ inputType: 'insertLineBreak', data: null })).toEqual({
      type: 'insert',
      text: '\n',
    });
    expect(actionFromBeforeInput({ inputType: 'deleteContentBackward', data: null })).toEqual({
      type: 'deleteBackward',
    });
    for (const inputType of ['deleteWordBackward', 'deleteSoftLineBackward']) {
      expect(actionFromBeforeInput({ inputType, data: null })).toEqual({ type: 'deleteWord' });
    }
  });

  it('bloquea pegar, soltar, autocorrección y las composiciones intermedias', () => {
    for (const inputType of [
      'insertFromPaste',
      'insertFromDrop',
      'insertFromYank',
      'insertReplacementText',
      'insertCompositionText',
      'insertFromComposition',
      'deleteCompositionText',
      'deleteContentForward',
      'historyUndo',
    ]) {
      expect(actionFromBeforeInput({ inputType, data: 'x' })).toBeNull();
    }
    expect(actionFromBeforeInput({ inputType: 'insertText', data: '' })).toBeNull();
  });
});

describe('actionFromCompositionEnd', () => {
  it('inserta el resultado de la tecla muerta', () => {
    expect(actionFromCompositionEnd('á')).toEqual({ type: 'insert', text: 'á' });
    expect(actionFromCompositionEnd('´n')).toEqual({ type: 'insert', text: '´n' });
    expect(actionFromCompositionEnd('')).toBeNull();
    expect(actionFromCompositionEnd(null)).toBeNull();
  });
});
