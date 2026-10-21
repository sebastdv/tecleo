'use client';

import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@tecleo/shared';

import { fetchApi } from '@/lib/api';

/**
 * Indica si el server está disponible. En el plan gratuito el server se duerme y tarda
 * en despertar, así que mientras tanto se muestra "conectando…" y se reintenta.
 */
export function ServerStatus() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchApi('/health', healthResponseSchema),
    retry: 12,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    refetchInterval: 60_000,
  });

  let label = 'Conectando al servidor…';
  let tone = 'bg-amber-400 animate-pulse';
  if (data) {
    label = `Servidor en línea · v${data.version}`;
    tone = 'bg-emerald-400';
  } else if (isError) {
    label = 'Sin conexión con el servidor';
    tone = 'bg-rose-500';
  }

  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-400">
      <span aria-hidden="true" className={`inline-block size-2 rounded-full ${tone}`} />
      {label}
    </p>
  );
}
