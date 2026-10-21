import type { TypingAction } from './types.js';

/** Lo mínimo de un `InputEvent` que hace falta; así el motor no depende del DOM. */
export interface BeforeInputLike {
  readonly inputType: string;
  readonly data: string | null;
}

/**
 * Traduce un `beforeinput` a una acción del motor, o `null` si hay que ignorarlo.
 *
 * Las teclas muertas (´ + a = á) llegan como composición en macOS y Linux: los
 * `insertCompositionText` intermedios se ignoran y el resultado final llega por
 * `compositionend` (ver `actionFromCompositionEnd`). En Windows llegan como `insertText` normal.
 * Pegar, soltar, autocompletar y autocorrección devuelven `null`: quedan bloqueados.
 */
export function actionFromBeforeInput(event: BeforeInputLike): TypingAction | null {
  switch (event.inputType) {
    case 'insertText':
      return event.data ? { type: 'insert', text: event.data } : null;
    case 'insertLineBreak':
    case 'insertParagraph':
      return { type: 'insert', text: '\n' };
    case 'deleteContentBackward':
      return { type: 'deleteBackward' };
    case 'deleteWordBackward':
    case 'deleteSoftLineBackward':
    case 'deleteHardLineBackward':
      return { type: 'deleteWord' };
    default:
      return null;
  }
}

/** Resultado de una composición (tecla muerta o IME). */
export function actionFromCompositionEnd(data: string | null): TypingAction | null {
  return data ? { type: 'insert', text: data } : null;
}
