'use client';

import type { AuthResponse, Me } from '@tecleo/shared';
import { create } from 'zustand';

export type AuthStatus = 'unknown' | 'guest' | 'authenticated';

interface AuthStore {
  /** `unknown` mientras se comprueba la cookie de refresh al cargar. */
  readonly status: AuthStatus;
  readonly user: Me | null;
  /** Solo en memoria: nunca en localStorage (un XSS no podría robarlo después de cerrar). */
  readonly accessToken: string | null;
  setSession: (session: AuthResponse) => void;
  setUser: (user: Me) => void;
  clear: () => void;
}

/**
 * Pista (no secreta) de que este navegador tiene una sesión abierta. Sin ella no se pide el
 * refresh al cargar: un invitado no genera un 401 en cada visita.
 */
const SESSION_HINT = 'tecleo-has-session';

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    // Sin almacenamiento no se sabe: mejor preguntarle al servidor.
    return true;
  }
}

function setSessionHint(present: boolean): void {
  try {
    if (present) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    // Sin almacenamiento, cada carga pregunta al servidor.
  }
}

export const useAuthStore = create<AuthStore>()((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => {
    setSessionHint(true);
    set({ status: 'authenticated', user, accessToken });
  },
  setUser: (user) => {
    set({ user });
  },
  clear: () => {
    setSessionHint(false);
    set({ status: 'guest', user: null, accessToken: null });
  },
}));
