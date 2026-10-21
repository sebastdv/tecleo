'use client';

import { actionFromBeforeInput, actionFromCompositionEnd, type TypingAction } from '@tecleo/engine';
import { useEffect, useRef, type RefObject } from 'react';

export type ActionHandler = (action: TypingAction, timestamp: number) => void;

/**
 * Conecta un `<textarea>` oculto al motor. Usa `beforeinput` y los eventos de composición
 * (no solo `keydown`) para que las teclas muertas (´ + a = á) funcionen en cualquier
 * distribución. Los tiempos son `event.timeStamp`, del mismo reloj que `performance.now()`.
 */
export function useTypingInput(
  ref: RefObject<HTMLTextAreaElement | null>,
  onAction: ActionHandler,
) {
  const handler = useRef(onAction);
  useEffect(() => {
    handler.current = onAction;
  }, [onAction]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onBeforeInput = (event: InputEvent) => {
      // Durante una composición el navegador escribe en el textarea; el resultado llega en compositionend.
      if (event.isComposing || event.inputType.includes('Composition')) return;
      event.preventDefault();
      const action = actionFromBeforeInput(event);
      if (action) handler.current(action, event.timeStamp);
    };

    const onCompositionEnd = (event: CompositionEvent) => {
      element.value = '';
      const action = actionFromCompositionEnd(event.data);
      if (action) handler.current(action, event.timeStamp);
    };

    // Con el textarea vacío algunos navegadores no emiten `beforeinput` al borrar: se resuelve aquí.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key !== 'Backspace') return;
      event.preventDefault();
      const wholeWord = event.ctrlKey || event.altKey || event.metaKey;
      handler.current({ type: wholeWord ? 'deleteWord' : 'deleteBackward' }, event.timeStamp);
    };

    const block = (event: Event) => {
      event.preventDefault();
    };

    element.addEventListener('beforeinput', onBeforeInput);
    element.addEventListener('compositionend', onCompositionEnd);
    element.addEventListener('keydown', onKeyDown);
    for (const type of ['paste', 'drop', 'cut', 'dragover']) element.addEventListener(type, block);
    return () => {
      element.removeEventListener('beforeinput', onBeforeInput);
      element.removeEventListener('compositionend', onCompositionEnd);
      element.removeEventListener('keydown', onKeyDown);
      for (const type of ['paste', 'drop', 'cut', 'dragover']) {
        element.removeEventListener(type, block);
      }
    };
  }, [ref]);
}
