import { wordCharStates, wordMatches, type CharState, type WordState } from '@tecleo/engine';
import { memo } from 'react';

const CHAR_CLASS: Record<CharState, string> = {
  pending: 'text-pending',
  correct: 'text-foreground',
  corrected: 'text-foreground',
  // El error se marca con color y subrayado: no depende solo del color.
  incorrect: 'text-error underline decoration-2 underline-offset-[0.2em]',
  extra: 'text-error underline decoration-dotted decoration-2 underline-offset-[0.2em]',
};

/** Espacios y saltos escritos de más se muestran visibles. */
function visible(ch: string): string {
  if (ch === ' ') return '·';
  if (ch === '\n') return '↵';
  return ch;
}

interface WordProps {
  readonly word: WordState;
  readonly index: number;
  /** Palabra ya confirmada (quedó atrás del cursor). */
  readonly committed: boolean;
  readonly ignoreAccents: boolean;
}

/**
 * Una palabra del texto. Memoizada: al escribir solo se vuelve a renderizar la palabra
 * activa (el motor reemplaza únicamente el objeto de esa palabra).
 */
export const Word = memo(function Word({ word, index, committed, ignoreAccents }: WordProps) {
  const states = wordCharStates(word, ignoreAccents);
  const skipped = committed && !wordMatches(word, ignoreAccents);
  return (
    <>
      <span
        data-word-index={index}
        className={skipped ? 'underline decoration-error/70 decoration-wavy' : undefined}
      >
        {states.map((state, i) => (
          <span key={i} className={CHAR_CLASS[state]}>
            {state === 'extra' ? visible(word.input.charAt(i)) : word.target.charAt(i)}
          </span>
        ))}
      </span>
      {word.separator}
    </>
  );
});
