'use client';

import type { RaceMetrics } from '@tecleo/engine';
import { useEffect, useRef, type ReactNode } from 'react';

import { WpmChart } from './wpm-chart';

interface ResultsPanelProps {
  readonly metrics: RaceMetrics;
  /** Atribución del texto (autor y obra, o lenguaje del fragmento de código). */
  readonly attribution: ReactNode;
  readonly ignoreAccents: boolean;
  readonly onNext: () => void;
  readonly onRepeat: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="font-mono text-2xl text-zinc-100" title={hint}>
        {value}
      </dd>
    </div>
  );
}

export function ResultsPanel({
  metrics,
  attribution,
  ignoreAccents,
  onNext,
  onRepeat,
}: ResultsPanelProps) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="results-title" className="flex flex-col gap-6">
      <h2 id="results-title" className="sr-only">
        Resultados
      </h2>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <dl className="flex gap-10">
          <div>
            <dt className="text-sm text-zinc-500">wpm</dt>
            <dd className="font-mono text-6xl text-amber-300">{Math.round(metrics.wpm)}</dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">precisión</dt>
            <dd className="font-mono text-6xl text-amber-300">{Math.round(metrics.accuracy)}%</dd>
          </div>
        </dl>
        {ignoreAccents && (
          <p className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-300">
            Con «ignorar tildes»: no cuenta para rankings
          </p>
        )}
      </div>

      <WpmChart timeline={metrics.timeline} />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="bruto" value={String(Math.round(metrics.rawWpm))} />
        <Stat label="consistencia" value={`${Math.round(metrics.consistency)}%`} />
        <Stat
          label="pico"
          value={String(Math.round(metrics.peakWpm))}
          hint="Mejor ventana de 5 s"
        />
        <Stat label="tiempo" value={`${(metrics.durationMs / 1_000).toFixed(1)} s`} />
        <Stat
          label="caracteres"
          value={`${metrics.correctChars}/${metrics.incorrectKeystrokes}/${metrics.missedChars}`}
          hint="correctos / errores / sin escribir"
        />
      </dl>

      <p className="text-sm text-zinc-400">{attribution}</p>

      <div className="flex gap-3">
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className="rounded-md bg-amber-300 px-4 py-2 font-medium text-zinc-950 hover:bg-amber-200"
        >
          Siguiente texto
        </button>
        <button
          type="button"
          onClick={onRepeat}
          className="rounded-md border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
        >
          Repetir
        </button>
      </div>
    </section>
  );
}
