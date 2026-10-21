'use client';

import { Bot } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { RunnerOutcome } from './race-store';

/** Altura de cada escalón y orden visual: segundo, primero, tercero. */
const STEPS = [
  { place: 1, height: 'h-28', order: 'order-2' },
  { place: 2, height: 'h-20', order: 'order-1' },
  { place: 3, height: 'h-14', order: 'order-3' },
] as const;

function displayName(outcome: RunnerOutcome, you: string): string {
  return outcome.isBot ? outcome.name : you;
}

/** Podio animado: los escalones suben en orden de llegada y la tabla completa va debajo. */
export function Podium({ outcomes }: { outcomes: readonly RunnerOutcome[] }) {
  const t = useTranslations('race');
  const reduceMotion = useReducedMotion();
  const podium = outcomes.filter((outcome) => outcome.finishMs !== null).slice(0, 3);

  return (
    <section aria-labelledby="podium-title" className="flex flex-col gap-8">
      <h2 id="podium-title" className="font-heading text-2xl font-bold tracking-tight">
        {t('podium')}
      </h2>
      <ol className="flex items-end justify-center gap-3 sm:gap-5">
        {STEPS.map(({ place, height, order }, index) => {
          const outcome = podium[place - 1];
          if (!outcome) return null;
          const you = !outcome.isBot;
          return (
            <motion.li
              key={outcome.id}
              className={cn('flex w-28 flex-col items-center gap-2 sm:w-36', order)}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.15 + index * 0.15,
                type: 'spring',
                stiffness: 300,
                damping: 24,
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-12 items-center justify-center rounded-md border font-game text-2xl',
                  you ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                )}
              >
                {displayName(outcome, t('you')).charAt(0).toUpperCase()}
              </span>
              <span className={cn('flex items-center gap-1 text-sm', you && 'font-semibold')}>
                {outcome.isBot && (
                  <Bot aria-hidden="true" className="size-3.5 text-muted-foreground" />
                )}
                {displayName(outcome, t('you'))}
                {outcome.isBot && <span className="sr-only">{t('botLabel')}</span>}
              </span>
              <span className="tabular text-sm text-muted-foreground">
                {t('wpmValue', { wpm: Math.round(outcome.wpm) })}
              </span>
              <div
                className={cn(
                  'flex w-full items-start justify-center rounded-t-md border border-b-0 pt-2 font-heading text-2xl font-bold',
                  height,
                  place === 1 ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground',
                )}
              >
                <span className="sr-only">{t('placeLabel')}</span>
                {place}
              </div>
            </motion.li>
          );
        })}
      </ol>

      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('standings')}</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-2 font-normal">
              {t('columns.position')}
            </th>
            <th scope="col" className="py-2 font-normal">
              {t('columns.runner')}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              {t('columns.wpm')}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              {t('columns.accuracy')}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              {t('columns.time')}
            </th>
          </tr>
        </thead>
        <tbody className="tabular">
          {outcomes.map((outcome) => (
            <tr key={outcome.id} className={cn('border-b', !outcome.isBot && 'font-semibold')}>
              <td className="py-2">{t('position', { position: outcome.position })}</td>
              <td className="py-2">
                <span className="flex items-center gap-1.5">
                  {outcome.isBot && (
                    <Bot aria-hidden="true" className="size-4 text-muted-foreground" />
                  )}
                  {displayName(outcome, t('you'))}
                  {outcome.isBot && <span className="sr-only">{t('botLabel')}</span>}
                </span>
              </td>
              <td className="py-2 text-right">{Math.round(outcome.wpm)}</td>
              <td className="py-2 text-right">{Math.round(outcome.accuracy)}%</td>
              <td className="py-2 text-right">
                {outcome.finishMs === null
                  ? t('dnf')
                  : t('seconds', { seconds: (outcome.finishMs / 1_000).toFixed(1) })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
