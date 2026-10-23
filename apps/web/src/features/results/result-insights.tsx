'use client';

import type { ProgressUpdate } from '@tecleo/shared';
import { Award, History, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { TextRating } from './text-rating';

interface ResultInsightsProps {
  /** Resultado guardado (con cuenta): habilita la repetición. */
  readonly resultId: string | null;
  readonly progress: ProgressUpdate | null;
  readonly wpm: number;
  /** Texto del corpus, si lo fue: ranking del texto y calificación. */
  readonly textId: string | null;
}

const linkClass =
  'inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline';

/**
 * Lo que dice una prueba más allá de sus cifras (spec 9.3): XP ganada, nivel, logros nuevos,
 * comparación con tu promedio y tus récords, repetición, ranking del texto y calificación.
 */
export function ResultInsights({ resultId, progress, wpm, textId }: ResultInsightsProps) {
  const t = useTranslations('insights');
  const tAchievements = useTranslations('achievements');

  const comparisons: string[] = [];
  if (progress) {
    const {
      previousAverageWpm: average,
      previousBestWpm: best,
      previousTextBestWpm: textBest,
    } = progress;
    if (best !== null && wpm > best) comparisons.push(t('newBest', { previous: Math.round(best) }));
    else if (best !== null) comparisons.push(t('best', { best: Math.round(best) }));
    if (average !== null) {
      const diff = Math.round(wpm - average);
      comparisons.push(
        diff >= 0
          ? t('aboveAverage', { diff, average: Math.round(average) })
          : t('belowAverage', { diff: -diff, average: Math.round(average) }),
      );
    }
    if (textBest !== null) {
      comparisons.push(
        wpm > textBest
          ? t('newTextBest', { previous: Math.round(textBest) })
          : t('textBest', { best: Math.round(textBest) }),
      );
    }
  }

  return (
    <section aria-label={t('label')} className="flex flex-col gap-3 text-sm">
      {progress && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-heading text-lg font-semibold text-primary">
            {t('xpGained', { xp: progress.xpGained })}
          </span>
          <span className="text-muted-foreground">
            {progress.leveledUp
              ? t('leveledUp', { level: progress.level })
              : t('level', { level: progress.level })}
          </span>
        </p>
      )}
      {progress && progress.achievements.length > 0 && (
        <div role="status" className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 font-medium">
            <Award aria-hidden="true" className="size-4 text-primary" />
            {t('newAchievements', { count: progress.achievements.length })}
          </p>
          <ul className="flex flex-wrap gap-2">
            {progress.achievements.map((id) => (
              <li key={id} className="rounded-md border bg-card px-2 py-1">
                <span className="font-medium">{tAchievements(`${id}.name`)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  — {tAchievements(`${id}.description`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {comparisons.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-muted-foreground">
          {comparisons.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {resultId && (
          <Link href={`/replay/${resultId}`} className={linkClass}>
            <History aria-hidden="true" className="size-4" />
            {t('replay')}
          </Link>
        )}
        {textId && (
          <Link href={`/texts/${encodeURIComponent(textId)}`} className={linkClass}>
            <Trophy aria-hidden="true" className="size-4" />
            {t('textLeaderboard')}
          </Link>
        )}
      </div>
      {textId && <TextRating textId={textId} />}
    </section>
  );
}
