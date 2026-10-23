'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LANGUAGES,
  LEADERBOARD_PERIODS,
  leaderboardSchema,
  type Language,
  type LeaderboardPeriod,
  type ResultSummary,
} from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fetchApi } from '@/lib/api';
import { useSettingsStore } from '@/settings/settings-store';

import { LeaderboardTable } from './leaderboard-table';

type Mode = ResultSummary['mode'] | 'all';
const MODES: readonly Mode[] = [
  'all',
  'practice',
  'bots',
  'public',
  'private',
  'daily',
  'ghost',
  'targeted',
];

/** Rankings diario, semanal e histórico, por idioma y modo (spec 8). */
export function LeaderboardsScreen() {
  const t = useTranslations('leaderboards');
  const tModes = useTranslations('profile.modes');
  const tLanguages = useTranslations('settings.languages');
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [language, setLanguage] = useState<Language | null>(null);
  const [mode, setMode] = useState<Mode>('all');

  // Por defecto, el idioma de los textos de la persona.
  useEffect(() => {
    void Promise.resolve(useSettingsStore.persist.rehydrate()).then(() => {
      setLanguage((current) => current ?? useSettingsStore.getState().settings.textLanguage);
    });
  }, []);

  const board = useQuery({
    queryKey: ['leaderboard', period, language, mode],
    queryFn: () =>
      fetchApi(
        `/leaderboards?${new URLSearchParams({ period, language: language ?? 'es', mode })}`,
        leaderboardSchema,
      ),
    enabled: language !== null,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label={t('period')}
          value={period}
          onValueChange={(value) => {
            const next = LEADERBOARD_PERIODS.find((candidate) => candidate === value);
            if (next) setPeriod(next);
          }}
        >
          {LEADERBOARD_PERIODS.map((value) => (
            <ToggleGroupItem key={value} value={value} className="px-3">
              {t(`periods.${value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          value={language ?? 'es'}
          onValueChange={(value) => {
            setLanguage(LANGUAGES.find((candidate) => candidate === value) ?? 'es');
          }}
        >
          <SelectTrigger className="w-40" aria-label={t('language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((value) => (
              <SelectItem key={value} value={value}>
                {tLanguages(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={mode}
          onValueChange={(value) => {
            setMode(MODES.find((candidate) => candidate === value) ?? 'all');
          }}
        >
          <SelectTrigger className="w-44" aria-label={t('mode')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {value === 'all' ? t('allModes') : tModes(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">{t('rules')}</p>
      {board.isError ? (
        <p role="alert">{t('loadError')}</p>
      ) : board.data ? (
        <LeaderboardTable
          entries={board.data.entries}
          caption={t('title')}
          showMode={mode === 'all'}
        />
      ) : (
        <p aria-busy="true" className="text-muted-foreground">
          {t('loading')}
        </p>
      )}
    </div>
  );
}
