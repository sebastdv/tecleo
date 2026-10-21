import { wordCharStates, wordMatches, type CharState, type WordState } from '@tecleo/engine';
import { memo } from 'react';

const CHAR_CLASS: Record<CharState, string> = {
  pending: 'text-zinc-500',
  correct: 'text-zinc-100',
  corrected: 'text-zinc-100',
  incorrect: 'text-rose-400 underline decoration-2 underline-offset-4',
  extra: 'text-rose-300/80 underline decoration-2 underline-offset-4',
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
        className={skipped ? 'decoration-rose-400/70 underline decoration-wavy' : undefined}
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
