'use client';

import { resultSummarySchema, type SubmitResultInput } from '@tecleo/shared';
import { useEffect, useRef, useState } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { fetchApi, refreshSession } from '@/lib/api';

import { addGuestResult } from './guest-results';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'local' | 'error';

/** Con sesión, al servidor (que lo valida); sin sesión, a este navegador. */
async function saveResult(payload: SubmitResultInput): Promise<'saved' | 'local'> {
  if (useAuthStore.getState().status === 'unknown') await refreshSession();
  if (useAuthStore.getState().status !== 'authenticated') {
    addGuestResult(payload);
    return 'local';
  }
  await fetchApi('/results', resultSummarySchema, { method: 'POST', body: payload, auth: true });
  return 'saved';
}

/**
 * Guarda el resultado una sola vez por prueba (`round`), cuando `payload` está disponible.
 * Devuelve el estado para mostrarlo junto a los resultados.
 */
export function useSaveResult(round: number, payload: SubmitResultInput | null): SaveStatus {
  const [state, setState] = useState<{ round: number; status: SaveStatus } | null>(null);
  const savedRound = useRef<number | null>(null);

  useEffect(() => {
    if (!payload || savedRound.current === round) return;
    savedRound.current = round;
    // Sin cancelación: el guardado sigue aunque cambie la pantalla, y el estado es por ronda.
    const report = (status: SaveStatus) => {
      setState({ round, status });
    };
    queueMicrotask(() => {
      report('saving');
    });
    saveResult(payload).then(report, () => {
      report('error');
    });
  }, [round, payload]);

  return state?.round === round ? state.status : 'idle';
}
