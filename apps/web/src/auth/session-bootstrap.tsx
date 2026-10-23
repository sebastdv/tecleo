'use client';

import { useEffect } from 'react';

import { refreshSession } from '@/lib/api';

import { hasSessionHint, useAuthStore } from './auth-store';

/** Al cargar la app, recupera la sesión con la cookie de refresh (si este navegador tiene una). */
export function SessionBootstrap() {
  useEffect(() => {
    if (hasSessionHint()) void refreshSession();
    else useAuthStore.getState().clear();
  }, []);
  return null;
}
