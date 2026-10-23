'use client';

import { useQuery } from '@tanstack/react-query';
import { textLeaderboardSchema } from '@tecleo/shared';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, fetchApi } from '@/lib/api';

import { TextRating } from '../results/text-rating';
import { LeaderboardTable } from './leaderboard-table';

/** Un texto con su ranking (spec 8): la mejor marca de cada persona en ese texto. */
export function TextScreen({ textId }: { textId: string }) {
  const t = useTranslations('textPage');
  const board = useQuery({
    queryKey: ['text-leaderboard', textId],
    queryFn: () =>
      fetchApi(`/texts/${encodeURIComponent(textId)}/leaderboard`, textLeaderboardSchema),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  if (board.isPending)
    return (
      <p aria-busy="true" className="text-muted-foreground">
        {t('loading')}
      </p>
    );
  if (board.isError) {
    const notFound = board.error instanceof ApiError && board.error.status === 404;
    return <p role="alert">{notFound ? t('notFound') : t('loadError')}</p>;
  }
  const { text, entries } = board.data;
  const best = entries[0];
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={t('title')}
        description={
          text.author ? (
            <>
              {text.author}
              {text.source && (
                <>
                  , <cite>{text.source}</cite>
                </>
              )}
            </>
          ) : (
            text.source
          )
        }
      />
      <blockquote
        lang={text.language}
        className="max-w-3xl border-l-4 border-primary/60 pl-4 font-game text-lg leading-relaxed whitespace-pre-wrap select-none"
      >
        {text.content}
      </blockquote>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ThumbsUp aria-hidden="true" className="size-4" />
          {t('likes', { count: text.likes })}
        </span>
        <span className="flex items-center gap-1.5">
          <ThumbsDown aria-hidden="true" className="size-4" />
          {t('dislikes', { count: text.dislikes })}
        </span>
        <TextRating textId={text.id} />
      </div>
      <section aria-labelledby="text-ranking" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="text-ranking" className="font-heading text-xl font-semibold">
            {t('ranking')}
          </h2>
          {best && (
            <Button asChild>
              <Link href={`/ghost/${best.resultId}`}>
                {t('raceBest', { nickname: best.nickname })}
              </Link>
            </Button>
          )}
        </div>
        <LeaderboardTable entries={entries} caption={t('ranking')} showMode />
      </section>
    </div>
  );
}
