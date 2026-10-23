'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dailySchema, LANGUAGES, type Language } from '@tecleo/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fetchApi } from '@/lib/api';
import { useSettingsStore } from '@/settings/settings-store';

import { LeaderboardTable } from '../leaderboards/leaderboard-table';
import { SoloRun } from '../solo/solo-run';

/** Las reglas del desafío son las de las carreras: todos con las mismas. */
const RULES = { mode: 'strict', ignoreAccents: false } as const;

/** Desafío diario (spec 5.6): un texto por idioma y día, con su propio ranking. */
export function DailyScreen() {
  const t = useTranslations('daily');
  const tLanguages = useTranslations('settings.languages');
  const format = useFormatter();
  const client = useQueryClient();
  const [language, setLanguage] = useState<Language | null>(null);

  useEffect(() => {
    void Promise.resolve(useSettingsStore.persist.rehydrate()).then(() => {
      setLanguage((current) => current ?? useSettingsStore.getState().settings.textLanguage);
    });
  }, []);

  const daily = useQuery({
    queryKey: ['daily', language],
    queryFn: () => fetchApi(`/daily?language=${language ?? 'es'}`, dailySchema),
    enabled: language !== null,
  });
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['daily'] });
  }, [client]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4" data-chrome>
        <p className="text-muted-foreground">
          {daily.data &&
            t('date', {
              date: format.dateTime(new Date(`${daily.data.date}T12:00:00Z`), {
                dateStyle: 'full',
                timeZone: 'UTC',
              }),
            })}
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label={t('language')}
          value={language ?? ''}
          onValueChange={(value) => {
            const next = LANGUAGES.find((candidate) => candidate === value);
            if (next) setLanguage(next);
          }}
        >
          {LANGUAGES.map((value) => (
            <ToggleGroupItem key={value} value={value} className="px-3">
              {tLanguages(value)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {daily.isError ? (
        <p role="alert">{t('loadError')}</p>
      ) : !daily.data ? (
        <p aria-busy="true" className="text-muted-foreground">
          {t('loading')}
        </p>
      ) : (
        <>
          <SoloRun
            key={`${daily.data.date}-${daily.data.text.id}`}
            text={daily.data.text.content}
            preserveLines={false}
            language={daily.data.text.language}
            textId={daily.data.text.id}
            rules={RULES}
            mode="daily"
            attribution={
              daily.data.text.author && (
                <>
                  {daily.data.text.author}
                  {daily.data.text.source && (
                    <>
                      , <cite>{daily.data.text.source}</cite>
                    </>
                  )}
                </>
              )
            }
            onSaved={refresh}
          />
          <section aria-labelledby="daily-ranking" className="flex flex-col gap-4" data-chrome>
            <h2 id="daily-ranking" className="font-heading text-xl font-semibold">
              {t('ranking')}
            </h2>
            <LeaderboardTable entries={daily.data.entries} caption={t('ranking')} />
          </section>
        </>
      )}
    </div>
  );
}
