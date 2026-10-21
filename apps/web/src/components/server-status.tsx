'use client';

import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@tecleo/shared';
import { useTranslations } from 'next-intl';

import { fetchApi } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Indica si el server está disponible. En el plan gratuito el server se duerme y tarda
 * en despertar, así que mientras tanto se muestra "conectando…" y se reintenta.
 */
export function ServerStatus({ className }: { className?: string }) {
  const t = useTranslations('serverStatus');
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetchApi('/health', healthResponseSchema),
    retry: 12,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    refetchInterval: 60_000,
  });

  let label = t('connecting');
  let tone = 'bg-primary animate-pulse motion-reduce:animate-none';
  if (data) {
    label = t('online', { version: data.version });
    tone = 'bg-[color-mix(in_oklch,var(--foreground),var(--primary)_40%)]';
  } else if (isError) {
    label = t('offline');
    tone = 'bg-error';
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
    >
      <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${tone}`} />
      {label}
    </p>
  );
}
