'use client';

import { stateText, type TypingState } from '@tecleo/engine';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useTypingInput, type ActionHandler } from './use-typing-input';
import { Word } from './word';

export type CaretStyle = 'line' | 'block' | 'underline';

const CARET_CLASS: Record<CaretStyle, string> = {
  line: 'w-0.5 h-[1.2em] -translate-x-px',
  block: 'w-[1ch] h-[1.2em] opacity-40',
  underline: 'w-[1ch] h-0.5 translate-y-[1.1em]',
};

const VISIBLE_LINES = 3;

interface TypingAreaProps {
  readonly state: TypingState;
  readonly onAction: ActionHandler;
  readonly caretStyle?: CaretStyle;
  readonly autoFocus?: boolean;
}

/**
 * Área de escritura: un textarea invisible recibe el teclado y el texto se dibuja aparte,
 * en una ventana de tres líneas que se desplaza con el cursor.
 */
export function TypingArea({
  state,
  onAction,
  caretStyle = 'line',
  autoFocus = true,
}: TypingAreaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useTypingInput(inputRef, onAction);

  // El estado sale del DOM: un focus() hecho con la ventana sin foco no emite eventos.
  const syncFocus = useCallback(() => {
    setFocused(document.hasFocus() && document.activeElement === inputRef.current);
  }, []);

  const focus = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
    syncFocus();
  }, [syncFocus]);

  useEffect(() => {
    if (autoFocus) focus();
    window.addEventListener('focus', syncFocus);
    window.addEventListener('blur', syncFocus);
    return () => {
      window.removeEventListener('focus', syncFocus);
      window.removeEventListener('blur', syncFocus);
    };
  }, [autoFocus, focus, syncFocus]);

  // "Haz clic o presiona una tecla para continuar": una tecla imprimible devuelve el foco.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (focused || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, select, textarea, button, a'))
        return;
      focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [focused, focus]);

  const activeWord = state.words[state.wordIndex];
  const caretOffset = activeWord?.input.length ?? 0;

  // Posiciona el cursor y desplaza el texto sin re-renderizar: se mide el DOM después de pintar.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const caret = caretRef.current;
    const viewport = viewportRef.current;
    const wordElement = content?.querySelector<HTMLElement>(
      `[data-word-index="${state.wordIndex}"]`,
    );
    if (!content || !caret || !viewport || !wordElement) return;

    const chars = wordElement.children;
    const charAtCaret = chars.item(caretOffset) as HTMLElement | null;
    const lastChar = chars.item(chars.length - 1) as HTMLElement | null;
    let left = wordElement.offsetLeft;
    let top = wordElement.offsetTop;
    if (charAtCaret) {
      left = charAtCaret.offsetLeft;
      top = charAtCaret.offsetTop;
    } else if (lastChar) {
      left = lastChar.offsetLeft + lastChar.offsetWidth;
      top = lastChar.offsetTop;
    }
    caret.style.transform = `translate(${left}px, ${top}px)`;
    // Reinicia el parpadeo: el cursor queda fijo mientras se escribe.
    for (const animation of caret.getAnimations()) animation.currentTime = 0;

    const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight);
    viewport.style.height = `${lineHeight * VISIBLE_LINES}px`;
    const scroll = Math.max(0, top - lineHeight);
    content.style.transform = `translateY(${-scroll}px)`;
  }, [state.words, state.wordIndex, caretOffset]);

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        className="absolute inset-0 -z-10 resize-none opacity-0"
        aria-label="Texto a escribir"
        aria-describedby="typing-target"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onFocus={syncFocus}
        onBlur={syncFocus}
      />
      <p id="typing-target" className="sr-only">
        {stateText(state)}
      </p>

      <div
        ref={viewportRef}
        aria-hidden="true"
        className={`relative overflow-hidden transition-[filter] duration-200 select-none ${focused ? '' : 'blur-[3px]'}`}
      >
        <div
          ref={contentRef}
          className="relative font-mono text-2xl leading-[1.6] break-keep whitespace-pre-wrap transition-transform duration-150 ease-out motion-reduce:transition-none"
        >
          {state.words.map((word, index) => (
            <Word
              key={index}
              word={word}
              index={index}
              committed={index < state.wordIndex}
              ignoreAccents={state.rules.ignoreAccents}
            />
          ))}
          <div
            ref={caretRef}
            className={`animate-caret pointer-events-none absolute top-[0.2em] left-0 rounded-sm bg-amber-300 transition-transform duration-75 ease-out motion-reduce:transition-none ${CARET_CLASS[caretStyle]} ${state.phase === 'finished' ? 'hidden' : ''}`}
          />
        </div>
      </div>

      {!focused && (
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center text-lg text-zinc-300"
          onClick={focus}
        >
          Haz clic o presiona una tecla para continuar
        </button>
      )}
    </div>
  );
}
