'use client';

import {
  botWpmAt,
  correctChars,
  liveMetrics,
  totalChars,
  type BotRun,
  type TypingState,
} from '@tecleo/engine';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { useNow } from '../typing/use-now';
import { interpolatedProgress } from './progress';
import { PLAYER_ID } from './race-store';
import { Track, type TrackLane } from './track';

interface LocalTrackProps {
  readonly typing: TypingState;
  readonly bots: readonly BotRun[];
  /** Instante de la salida (`performance.now()`); `null` antes de la cuenta regresiva. */
  readonly startAt: number | null;
  /** Puesto final de cada corredor, cuando ya llegó. */
  readonly positions?: ReadonlyMap<string, number>;
}

/** Pista de la carrera contra bots: los bots siguen su registro precalculado. */
export function LocalTrack({ typing, bots, startAt, positions }: LocalTrackProps) {
  const t = useTranslations('race');
  const lastFinish = Math.max(0, ...bots.map((bot) => bot.finishMs));
  const racing = startAt !== null && typing.phase !== 'idle';
  const now = useNow(250, racing);
  const elapsed = startAt === null ? 0 : Math.max(0, now - startAt);

  const progressAt = useCallback(
    (id: string, at: number) => {
      const bot = bots.find((candidate) => candidate.profile.id === id);
      return bot && startAt !== null ? interpolatedProgress(bot, Math.max(0, at - startAt)) : 0;
    },
    [bots, startAt],
  );

  const lanes = useMemo((): TrackLane[] => {
    // Quien ya llegó tiene su puesto asegurado: nadie que siga en carrera puede superarlo.
    const provisional = (bot: BotRun) =>
      1 + bots.filter((other) => other.finishMs < bot.finishMs).length;
    const reference = typing.phase === 'running' ? now : (typing.finishedAt ?? now);
    return [
      {
        id: PLAYER_ID,
        name: t('you'),
        isBot: false,
        self: true,
        progress: correctChars(typing) / Math.max(1, totalChars(typing)),
        wpm: liveMetrics(typing, reference).wpm,
        position: positions?.get(PLAYER_ID),
      },
      ...bots.map((bot) => ({
        id: bot.profile.id,
        name: bot.profile.name,
        isBot: true,
        self: false,
        animated: true,
        progress: interpolatedProgress(bot, elapsed),
        wpm: botWpmAt(bot, elapsed),
        position:
          elapsed >= bot.finishMs
            ? (positions?.get(bot.profile.id) ?? provisional(bot))
            : undefined,
      })),
    ];
  }, [typing, bots, now, elapsed, positions, t]);

  return (
    <Track
      lanes={lanes}
      progressAt={progressAt}
      animating={racing && elapsed <= lastFinish + 500}
    />
  );
}
