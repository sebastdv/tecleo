'use client';

import { useEffect } from 'react';

import { refreshSession } from '@/lib/api';

/** Al cargar la app, recupera la sesión con la cookie de refresh (si la hay). */
export function SessionBootstrap() {
  useEffect(() => {
    void refreshSession();
  }, []);
  return null;
}
