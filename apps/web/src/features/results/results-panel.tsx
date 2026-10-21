'use client';

import type { RaceMetrics } from '@tecleo/engine';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

import { WpmChart } from './wpm-chart';

interface ResultsPanelProps {
  readonly metrics: RaceMetrics;
  /** Atribución del texto (autor y obra, o fragmento de código). */
  readonly attribution: ReactNode;
  readonly ignoreAccents: boolean;
  readonly onNext: () => void;
  readonly onRepeat: () => void;
  /** Dónde quedó guardado el resultado (se muestra bajo la atribución). */
  readonly saveNote?: ReactNode;
  /** Textos de los botones; por defecto los de la práctica. */
  readonly nextLabel?: string;
  readonly repeatLabel?: string;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground" title={hint}>
        {label}
      </dt>
      <dd className="tabular text-2xl font-semibold">{value}</dd>
    </div>
  );
}

/** Al terminar, las cifras entran primero y luego el detalle: responde a la acción de acabar. */
const reveal = {
  hidden: { opacity: 0, y: 8 },
  shown: (order: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: order * 0.08, duration: 0.25 },
  }),
};

export function ResultsPanel({
  metrics,
  attribution,
  ignoreAccents,
  onNext,
  onRepeat,
  nextLabel,
  repeatLabel,
  saveNote,
}: ResultsPanelProps) {
  const t = useTranslations('results');
  const nextRef = useRef<HTMLButtonElement>(null);
  // Foco listo para Enter sin mover la página: arriba quedan el podio o las cifras principales.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-labelledby="results-title" className="flex flex-col gap-8">
      <h2 id="results-title" className="sr-only">
        {t('title')}
      </h2>
      <motion.div
        className="flex flex-wrap items-end gap-x-12 gap-y-4"
        variants={reveal}
        initial="hidden"
        animate="shown"
        custom={0}
      >
        <dl className="tabular flex gap-12">
          <div className="flex flex-col">
            <dt className="text-muted-foreground">{t('wpm')}</dt>
            <dd className="text-7xl leading-none font-bold text-primary">
              {Math.round(metrics.wpm)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">{t('accuracy')}</dt>
            <dd className="text-7xl leading-none font-bold text-primary">
              {Math.round(metrics.accuracy)}%
            </dd>
          </div>
        </dl>
        {ignoreAccents && (
          <p className="max-w-xs rounded-md bg-muted px-3 py-2 text-sm">{t('ignoreAccentsNote')}</p>
        )}
      </motion.div>

      <motion.div variants={reveal} initial="hidden" animate="shown" custom={1}>
        <WpmChart timeline={metrics.timeline} />
      </motion.div>

      <motion.dl
        className="grid grid-cols-2 gap-6 sm:grid-cols-5"
        variants={reveal}
        initial="hidden"
        animate="shown"
        custom={2}
      >
        <Stat label={t('raw')} value={String(Math.round(metrics.rawWpm))} />
        <Stat label={t('consistency')} value={`${Math.round(metrics.consistency)}%`} />
        <Stat label={t('peak')} value={String(Math.round(metrics.peakWpm))} hint={t('peakHint')} />
        <Stat
          label={t('time')}
          value={t('timeValue', { seconds: (metrics.durationMs / 1_000).toFixed(1) })}
        />
        <Stat
          label={t('chars')}
          value={`${metrics.correctChars}/${metrics.incorrectKeystrokes}/${metrics.missedChars}`}
          hint={t('charsHint')}
        />
      </motion.dl>

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground">{attribution}</p>
        {saveNote}
      </div>

      <div className="flex gap-3">
        <Button ref={nextRef} onClick={onNext} className="h-10 px-5">
          {nextLabel ?? t('next')}
        </Button>
        <Button variant="outline" onClick={onRepeat} className="h-10 px-5">
          {repeatLabel ?? t('repeat')}
        </Button>
      </div>
    </section>
  );
}
