'use client';

import {
  botWpmAt,
  createBots,
  createTypingState,
  decodeKeystrokes,
  liveMetrics,
  progressTimeline,
  type BotRun,
  type ProgressTimeline,
} from '@tecleo/engine';
import type { RaceDetail } from '@tecleo/shared';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { useSettings } from '@/settings/settings-store';

import { interpolatedProgress } from '../race/progress';
import { Track, type TrackLane } from '../race/track';
import { TypingArea } from '../typing/typing-area';
import { ReplayCursor } from './replay-cursor';
import { useRaceOfResult } from './use-race';

const SPEEDS = [0.5, 1, 2, 4] as const;
const noop = () => undefined;

interface Runner {
  readonly id: string;
  readonly name: string;
  readonly isBot: boolean;
  readonly timeline: ProgressTimeline;
  /** Los bots se regeneran con la semilla: su ppm en vivo sale del motor. */
  readonly bot: BotRun | null;
  readonly finalWpm: number;
}

/** Todos los corredores de la carrera como líneas de tiempo: personas grabadas y bots. */
function runnersOf(race: RaceDetail): Runner[] {
  const template = createTypingState({
    text: race.content,
    preserveLines: race.preserveLines,
    startOn: 'signal',
    rules: race.rules,
  });
  const bots =
    race.seed !== null && race.botLevels
      ? createBots({
          text: race.content,
          preserveLines: race.preserveLines,
          levels: race.botLevels,
          seed: race.seed,
        })
      : [];
  return race.results.flatMap((result): Runner[] => {
    if (result.keystrokes) {
      return [
        {
          id: result.id,
          name: result.nickname ?? '—',
          isBot: false,
          timeline: progressTimeline(template, decodeKeystrokes(result.keystrokes)),
          bot: null,
          finalWpm: result.wpm,
        },
      ];
    }
    const bot = bots.find((candidate) => candidate.profile.name === result.botName);
    return bot
      ? [
          {
            id: result.id,
            name: bot.profile.name,
            isBot: true,
            timeline: bot,
            bot,
            finalWpm: result.wpm,
          },
        ]
      : [];
  });
}

function Player({ race, resultId }: { race: RaceDetail; resultId: string }) {
  const t = useTranslations('replay');
  const settings = useSettings();
  const result = race.results.find((candidate) => candidate.id === resultId);
  const keystrokes = useMemo(
    () => (result?.keystrokes ? decodeKeystrokes(result.keystrokes) : []),
    [result],
  );
  const cursor = useMemo(
    () =>
      new ReplayCursor(
        createTypingState({
          text: race.content,
          preserveLines: race.preserveLines,
          rules: race.rules,
        }),
        keystrokes,
      ),
    [race, keystrokes],
  );
  const runners = useMemo(() => runnersOf(race), [race]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const timeRef = useRef(0);
  const duration = cursor.durationMs;

  const seek = useCallback(
    (value: number) => {
      timeRef.current = Math.max(0, Math.min(duration, value));
      setTime(timeRef.current);
    },
    [duration],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const next = timeRef.current + (now - last) * speed;
      last = now;
      seek(next);
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [playing, speed, duration, seek]);

  const progressAt = useCallback(
    (id: string) => {
      const runner = runners.find((candidate) => candidate.id === id);
      return runner ? interpolatedProgress(runner.timeline, timeRef.current) : 0;
    },
    [runners],
  );

  const state = cursor.at(time);
  const lanes: TrackLane[] = runners.map((runner) => ({
    id: runner.id,
    name: runner.name,
    isBot: runner.isBot,
    self: runner.id === resultId,
    animated: true,
    progress: interpolatedProgress(runner.timeline, time),
    wpm:
      time >= runner.timeline.finishMs
        ? runner.finalWpm
        : runner.bot
          ? botWpmAt(runner.bot, time)
          : runner.id === resultId
            ? liveMetrics(state, time).wpm
            : runner.finalWpm,
  }));

  if (!result?.keystrokes) return <p role="alert">{t('unavailable')}</p>;

  return (
    <div className="flex flex-col gap-8">
      {lanes.length > 1 && <Track lanes={lanes} progressAt={progressAt} animating />}
      <TypingArea
        state={state}
        onAction={noop}
        caretStyle={settings.caretStyle}
        autoFocus={false}
        interactive={false}
      />
      <div className="flex flex-col gap-4">
        <input
          type="range"
          min={0}
          max={duration}
          step={10}
          value={time}
          aria-label={t('position')}
          aria-valuetext={t('timeValue', {
            current: (time / 1_000).toFixed(1),
            total: (duration / 1_000).toFixed(1),
          })}
          onChange={(event) => {
            seek(Number(event.target.value));
          }}
          className="w-full accent-[var(--primary)]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              if (time >= duration) seek(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {playing ? t('pause') : t('play')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPlaying(false);
              seek(0);
            }}
          >
            <RotateCcw aria-hidden="true" />
            {t('restart')}
          </Button>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label={t('speed')}
            value={String(speed)}
            onValueChange={(value) => {
              const next = SPEEDS.find((candidate) => String(candidate) === value);
              if (next) setSpeed(next);
            }}
          >
            {SPEEDS.map((value) => (
              <ToggleGroupItem key={value} value={String(value)} className="px-3">
                {t('speedValue', { speed: value })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="tabular ml-auto text-sm text-muted-foreground">
            {t('timeValue', {
              current: (time / 1_000).toFixed(1),
              total: (duration / 1_000).toFixed(1),
            })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('summary', { wpm: Math.round(result.wpm), accuracy: Math.round(result.accuracy) })}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {result.completed && (
          <Button asChild>
            <Link href={`/ghost/${resultId}`}>{t('raceGhost')}</Link>
          </Button>
        )}
        {race.textId && (
          <Button asChild variant="outline">
            <Link href={`/texts/${encodeURIComponent(race.textId)}`}>{t('textLeaderboard')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Repetición pulsación por pulsación de un resultado guardado (spec 8). */
export function ReplayScreen({ resultId }: { resultId: string }) {
  const t = useTranslations('replay');
  const race = useRaceOfResult(resultId);
  const result = race.data?.results.find((candidate) => candidate.id === resultId);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={result?.nickname ? t('titleOf', { nickname: result.nickname }) : t('title')}
        description={t('description')}
      />
      {race.isPending ? (
        <p aria-busy="true" className="text-muted-foreground">
          {t('loading')}
        </p>
      ) : race.isError ? (
        <p role="alert">
          {race.error instanceof ApiError && race.error.status < 500
            ? t('notFound')
            : t('loadError')}
        </p>
      ) : (
        <Player race={race.data} resultId={resultId} />
      )}
    </div>
  );
}
