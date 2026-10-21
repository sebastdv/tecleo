'use client';

import {
  botWpmAt,
  correctChars,
  liveMetrics,
  totalChars,
  type BotRun,
  type TypingState,
} from '@tecleo/engine';
import { Bot, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

import { useNow } from '../typing/use-now';
import { interpolatedProgress } from './progress';

interface TrackProps {
  readonly typing: TypingState;
  readonly bots: readonly BotRun[];
  /** Instante de la salida (`performance.now()`); `null` antes de la cuenta regresiva. */
  readonly startAt: number | null;
  /** Puesto final de cada corredor, cuando ya llegó. */
  readonly positions?: ReadonlyMap<string, number>;
}

const RUNNER_SIZE = '2.25rem';

function Runner({ label, highlight }: { label: string; highlight: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[0.3rem] border font-game text-lg shadow-[inset_0_-0.18rem_0_var(--border)]',
        highlight
          ? 'border-primary bg-primary text-primary-foreground shadow-[inset_0_-0.18rem_0_color-mix(in_oklch,var(--primary),black_25%)]'
          : 'bg-card text-foreground',
      )}
      style={{ left: `calc(var(--p, 0) * (100% - ${RUNNER_SIZE}))` }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

function Lane({
  name,
  isBot,
  wpm,
  progress,
  position,
  laneRef,
  style,
  highlight,
}: {
  name: string;
  isBot: boolean;
  wpm: number;
  progress: number;
  position: number | undefined;
  laneRef?: (element: HTMLDivElement | null) => void;
  style?: CSSProperties;
  highlight: boolean;
}) {
  const t = useTranslations('race');
  return (
    <li className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_4.5rem]">
      <span
        className={cn('flex min-w-0 items-center gap-1.5 text-sm', highlight && 'font-semibold')}
      >
        {isBot && <Bot aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{name}</span>
        {isBot && <span className="sr-only">{t('botLabel')}</span>}
      </span>
      <div
        ref={laneRef}
        style={style}
        className={cn(
          'relative h-11 border-b border-dashed border-border',
          // El jugador salta de carácter en carácter: una transición corta lo suaviza.
          // Los bots ya se interpolan cuadro a cuadro.
          highlight && 'motion-safe:[&>span]:transition-[left] motion-safe:[&>span]:duration-100',
        )}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 right-0 bottom-1 w-0.5 rounded-full bg-primary/70"
        />
        <Runner label={name} highlight={highlight} />
        <span className="sr-only">{t('progress', { percent: Math.round(progress * 100) })}</span>
      </div>
      <span className="tabular text-right text-sm text-muted-foreground">
        {position !== undefined ? (
          <span className="font-semibold text-foreground">{t('position', { position })}</span>
        ) : (
          t('wpmValue', { wpm: Math.round(wpm) })
        )}
      </span>
    </li>
  );
}

/**
 * Pista de la carrera. Los bots se mueven con requestAnimationFrame interpolando su progreso
 * (sin re-renderizar React); el jugador avanza con cada pulsación.
 */
export function Track({ typing, bots, startAt, positions }: TrackProps) {
  const t = useTranslations('race');
  const laneRefs = useRef(new Map<string, HTMLDivElement>());
  const racing = startAt !== null && typing.phase !== 'idle';
  const now = useNow(250, racing);
  const elapsed = startAt === null ? 0 : Math.max(0, now - startAt);

  useEffect(() => {
    if (startAt === null) return;
    let frame = 0;
    const lastFinish = Math.max(0, ...bots.map((bot) => bot.finishMs));
    const draw = () => {
      const t = Math.max(0, performance.now() - startAt);
      for (const bot of bots) {
        laneRefs.current
          .get(bot.profile.id)
          ?.style.setProperty('--p', String(interpolatedProgress(bot, t)));
      }
      if (t <= lastFinish) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [bots, startAt]);

  // Quien ya llegó tiene su puesto asegurado: nadie que siga en carrera puede superarlo.
  const provisionalPosition = (bot: BotRun) =>
    1 + bots.filter((other) => other.finishMs < bot.finishMs).length;
  const playerProgress = correctChars(typing) / Math.max(1, totalChars(typing));
  const playerWpm = liveMetrics(
    typing,
    typing.phase === 'running' ? now : (typing.finishedAt ?? now),
  ).wpm;

  return (
    <section aria-labelledby="track-title" className="flex flex-col gap-1">
      <h2 id="track-title" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Flag aria-hidden="true" className="size-4" />
        {t('track')}
      </h2>
      <ol className="flex flex-col">
        <Lane
          name={t('you')}
          isBot={false}
          wpm={playerWpm}
          progress={playerProgress}
          position={positions?.get('player')}
          style={{ '--p': playerProgress } as CSSProperties}
          highlight
        />
        {bots.map((bot) => (
          <Lane
            key={bot.profile.id}
            name={bot.profile.name}
            isBot
            wpm={botWpmAt(bot, elapsed)}
            progress={Math.min(1, interpolatedProgress(bot, elapsed))}
            position={
              elapsed >= bot.finishMs
                ? (positions?.get(bot.profile.id) ?? provisionalPosition(bot))
                : undefined
            }
            laneRef={(element) => {
              if (element) laneRefs.current.set(bot.profile.id, element);
              else laneRefs.current.delete(bot.profile.id);
            }}
            highlight={false}
          />
        ))}
      </ol>
    </section>
  );
}
