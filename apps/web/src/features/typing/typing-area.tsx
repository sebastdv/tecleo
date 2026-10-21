'use client';

import type { CaretStyle } from '@tecleo/shared';
import { stateText, type TypingState } from '@tecleo/engine';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { useTypingInput, type ActionHandler } from './use-typing-input';
import { Word } from './word';

const CARET_CLASS: Record<CaretStyle, string> = {
  line: 'w-[0.1em] min-w-0.5 h-[1.2em] -translate-x-[0.05em]',
  block: 'w-[1ch] h-[1.2em] opacity-35',
  underline: 'w-[1ch] h-[0.12em] min-h-0.5 translate-y-[1.12em]',
};

interface TypingAreaProps {
  readonly state: TypingState;
  readonly onAction: ActionHandler;
  readonly caretStyle?: CaretStyle;
  readonly autoFocus?: boolean;
  /** `false` para vistas previas: sin teclado, sin foco y sin aviso. */
  readonly interactive?: boolean;
  readonly lines?: number;
}

/**
 * Área de escritura: un textarea invisible recibe el teclado y el texto se dibuja aparte,
 * en una ventana de pocas líneas que se desplaza con el cursor.
 */
export function TypingArea({
  state,
  onAction,
  caretStyle = 'line',
  autoFocus = true,
  interactive = true,
  lines = 3,
}: TypingAreaProps) {
  const t = useTranslations('typing');
  const targetId = useId();
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
    if (!interactive) return;
    if (autoFocus) focus();
    window.addEventListener('focus', syncFocus);
    window.addEventListener('blur', syncFocus);
    return () => {
      window.removeEventListener('focus', syncFocus);
      window.removeEventListener('blur', syncFocus);
    };
  }, [interactive, autoFocus, focus, syncFocus]);

  // "Haz clic o presiona una tecla para continuar": una tecla imprimible devuelve el foco.
  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (focused || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, select, textarea, button, a, [role]')
      ) {
        return;
      }
      focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [interactive, focused, focus]);

  const activeWord = state.words[state.wordIndex];
  const caretOffset = activeWord?.input.length ?? 0;

  /** Coloca el cursor y desplaza el texto midiendo el DOM, sin pasar por React. */
  const position = useCallback(() => {
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
    viewport.style.height = `${lineHeight * lines}px`;
    const scroll = Math.max(0, top - (lines > 2 ? lineHeight : 0));
    content.style.transform = `translateY(${-scroll}px)`;
  }, [state.wordIndex, caretOffset, lines]);

  useLayoutEffect(position, [position, state.words]);

  // Cambios de tipografía, tamaño o ancho de ventana mueven las letras: se vuelve a medir.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      position();
    });
    observer.observe(content);
    void document.fonts.ready.then(position);
    return () => {
      observer.disconnect();
    };
  }, [position]);

  const blurred = interactive && !focused;

  return (
    <div className="relative">
      {interactive && (
        <>
          <textarea
            ref={inputRef}
            className="absolute inset-0 -z-10 resize-none opacity-0"
            aria-label={t('inputLabel')}
            aria-describedby={targetId}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onFocus={syncFocus}
            onBlur={syncFocus}
          />
          <p id={targetId} data-typing-target className="sr-only">
            {stateText(state)}
          </p>
        </>
      )}

      <div
        ref={viewportRef}
        aria-hidden="true"
        className={cn(
          'relative overflow-hidden select-none transition-[filter,opacity] duration-200',
          blurred && 'opacity-60 blur-[3px]',
        )}
      >
        <div
          ref={contentRef}
          className="relative font-game text-game leading-[1.6] break-keep whitespace-pre-wrap transition-transform duration-150 ease-out motion-reduce:transition-none"
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
            className={cn(
              'pointer-events-none absolute top-[0.2em] left-0 rounded-[1px] bg-primary transition-transform duration-75 ease-out motion-reduce:transition-none',
              interactive && 'animate-caret',
              CARET_CLASS[caretStyle],
              state.phase === 'finished' && 'hidden',
            )}
          />
        </div>
      </div>

      {blurred && (
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center rounded-lg text-lg font-medium text-foreground"
          onClick={focus}
        >
          {t('focusOverlay')}
        </button>
      )}
    </div>
  );
}
