'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Transición entre pantallas: un fundido corto (sin movimiento si se pide reducirlo). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
