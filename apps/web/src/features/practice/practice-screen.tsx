'use client';

import { useEffect } from 'react';

import { ResultsPanel } from '../results/results-panel';
import { LiveStats } from '../typing/live-stats';
import { TypingArea } from '../typing/typing-area';
import { ConfigBar } from './config-bar';
import type { PracticeText } from './practice-config';
import { usePracticeStore } from './practice-store';

function Attribution({ source }: { source: PracticeText }) {
  if (source.quote) {
    return (
      <>
        — {source.quote.author}, <cite>{source.quote.source}</cite>
      </>
    );
  }
  if (source.snippet) return <>Fragmento de código: {source.snippet.title}</>;
  return null;
}

/** `?seed=123` reproduce el mismo texto (para compartir y para los tests E2E). */
function seedFromUrl(): number | undefined {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = value === null ? Number.NaN : Number(value);
  return Number.isInteger(seed) && seed >= 0 ? seed : undefined;
}

export function PracticeScreen() {
  const { config, status, source, typing, metrics, round, configure, next, repeat, input, tick } =
    usePracticeStore();

  useEffect(() => {
    void usePracticeStore.getState().next(seedFromUrl());
  }, []);

  // El modo por tiempo termina aunque no se escriba nada.
  const running = typing?.phase === 'running' && typing.timeLimitMs !== null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tick(performance.now());
    }, 100);
    return () => {
      clearInterval(id);
    };
  }, [running, tick]);

  return (
    <div className="flex flex-col gap-8">
      <ConfigBar
        config={config}
        onChange={(patch) => {
          void configure(patch);
        }}
      />

      {status === 'error' && (
        <p role="alert" className="text-rose-400">
          No se pudo cargar el texto. Recarga la página para intentarlo de nuevo.
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
            <LiveStats
              state={typing}
              timeLimitMs={typing.timeLimitMs}
              wordGoal={config.mode === 'words' ? config.wordCount : null}
            />
            <TypingArea key={round} state={typing} onAction={input} />
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-500">{source && <Attribution source={source} />}</p>
              <button
                type="button"
                onClick={() => {
                  void next();
                }}
                aria-keyshortcuts="Tab Enter"
                className="rounded-md px-3 py-1 text-sm text-zinc-400 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                Nuevo texto <span className="text-zinc-600">(Tab + Enter)</span>
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
