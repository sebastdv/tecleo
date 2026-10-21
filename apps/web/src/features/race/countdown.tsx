'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { useNow } from '../typing/use-now';

/** Cuánto sigue a la vista "¡ya!" después de la salida. */
const GO_VISIBLE_MS = 800;

/** Cuenta regresiva sobre el texto: 3, 2, 1, ¡ya! Cada número entra con un golpe corto. */
export function Countdown({ startAt }: { startAt: number }) {
  const t = useTranslations('race');
  const now = useNow(50, true);
  const remaining = startAt - now;
  if (remaining < -GO_VISIBLE_MS) return null;
  const label = remaining > 0 ? String(Math.ceil(remaining / 1_000)) : t('go');
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {/* Texto estable para lectores de pantalla; los números animados son decorativos. */}
      <span role="status" aria-live="assertive" className="sr-only">
        {label}
      </span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={label}
          aria-hidden="true"
          className="tabular font-heading text-8xl font-bold text-primary drop-shadow-sm"
          initial={{ scale: 1.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
