'use client';

import { liveMetrics, type TypingState } from '@tecleo/engine';

import { useNow } from './use-now';

interface LiveStatsProps {
  readonly state: TypingState;
  /** Muestra la cuenta atrás (modo por tiempo) en lugar del tiempo transcurrido. */
  readonly timeLimitMs: number | null;
  /** Progreso en palabras (modo por cantidad de palabras). */
  readonly wordGoal: number | null;
}

export function LiveStats({ state, timeLimitMs, wordGoal }: LiveStatsProps) {
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
    <dl className="flex gap-8 font-mono text-amber-300" aria-live="off">
      <div>
        <dt className="sr-only">{timeLimitMs !== null ? 'Tiempo restante' : 'Progreso'}</dt>
        <dd className="text-3xl">{progress}</dd>
      </div>
      <div className="flex items-baseline gap-1">
        <dt className="order-2 text-sm text-zinc-500">wpm</dt>
        <dd className="text-3xl">{Math.round(metrics.wpm)}</dd>
      </div>
      <div className="flex items-baseline gap-1">
        <dt className="order-2 text-sm text-zinc-500">precisión</dt>
        <dd className="text-3xl">{Math.round(metrics.accuracy)}%</dd>
      </div>
    </dl>
  );
}
