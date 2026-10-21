'use client';

import { useEffect, useState } from 'react';

/** `performance.now()` actualizado cada `intervalMs` mientras `active` sea verdadero. */
export function useNow(intervalMs: number, active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setNow(performance.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs, active]);
  return now;
}
