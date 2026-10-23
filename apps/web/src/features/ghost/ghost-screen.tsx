'use client';

import { createTypingState, decodeKeystrokes, progressTimeline } from '@tecleo/engine';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { ApiError } from '@/lib/api';

import { useRaceOfResult } from '../replay/use-race';
import { SoloRun, type Ghost } from '../solo/solo-run';

/**
 * Carrera fantasma (spec 5.5): el mismo texto contra la grabación de un resultado, con sus
 * mismas reglas. El servidor vuelve a medir al fantasma para decidir quién ganó.
 */
export function GhostScreen({ resultId }: { resultId: string }) {
  const t = useTranslations('ghost');
  const race = useRaceOfResult(resultId);
  const result = race.data?.results.find((candidate) => candidate.id === resultId);

  const ghost = useMemo((): Ghost | null => {
    if (!race.data || !result?.keystrokes || !result.completed) return null;
    const template = createTypingState({
      text: race.data.content,
      preserveLines: race.data.preserveLines,
      startOn: 'signal',
      rules: race.data.rules,
    });
    return {
      name: result.nickname ?? t('anonymous'),
      resultId,
      timeline: progressTimeline(template, decodeKeystrokes(result.keystrokes)),
    };
  }, [race.data, result, resultId, t]);

  const name = result?.nickname ?? null;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={name ? t('titleOf', { nickname: name }) : t('title')}
        description={
          result ? t('description', { wpm: Math.round(result.wpm) }) : t('descriptionGeneric')
        }
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
      ) : !ghost ? (
        <p role="alert">{t('unavailable')}</p>
      ) : (
        <SoloRun
          key={resultId}
          text={race.data.content}
          preserveLines={race.data.preserveLines}
          language={race.data.language}
          textId={race.data.textId}
          rules={race.data.rules}
          mode="ghost"
          ghost={ghost}
          attribution={t('attribution', { name: ghost.name })}
        />
      )}
    </div>
  );
}
