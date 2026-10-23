'use client';

import { encodeKeystrokes, stateText } from '@tecleo/engine';
import type { SubmitResultInput } from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { useSettings, useSettingsStore } from '@/settings/settings-store';

import { useSaveResult } from '@/results/save-result';
import { SaveStatusNote } from '@/results/save-status';

import { ResultInsights } from '../results/result-insights';
import { ResultsPanel } from '../results/results-panel';
import { LiveStats } from '../typing/live-stats';
import { TypingArea } from '../typing/typing-area';
import { useFocusMode } from '../typing/use-focus-mode';
import { useSoundedInput } from '../typing/use-sounded-input';
import { ConfigBar } from './config-bar';
import type { PracticeText } from './practice-config';
import { usePracticeStore } from './practice-store';

function Attribution({ source }: { source: PracticeText }) {
  const t = useTranslations('practice');
  if (source.quote) {
    return (
      <>
        {source.quote.author}, <cite>{source.quote.source}</cite>
      </>
    );
  }
  if (source.snippet) return <>{t('codeSnippet', { title: source.snippet.title })}</>;
  return null;
}

const currentTyping = () => usePracticeStore.getState().typing;

/** `?seed=123` reproduce el mismo texto (para compartir y para los tests E2E). */
function seedFromUrl(): number | undefined {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = value === null ? Number.NaN : Number(value);
  return Number.isInteger(seed) && seed >= 0 ? seed : undefined;
}

export function PracticeScreen() {
  const t = useTranslations('practice');
  const { config, status, source, typing, metrics, round, configure, next, repeat, input, tick } =
    usePracticeStore();
  const settings = useSettings();

  // Primero las preferencias guardadas (idioma, reglas), luego las opciones de la práctica.
  useEffect(() => {
    void (async () => {
      await useSettingsStore.persist.rehydrate();
      await usePracticeStore.persist.rehydrate();
      await usePracticeStore.getState().next(seedFromUrl());
    })();
  }, []);

  // Cambiar idioma o reglas en Configuración (o en la barra) prepara el texto de nuevo.
  const { textLanguage, typingMode, ignoreAccents } = settings;
  useEffect(() => {
    const store = usePracticeStore.getState();
    if (store.round > 0) void store.next(store.seed);
  }, [textLanguage, typingMode, ignoreAccents]);

  // El modo por tiempo termina aunque no se escriba nada.
  const timed = typing?.phase === 'running' && typing.timeLimitMs !== null;
  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => {
      tick(performance.now());
    }, 100);
    return () => {
      clearInterval(id);
    };
  }, [timed, tick]);

  useFocusMode(settings.focusMode && typing?.phase === 'running');

  // Esc abandona el intento y vuelve a empezar el mismo texto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (usePracticeStore.getState().typing?.phase === 'running') repeat();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [repeat]);

  const onAction = useSoundedInput(input, currentTyping);

  // Al terminar, el resultado se guarda (en la cuenta o en este navegador).
  const payload = useMemo((): SubmitResultInput | null => {
    if (!typing || !source || !metrics) return null;
    return {
      mode: 'practice',
      textId: source.quote?.id ?? source.snippet?.id ?? null,
      content: stateText(typing),
      preserveLines: source.preserveLines,
      language: source.quote?.language ?? (source.snippet ? 'en' : settings.textLanguage),
      rules: typing.rules,
      timeLimitMs: typing.timeLimitMs,
      practiceKind: config.mode,
      bots: null,
      keystrokes: encodeKeystrokes(typing.keystrokes) as SubmitResultInput['keystrokes'],
      playedAt: new Date().toISOString(),
    };
  }, [typing, source, metrics, config.mode, settings.textLanguage]);
  const saved = useSaveResult(round, payload);

  return (
    <div className="flex flex-col gap-10">
      <div data-chrome>
        <ConfigBar
          config={config}
          onChange={(patch) => {
            void configure(patch);
          }}
        />
      </div>

      <p className="hidden rounded-md bg-muted px-3 py-2 text-sm pointer-coarse:block">
        {t('mobileNotice')}
      </p>

      {status === 'error' && (
        <p role="alert" className="text-error">
          {t('loadError')}
        </p>
      )}

      {typing && source && metrics ? (
        <ResultsPanel
          metrics={metrics}
          attribution={<Attribution source={source} />}
          ignoreAccents={typing.rules.ignoreAccents}
          saveNote={
            <>
              <SaveStatusNote status={saved.status} />
              <ResultInsights
                resultId={saved.summary?.id ?? null}
                progress={saved.summary?.progress ?? null}
                wpm={metrics.wpm}
                textId={source.quote?.id ?? source.snippet?.id ?? null}
              />
            </>
          }
          onNext={() => {
            void next();
          }}
          onRepeat={repeat}
        />
      ) : (
        typing && (
          <div className="flex flex-col gap-6" aria-busy={status === 'loading'}>
            <div data-chrome={settings.showLiveStats ? undefined : ''}>
              <LiveStats
                state={typing}
                timeLimitMs={typing.timeLimitMs}
                wordGoal={config.mode === 'words' ? config.wordCount : null}
                showMetrics={settings.showLiveStats}
              />
            </div>
            <TypingArea
              key={round}
              state={typing}
              onAction={onAction}
              caretStyle={settings.caretStyle}
            />
            <div data-chrome className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {source && <Attribution source={source} />}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="pointer-coarse:hidden">{t('restartShortcut')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void next();
                  }}
                  aria-keyshortcuts="Tab Enter"
                >
                  {t('newText')}
                  <kbd className="ml-1 font-sans text-xs text-muted-foreground pointer-coarse:hidden">
                    {t('newTextShortcut')}
                  </kbd>
                </Button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
