'use client';

import { encodeKeystrokes, stateText } from '@tecleo/engine';
import type { SubmitResultInput } from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { useSettings, useSettingsStore } from '@/settings/settings-store';

import { useSaveResult } from '@/results/save-result';
import { SaveStatusNote } from '@/results/save-status';

import { ResultsPanel } from '../results/results-panel';
import { TypingArea } from '../typing/typing-area';
import { useFocusMode } from '../typing/use-focus-mode';
import { useSoundedInput } from '../typing/use-sounded-input';
import { Confetti } from './confetti';
import { Countdown } from './countdown';
import { Podium } from './podium';
import { PLAYER_ID, useRaceStore } from './race-store';
import { RaceSetup } from './race-setup';
import { Track } from './track';

const currentTyping = () => useRaceStore.getState().typing;

/** `?seed=123` fija texto y bots (para compartir una carrera y para los tests E2E). */
function seedFromUrl(): number | undefined {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = value === null ? Number.NaN : Number(value);
  return Number.isInteger(seed) && seed >= 0 ? seed : undefined;
}

export function RaceScreen() {
  const t = useTranslations('race');
  const settings = useSettings();
  const {
    phase,
    typing,
    bots,
    startAt,
    metrics,
    outcomes,
    quote,
    seed,
    round,
    input,
    tick,
    prepare,
    leave,
  } = useRaceStore();

  useEffect(() => {
    void (async () => {
      const hadConfig = localStorage.getItem('tecleo-race') !== null;
      await useSettingsStore.persist.rehydrate();
      await useRaceStore.persist.rehydrate();
      // La primera vez, la dificultad por defecto sale de Configuración.
      if (!hadConfig)
        useRaceStore.getState().configure({ level: useSettingsStore.getState().settings.botLevel });
      const seed = seedFromUrl();
      if (seed !== undefined) await useRaceStore.getState().prepare({ seed });
    })();
    return () => {
      useRaceStore.getState().leave();
    };
  }, []);

  // Reloj de la carrera: cuenta regresiva, salida y límite de tiempo.
  const live = phase === 'countdown' || phase === 'racing';
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      tick(performance.now());
    }, 50);
    return () => {
      clearInterval(id);
    };
  }, [live, tick]);

  useFocusMode(settings.focusMode && phase === 'racing');

  // Esc sale de la carrera (spec 9.5).
  useEffect(() => {
    if (!live) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) leave();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [live, leave]);

  const onAction = useSoundedInput(input, currentTyping);

  // El servidor regenera los bots con la semilla y los niveles, y decide las posiciones.
  const payload = useMemo((): SubmitResultInput | null => {
    if (phase !== 'finished' || !typing || !quote || !metrics) return null;
    return {
      mode: 'bots',
      textId: quote.id,
      content: stateText(typing),
      preserveLines: false,
      language: quote.language,
      rules: typing.rules,
      timeLimitMs: typing.timeLimitMs,
      practiceKind: null,
      bots: { seed, levels: bots.map((bot) => bot.profile.level) },
      keystrokes: encodeKeystrokes(typing.keystrokes) as SubmitResultInput['keystrokes'],
      playedAt: new Date().toISOString(),
    };
  }, [phase, typing, quote, metrics, seed, bots]);
  const saveStatus = useSaveResult(round, payload);
  const positions = useMemo(
    () => new Map(outcomes.map((outcome) => [outcome.id, outcome.position])),
    [outcomes],
  );

  if (phase === 'setup' || phase === 'loading' || !typing) {
    return <RaceSetup loading={phase === 'loading'} />;
  }

  const player = outcomes.find((outcome) => outcome.id === PLAYER_ID);

  return (
    <div className="flex flex-col gap-10">
      <Track
        typing={typing}
        bots={bots}
        startAt={startAt}
        {...(phase === 'finished' && { positions })}
      />

      {phase === 'finished' && metrics && player ? (
        <>
          {player.position === 1 && player.finishMs !== null && <Confetti />}
          <p role="status" className="font-heading text-2xl font-bold">
            {player.finishMs === null
              ? t('timeUp')
              : t('yourPlace', { position: player.position, total: outcomes.length })}
          </p>
          <Podium outcomes={outcomes} />
          <ResultsPanel
            metrics={metrics}
            attribution={
              quote && (
                <>
                  {quote.author}, <cite>{quote.source}</cite>
                </>
              )
            }
            ignoreAccents={typing.rules.ignoreAccents}
            saveNote={<SaveStatusNote status={saveStatus} />}
            nextLabel={t('another')}
            repeatLabel={t('rematch')}
            onNext={() => {
              void prepare();
            }}
            onRepeat={() => {
              void prepare({ rematch: true });
            }}
          />
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="relative">
            <TypingArea
              key={round}
              state={typing}
              onAction={onAction}
              caretStyle={settings.caretStyle}
            />
            {startAt !== null && <Countdown key={round} startAt={startAt} />}
          </div>
          <div data-chrome className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {quote && (
                <>
                  {quote.author}, <cite>{quote.source}</cite>
                </>
              )}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="pointer-coarse:hidden">{t('leaveShortcut')}</span>
              <Button variant="ghost" size="sm" onClick={leave}>
                {t('leave')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
