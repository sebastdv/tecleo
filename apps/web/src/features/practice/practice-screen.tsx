'use client';

import type { TypingAction } from '@tecleo/engine';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { playKeySound } from '@/lib/key-sound';
import { useSettings, useSettingsStore } from '@/settings/settings-store';

import { ResultsPanel } from '../results/results-panel';
import { LiveStats } from '../typing/live-stats';
import { TypingArea } from '../typing/typing-area';
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

  // Modo concentración: mientras se escribe se esconde todo lo marcado con data-chrome.
  const focusing = settings.focusMode && typing?.phase === 'running';
  useEffect(() => {
    const root = document.documentElement;
    if (focusing) root.dataset.focusMode = '';
    else delete root.dataset.focusMode;
    return () => {
      delete root.dataset.focusMode;
    };
  }, [focusing]);

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

  const onAction = useCallback(
    (action: TypingAction, timestamp: number) => {
      const before = usePracticeStore.getState().typing?.keystrokes.length ?? 0;
      input(action, timestamp);
      if (action.type !== 'insert') return;
      const { keySound, soundVolume } = useSettingsStore.getState().settings;
      const last = usePracticeStore.getState().typing?.keystrokes.at(-1);
      const after = usePracticeStore.getState().typing?.keystrokes.length ?? 0;
      if (!last || after === before) return;
      const kind = !last.correct ? 'error' : last.input === ' ' ? 'space' : 'correct';
      playKeySound(keySound, soundVolume, kind);
    },
    [input],
  );

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
