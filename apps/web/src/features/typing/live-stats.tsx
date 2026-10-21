'use client';

import { liveMetrics, type TypingState } from '@tecleo/engine';
import { useTranslations } from 'next-intl';

import { useNow } from './use-now';

interface LiveStatsProps {
  readonly state: TypingState;
  /** Muestra la cuenta atrás (modo por tiempo) en lugar del tiempo transcurrido. */
  readonly timeLimitMs: number | null;
  /** Progreso en palabras (modo por cantidad de palabras). */
  readonly wordGoal: number | null;
  /** Si es falso solo se muestra el progreso (preferencia "mostrar ppm y precisión"). */
  readonly showMetrics: boolean;
}

export function LiveStats({ state, timeLimitMs, wordGoal, showMetrics }: LiveStatsProps) {
  const t = useTranslations('typing');
  const running = state.phase === 'running';
  const now = useNow(200, running);
  const metrics = liveMetrics(state, running ? Math.max(now, state.startedAt ?? now) : now);
  const elapsedSeconds = metrics.elapsedMs / 1_000;

  let progress: string;
  if (timeLimitMs !== null) {
    progress = String(Math.max(0, Math.ceil(timeLimitMs / 1_000 - elapsedSeconds)));
  } else if (wordGoal !== null) {
    progress = `${Math.min(state.wordIndex, wordGoal)}/${wordGoal}`;
  } else {
    progress = `${Math.floor(metrics.progress * 100)}%`;
  }

  return (
    <dl className="tabular flex items-baseline gap-8 text-primary">
      <div>
        <dt className="sr-only">{timeLimitMs !== null ? t('timeLeft') : t('progress')}</dt>
        <dd className="text-3xl font-semibold">{progress}</dd>
      </div>
      {showMetrics && (
        <>
          <div className="flex items-baseline gap-1.5">
            <dt className="order-2 text-sm text-muted-foreground" title={t('wpmLong')}>
              {t('wpm')}
            </dt>
            <dd className="text-3xl font-semibold">{Math.round(metrics.wpm)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="order-2 text-sm text-muted-foreground">{t('accuracy')}</dt>
            <dd className="text-3xl font-semibold">{Math.round(metrics.accuracy)}%</dd>
          </div>
        </>
      )}
    </dl>
  );
}
