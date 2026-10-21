'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

import { useSettings } from '@/settings/settings-store';
import { THEME_TOKENS } from '@/theme/themes';

const PIECES = 28;

/**
 * Confeti sutil al ganar: pocas piezas, colores del tema, una sola caída. No se muestra si el
 * sistema pide reducir el movimiento.
 */
export function Confetti() {
  const reduceMotion = useReducedMotion();
  const tokens = THEME_TOKENS[useSettings().theme];
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        // Distribución fija (no aleatoria) para que el render sea estable.
        left: ((index * 37) % 100) + (index % 3),
        delay: (index % 7) * 0.06,
        rotate: ((index * 53) % 360) - 180,
        drift: ((index * 29) % 60) - 30,
        color: [tokens.accent, tokens.foreground, tokens.error, tokens.mutedForeground][index % 4],
      })),
    [tokens],
  );
  if (reduceMotion) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-dvh overflow-hidden"
    >
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          className="absolute top-0 block h-3 w-1.5 rounded-[1px]"
          style={{ left: `${piece.left}%`, background: piece.color }}
          initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '70vh', x: piece.drift, rotate: piece.rotate, opacity: 0 }}
          transition={{ duration: 1.8, delay: piece.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
