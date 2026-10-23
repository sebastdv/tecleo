'use client';

import { resultSummarySchema, type ResultSummary, type SubmitResultInput } from '@tecleo/shared';
import { useEffect, useRef, useState } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { fetchApi, refreshSession } from '@/lib/api';

import { addGuestResult } from './guest-results';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'local' | 'error';

/** Con sesión, al servidor (que lo valida); sin sesión, a este navegador. */
async function saveResult(payload: SubmitResultInput): Promise<ResultSummary | null> {
  if (useAuthStore.getState().status === 'unknown') await refreshSession();
  if (useAuthStore.getState().status !== 'authenticated') {
    addGuestResult(payload);
    return null;
  }
  const summary = await fetchApi('/results', resultSummarySchema, {
    method: 'POST',
    body: payload,
    auth: true,
  });
  // La XP y el nivel cambiaron: la sesión los muestra al instante.
  const { user, setUser } = useAuthStore.getState();
  if (user && summary.progress) {
    setUser({ ...user, xp: summary.progress.xp, level: summary.progress.level });
  }
  return summary;
}

export interface SaveState {
  readonly status: SaveStatus;
  /** Lo que devolvió el servidor (con sesión): XP, logros, comparaciones, id para la repetición. */
  readonly summary: ResultSummary | null;
}

/**
 * Guarda el resultado una sola vez por prueba (`round`), cuando `payload` está disponible.
 * Devuelve el estado y, con sesión, el resumen del servidor para mostrarlo con los resultados.
 */
export function useSaveResult(round: number, payload: SubmitResultInput | null): SaveState {
  const [state, setState] = useState<(SaveState & { round: number }) | null>(null);
  const savedRound = useRef<number | null>(null);

  useEffect(() => {
    if (!payload || savedRound.current === round) return;
    savedRound.current = round;
    // Sin cancelación: el guardado sigue aunque cambie la pantalla, y el estado es por ronda.
    const report = (status: SaveStatus, summary: ResultSummary | null = null) => {
      setState({ round, status, summary });
    };
    queueMicrotask(() => {
      report('saving');
    });
    saveResult(payload).then(
      (summary) => {
        report(summary ? 'saved' : 'local', summary);
      },
      () => {
        report('error');
      },
    );
  }, [round, payload]);

  return state?.round === round ? state : { status: 'idle', summary: null };
}
