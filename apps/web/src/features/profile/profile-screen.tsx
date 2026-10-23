'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ACHIEVEMENT_IDS,
  LANGUAGES,
  levelProgress,
  profileSchema,
  profileStatsSchema,
  racesPageSchema,
  type Language,
  type Profile,
  type ResultSummary,
} from '@tecleo/shared';
import { Award, Flag, Lock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { TypeAvatar } from '@/components/type-avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from '@/i18n/navigation';
import { ApiError, fetchApi } from '@/lib/api';
import { useSettings } from '@/settings/settings-store';
import { THEME_TOKENS } from '@/theme/themes';

import { cn } from '@/lib/utils';

import { KeyboardHeatmap } from './keyboard-heatmap';

type Mode = ResultSummary['mode'];
const MODES: readonly Mode[] = [
  'practice',
  'bots',
  'public',
  'private',
  'ghost',
  'daily',
  'targeted',
];

function countryFlag(code: string): string {
  return String.fromCodePoint(
    ...Array.from(code.toUpperCase()).map((ch) => 0x1f1a5 + ch.charCodeAt(0)),
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground" title={hint}>
        {label}
      </dt>
      <dd className="tabular font-heading text-3xl font-bold">{value}</dd>
    </div>
  );
}

function HistoryChart({ history }: { history: { createdAt: string; wpm: number }[] }) {
  const t = useTranslations('profile');
  const format = useFormatter();
  const colors = THEME_TOKENS[useSettings().theme];
  const data = history.map((point, index) => ({
    index: index + 1,
    wpm: Math.round(point.wpm),
    date: point.createdAt,
  }));
  return (
    <figure className="h-56 w-full" aria-label={t('evolutionLabel')}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={colors.border} vertical={false} />
          <XAxis dataKey="index" stroke={colors.mutedForeground} tickLine={false} fontSize={12} />
          <YAxis
            stroke={colors.mutedForeground}
            tickLine={false}
            fontSize={12}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.foreground,
            }}
            labelFormatter={(_, payload) => {
              const date = (payload[0]?.payload as { date?: string } | undefined)?.date;
              return (
                <>
                  {date
                    ? format.dateTime(new Date(date), { dateStyle: 'medium', timeStyle: 'short' })
                    : ''}
                </>
              );
            }}
            formatter={(value) => [String(value), 'ppm']}
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke={colors.accent}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Nivel y XP: cuánto lleva dentro del nivel y cuánto falta para el siguiente. */
function LevelBar({ xp }: { xp: number }) {
  const t = useTranslations('profile');
  const { level, current, needed } = levelProgress(xp);
  return (
    <div className="flex max-w-sm flex-col gap-1">
      <div
        role="progressbar"
        aria-label={t('levelProgress', { level: level + 1 })}
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={current}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(current / needed) * 100}%` }}
        />
      </div>
      <p className="tabular text-sm text-muted-foreground">
        {t('xpValue', { xp, current, needed, next: level + 1 })}
      </p>
    </div>
  );
}

/** Todos los logros: los conseguidos con su fecha; los demás, bloqueados con lo que piden. */
function Achievements({ unlocked }: { unlocked: Profile['achievements'] }) {
  const t = useTranslations('profile');
  const tAchievements = useTranslations('achievements');
  const format = useFormatter();
  const dates = new Map(unlocked.map((achievement) => [achievement.id, achievement.unlockedAt]));
  return (
    <Section title={t('achievements', { count: unlocked.length, total: ACHIEVEMENT_IDS.length })}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENT_IDS.map((id) => {
          const date = dates.get(id);
          return (
            <li
              key={id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3',
                date ? 'bg-card' : 'border-dashed text-muted-foreground',
              )}
            >
              {date ? (
                <Award aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              ) : (
                <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              )}
              <div className="flex flex-col">
                <span className={cn('font-medium', date && 'text-foreground')}>
                  {tAchievements(`${id}.name`)}
                  {!date && <span className="sr-only"> ({t('locked')})</span>}
                </span>
                <span className="text-sm">{tAchievements(`${id}.description`)}</span>
                {date && (
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(date), { dateStyle: 'medium' })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function History({ nickname }: { nickname: string }) {
  const t = useTranslations('profile');
  const tLanguages = useTranslations('settings.languages');
  const format = useFormatter();
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const [language, setLanguage] = useState<Language | 'all'>('all');

  const races = useInfiniteQuery({
    queryKey: ['profile-races', nickname, mode, language],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (mode !== 'all') params.set('mode', mode);
      if (language !== 'all') params.set('language', language);
      if (pageParam) params.set('cursor', pageParam);
      return fetchApi(`/users/${encodeURIComponent(nickname)}/races?${params}`, racesPageSchema);
    },
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = races.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Section title={t('history')}>
      <div className="flex flex-wrap gap-3">
        <Select
          value={mode}
          onValueChange={(value) => {
            setMode(value as Mode | 'all');
          }}
        >
          <SelectTrigger className="w-44" aria-label={t('filters.mode')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{`${t('filters.mode')}: ${t('filters.all')}`}</SelectItem>
            {MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`modes.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={language}
          onValueChange={(value) => {
            setLanguage(value as Language | 'all');
          }}
        >
          <SelectTrigger className="w-40" aria-label={t('filters.language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{`${t('filters.language')}: ${t('filters.all')}`}</SelectItem>
            {LANGUAGES.map((value) => (
              <SelectItem key={value} value={value}>
                {tLanguages(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 && !races.isPending ? (
        <p className="text-muted-foreground">{t('historyEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 font-normal">
                  {t('columns.date')}
                </th>
                <th scope="col" className="py-2 font-normal">
                  {t('columns.mode')}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t('columns.wpm')}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t('columns.accuracy')}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  {t('columns.position')}
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  <span className="sr-only">{t('columns.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">
                    {format.dateTime(new Date(item.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="py-2">
                    <span className="flex items-center gap-1.5">
                      {t(`modes.${item.mode}`)}
                      {item.flagged && (
                        <Flag className="size-3.5 text-error" aria-label={t('flagged')}>
                          <title>{t('flagged')}</title>
                        </Flag>
                      )}
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold">{Math.round(item.wpm)}</td>
                  <td className="py-2 text-right">{Math.round(item.accuracy)}%</td>
                  <td className="py-2 text-right">
                    {item.position === null
                      ? '—'
                      : t('positionValue', { position: item.position, runners: item.runners })}
                  </td>
                  <td className="py-2 pl-4 text-right whitespace-nowrap">
                    <Link
                      href={`/replay/${item.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t('replay')}
                    </Link>
                    {item.completed && (
                      <Link
                        href={`/ghost/${item.id}`}
                        className="ml-3 font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {t('ghost')}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {races.hasNextPage && (
        <Button
          variant="outline"
          className="self-start"
          disabled={races.isFetchingNextPage}
          onClick={() => void races.fetchNextPage()}
        >
          {t('loadMore')}
        </Button>
      )}
    </Section>
  );
}

export function ProfileScreen({ nickname }: { nickname: string }) {
  const t = useTranslations('profile');
  const tStats = useTranslations('profile.stats');
  const format = useFormatter();
  const { keyboardLayout } = useSettings();
  const profile = useQuery({
    queryKey: ['profile', nickname],
    queryFn: () => fetchApi(`/users/${encodeURIComponent(nickname)}`, profileSchema),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const stats = useQuery({
    queryKey: ['profile-stats', nickname],
    queryFn: () => fetchApi(`/users/${encodeURIComponent(nickname)}/stats`, profileStatsSchema),
    enabled: profile.isSuccess,
  });

  if (profile.isPending)
    return (
      <p aria-busy="true" className="text-muted-foreground">
        …
      </p>
    );
  if (profile.isError) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404;
    return <p role="alert">{notFound ? t('notFound') : t('loadError')}</p>;
  }

  const user = profile.data;
  return (
    <div className="flex flex-col gap-12">
      <header className="flex items-center gap-5">
        <TypeAvatar nickname={user.nickname} avatar={user.avatar} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {user.nickname}
            {user.country && (
              <span role="img" aria-label={user.country} className="text-2xl">
                {countryFlag(user.country)}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
            {t('level', { level: user.level })} ·{' '}
            {t('memberSince', {
              date: format.dateTime(new Date(user.createdAt), { dateStyle: 'long' }),
            })}
          </p>
          <LevelBar xp={user.xp} />
        </div>
      </header>

      <Achievements unlocked={user.achievements} />

      {user.stats.races === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">{t('empty')}</p>
          <Button asChild>
            <Link href="/race">{t('play')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Stat
              label={tStats('averageWpm')}
              value={String(Math.round(user.stats.averageWpm))}
              hint={tStats('averageWpmHint')}
            />
            <Stat label={tStats('bestWpm')} value={String(Math.round(user.stats.bestWpm))} />
            <Stat label={tStats('races')} value={String(user.stats.races)} />
            <Stat label={tStats('winRate')} value={`${Math.round(user.stats.winRate)}%`} />
            <Stat
              label={tStats('averageAccuracy')}
              value={`${Math.round(user.stats.averageAccuracy)}%`}
            />
          </dl>

          {stats.data && (
            <>
              <Section title={t('evolution')}>
                <HistoryChart history={stats.data.history} />
              </Section>

              <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
                <Section title={t('heatmap')}>
                  <KeyboardHeatmap stats={stats.data.keys} layout={keyboardLayout} />
                </Section>
                <Section title={t('bestByMode')}>
                  <dl className="flex flex-col gap-2">
                    {stats.data.bestByMode.map((best) => (
                      <div
                        key={best.mode}
                        className="flex items-baseline justify-between border-b pb-2"
                      >
                        <dt>{t(`modes.${best.mode}`)}</dt>
                        <dd className="tabular font-semibold">{Math.round(best.wpm)} ppm</dd>
                      </div>
                    ))}
                  </dl>
                </Section>
              </div>

              <Section title={t('bigrams')}>
                {stats.data.bigrams.length === 0 ? (
                  <p className="text-muted-foreground">{t('bigramsEmpty')}</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {stats.data.bigrams.map((bigram) => (
                      <li
                        key={bigram.key}
                        className="flex items-baseline gap-2 rounded-md border px-3 py-1.5"
                      >
                        <span className="font-game text-lg">{bigram.key}</span>
                        <span className="tabular text-sm text-muted-foreground">
                          {t('bigramRate', {
                            rate: Math.round((bigram.errors / bigram.attempts) * 100),
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}

          <History nickname={user.nickname} />
        </>
      )}
    </div>
  );
}
