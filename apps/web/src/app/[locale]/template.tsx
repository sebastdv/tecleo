import type { ReactNode } from 'react';

/**
 * Transición entre pantallas: un fundido corto (sin movimiento si se pide reducirlo). Es CSS,
 * no JS: la página se pinta sin esperar a la hidratación (el LCP no depende del bundle).
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col motion-safe:animate-in motion-safe:slide-in-from-bottom-1.5 motion-safe:duration-200 motion-safe:ease-out">
      {children}
    </div>
  );
}
