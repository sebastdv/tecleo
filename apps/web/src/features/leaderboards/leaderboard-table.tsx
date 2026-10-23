'use client';

import type { LeaderboardEntry } from '@tecleo/shared';
import { useFormatter, useTranslations } from 'next-intl';

import { TypeAvatar } from '@/components/type-avatar';
import { Link } from '@/i18n/navigation';

const actionClass = 'font-medium text-primary underline-offset-4 hover:underline';

/** Tabla de un ranking: puesto, persona, cifras y accesos a su repetición y a su fantasma. */
export function LeaderboardTable({
  entries,
  caption,
  showMode = false,
}: {
  entries: readonly LeaderboardEntry[];
  caption: string;
  showMode?: boolean;
}) {
  const t = useTranslations('leaderboards');
  const tModes = useTranslations('profile.modes');
  const format = useFormatter();
  if (entries.length === 0) return <p className="text-muted-foreground">{t('empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="w-12 py-2 font-normal">
              {t('columns.rank')}
            </th>
            <th scope="col" className="py-2 font-normal">
              {t('columns.player')}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              {t('columns.wpm')}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              {t('columns.accuracy')}
            </th>
            {showMode && (
              <th scope="col" className="py-2 pl-4 font-normal">
                {t('columns.mode')}
              </th>
            )}
            <th scope="col" className="py-2 pl-4 font-normal">
              {t('columns.date')}
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              <span className="sr-only">{t('columns.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="tabular">
          {entries.map((entry) => (
            <tr key={entry.resultId} className="border-b">
              <td className="py-2 font-semibold">{entry.rank}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <TypeAvatar nickname={entry.nickname} avatar={entry.avatar} size="sm" />
                  <Link
                    href={`/profile/${encodeURIComponent(entry.nickname)}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {entry.nickname}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {t('level', { level: entry.level })}
                  </span>
                </span>
              </td>
              <td className="py-2 text-right font-semibold">{Math.round(entry.wpm)}</td>
              <td className="py-2 text-right">{Math.round(entry.accuracy)}%</td>
              {showMode && <td className="py-2 pl-4">{tModes(entry.mode)}</td>}
              <td className="py-2 pl-4 text-muted-foreground">
                {format.dateTime(new Date(entry.createdAt), { dateStyle: 'medium' })}
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                <Link
                  href={`/replay/${entry.resultId}`}
                  className={actionClass}
                  aria-label={t('replayOf', { nickname: entry.nickname })}
                >
                  {t('replay')}
                </Link>
                <Link
                  href={`/ghost/${entry.resultId}`}
                  className={`${actionClass} ml-3`}
                  aria-label={t('ghostOf', { nickname: entry.nickname })}
                >
                  {t('ghost')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
