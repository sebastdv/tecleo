'use client';

import { useEffect } from 'react';

/** Modo concentración: mientras `active`, se esconde todo lo marcado con `data-chrome`. */
export function useFocusMode(active: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.focusMode = '';
    else delete root.dataset.focusMode;
    return () => {
      delete root.dataset.focusMode;
    };
  }, [active]);
}
