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

export const useAuthStore = create<AuthStore>()((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => {
    set({ status: 'authenticated', user, accessToken });
  },
  setUser: (user) => {
    set({ user });
  },
  clear: () => {
    set({ status: 'guest', user: null, accessToken: null });
  },
}));
