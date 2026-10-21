'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * El nombre se compone como en una imprenta: cada letra es un tipo metálico que cae en la
 * línea, y al final aparece el cursor de latón. Es la única animación automática del sitio.
 */
export function ComposedTitle({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const letters = Array.from(text);
  return (
    <h1
      aria-label={text}
      className="flex items-end font-game text-[clamp(3.5rem,13vw,8.5rem)] leading-none"
    >
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          aria-hidden="true"
          className="mr-[0.06em] inline-flex h-[1.18em] w-[0.78em] items-center justify-center rounded-[0.06em] border border-border bg-card text-foreground shadow-[inset_0_-0.05em_0_var(--border)]"
          initial={reduceMotion ? false : { y: '-0.6em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 + index * 0.08, type: 'spring', stiffness: 520, damping: 30 }}
        >
          {letter}
        </motion.span>
      ))}
      <motion.span
        aria-hidden="true"
        className="animate-caret ml-[0.04em] inline-block h-[1.05em] w-[0.12em] self-center rounded-[0.02em] bg-primary"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 + letters.length * 0.08 }}
      />
    </h1>
  );
}
