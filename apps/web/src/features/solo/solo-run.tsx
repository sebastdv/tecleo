'use client';

import {
  analyze,
  applyInput,
  beginCountdown,
  correctChars,
  createTypingState,
  encodeKeystrokes,
  liveMetrics,
  start,
  stateText,
  totalChars,
  wpmFrom,
  type ProgressTimeline,
  type TypingAction,
  type TypingMode,
  type TypingState,
} from '@tecleo/engine';
import type { Language, SubmitResultInput } from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useSettings } from '@/settings/settings-store';

import { useSaveResult } from '@/results/save-result';
import { SaveStatusNote } from '@/results/save-status';

import { Countdown } from '../race/countdown';
import { interpolatedProgress } from '../race/progress';
import { Track, type TrackLane } from '../race/track';
import { ResultInsights } from '../results/result-insights';
import { ResultsPanel } from '../results/results-panel';
import { LiveStats } from '../typing/live-stats';
import { TypingArea } from '../typing/typing-area';
import { useFocusMode } from '../typing/use-focus-mode';
import { useNow } from '../typing/use-now';
import { useSoundedInput } from '../typing/use-sounded-input';

/** Un rival grabado (carrera fantasma). */
export interface Ghost {
  readonly name: string;
  readonly resultId: string;
  readonly timeline: ProgressTimeline;
}

export interface SoloRunProps {
  readonly text: string;
  readonly preserveLines: boolean;
  readonly language: Language;
  readonly textId: string | null;
  readonly rules: { readonly mode: TypingMode; readonly ignoreAccents: boolean };
  readonly mode: 'daily' | 'targeted' | 'ghost';
  /** Contra un fantasma hay cuenta regresiva y el tiempo corre desde la salida. */
  readonly ghost?: Ghost;
  readonly attribution: ReactNode;
  /** "Otro ejercicio" (dirigida); sin él solo se ofrece repetir. */
  readonly onNext?: () => void;
  readonly nextLabel?: string;
  /** Se llama al guardar (para refrescar un ranking, por ejemplo). */
  readonly onSaved?: () => void;
}

const COUNTDOWN_MS = 3_000;
const GHOST_ID = 'ghost';
const SELF_ID = 'self';

/**
 * Una prueba en solitario sobre un texto dado: desafío diario, práctica dirigida o carrera
 * fantasma. Escribe, muestra resultados con su resumen y guarda (en la cuenta o local).
 * Para otro texto u otro fantasma, quien la usa le cambia la `key`.
 */
export function SoloRun(props: SoloRunProps) {
  const { text, preserveLines, rules, ghost, mode } = props;
  const t = useTranslations('solo');
  const settings = useSettings();

  const fresh = useCallback((): { typing: TypingState; startAt: number | null } => {
    const template = createTypingState({
      text,
      preserveLines,
      rules,
      startOn: ghost ? 'signal' : 'firstInput',
    });
    return ghost
      ? { typing: beginCountdown(template), startAt: performance.now() + COUNTDOWN_MS }
      : { typing: template, startAt: null };
  }, [text, preserveLines, rules, ghost]);

  const [run, setRun] = useState(() => ({ ...fresh(), round: 1 }));
  const typingRef = useRef(run.typing);
  const update = useCallback((typing: TypingState) => {
    typingRef.current = typing;
    setRun((current) => ({ ...current, typing }));
  }, []);
  const restart = useCallback(() => {
    const next = fresh();
    typingRef.current = next.typing;
    setRun((current) => ({ ...next, round: current.round + 1 }));
  }, [fresh]);

  const input = useCallback(
    (action: TypingAction, timestamp: number) => {
      const current = typingRef.current;
      if (current.phase === 'countdown' || current.phase === 'finished') return;
      const next = applyInput(current, action, timestamp);
      if (next !== current) update(next);
    },
    [update],
  );
  const onAction = useSoundedInput(input, () => typingRef.current);

  // Salida tras la cuenta regresiva.
  const { typing, startAt, round } = run;
  useEffect(() => {
    if (typing.phase !== 'countdown' || startAt === null) return;
    const id = setTimeout(
      () => {
        update(start(typingRef.current, startAt));
      },
      Math.max(0, startAt - performance.now()),
    );
    return () => {
      clearTimeout(id);
    };
  }, [typing.phase, startAt, update]);

  useFocusMode(settings.focusMode && typing.phase === 'running');

  // Esc vuelve a empezar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        typingRef.current.phase === 'running'
      )
        restart();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [restart]);

  const finished = typing.phase === 'finished';
  const metrics = useMemo(() => (finished ? analyze(typing) : null), [finished, typing]);
  const payload = useMemo((): SubmitResultInput | null => {
    if (!finished) return null;
    return {
      mode,
      textId: props.textId,
      content: stateText(typing),
      preserveLines,
      language: props.language,
      rules: typing.rules,
      timeLimitMs: typing.timeLimitMs,
      practiceKind: null,
      bots: null,
      ghostResultId: ghost?.resultId ?? null,
      keystrokes: encodeKeystrokes(typing.keystrokes) as SubmitResultInput['keystrokes'],
      playedAt: new Date().toISOString(),
    };
  }, [finished, typing, mode, props.textId, props.language, preserveLines, ghost]);
  const saved = useSaveResult(round, payload);
  const { onSaved } = props;
  useEffect(() => {
    if (saved.status === 'saved' || saved.status === 'local') onSaved?.();
  }, [saved.status, onSaved]);

  if (finished && metrics) {
    const completed = correctChars(typing) === totalChars(typing);
    const won = ghost && completed && metrics.durationMs < ghost.timeline.finishMs;
    return (
      <div className="flex flex-col gap-8">
        {ghost && (
          <p role="status" className="font-heading text-2xl font-bold">
            {won ? t('ghostWon', { name: ghost.name }) : t('ghostLost', { name: ghost.name })}
          </p>
        )}
        <ResultsPanel
          metrics={metrics}
          attribution={props.attribution}
          ignoreAccents={typing.rules.ignoreAccents}
          saveNote={
            <>
              <SaveStatusNote status={saved.status} />
              <ResultInsights
                resultId={saved.summary?.id ?? null}
                progress={saved.summary?.progress ?? null}
                wpm={metrics.wpm}
                textId={props.textId}
              />
            </>
          }
          nextLabel={props.nextLabel ?? t('again')}
          repeatLabel={t('again')}
          onNext={props.onNext ?? restart}
          {...(props.onNext && { onRepeat: restart })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {ghost && <GhostTrack typing={typing} ghost={ghost} startAt={startAt} />}
      {!ghost && (
        <div data-chrome={settings.showLiveStats ? undefined : ''}>
          <LiveStats
            state={typing}
            timeLimitMs={null}
            wordGoal={null}
            showMetrics={settings.showLiveStats}
          />
        </div>
      )}
      <div className="relative">
        <TypingArea
          key={`typing-${String(round)}`}
          state={typing}
          onAction={onAction}
          caretStyle={settings.caretStyle}
        />
        {startAt !== null && <Countdown key={`countdown-${String(round)}`} startAt={startAt} />}
      </div>
      <div data-chrome className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{props.attribution}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="pointer-coarse:hidden">{t('restartShortcut')}</span>
          <Button variant="ghost" size="sm" onClick={restart}>
            {t('restart')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Pista con dos carriles: quien escribe y el fantasma, que sigue su grabación. */
function GhostTrack({
  typing,
  ghost,
  startAt,
}: {
  typing: TypingState;
  ghost: Ghost;
  startAt: number | null;
}) {
  const t = useTranslations('solo');
  const racing = startAt !== null && typing.phase !== 'finished';
  const now = useNow(250, racing);
  const elapsed = startAt === null ? 0 : Math.max(0, now - startAt);
  const progressAt = useCallback(
    (_id: string, at: number) =>
      startAt === null ? 0 : interpolatedProgress(ghost.timeline, Math.max(0, at - startAt)),
    [ghost.timeline, startAt],
  );
  const lanes: TrackLane[] = [
    {
      id: SELF_ID,
      name: t('you'),
      isBot: false,
      self: true,
      progress: correctChars(typing) / Math.max(1, totalChars(typing)),
      wpm: liveMetrics(typing, typing.phase === 'running' ? now : (typing.finishedAt ?? now)).wpm,
    },
    {
      id: GHOST_ID,
      name: ghost.name,
      isBot: false,
      self: false,
      animated: true,
      progress: interpolatedProgress(ghost.timeline, elapsed),
      wpm:
        elapsed < 1_000
          ? 0
          : wpmFrom(
              interpolatedProgress(ghost.timeline, elapsed) * ghost.timeline.totalChars,
              Math.min(elapsed, ghost.timeline.finishMs),
            ),
      note: t('ghostTag'),
    },
  ];
  return <Track lanes={lanes} progressAt={progressAt} animating={racing} />;
}
