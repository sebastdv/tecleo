'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ratingStateSchema, type RatingState } from '@tecleo/shared';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/auth/auth-store';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { fetchApi } from '@/lib/api';

/** 👍/👎 al texto recién escrito (spec 4). Con cuenta; sin ella, invita a entrar. */
export function TextRating({ textId }: { textId: string }) {
  const t = useTranslations('insights');
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  const client = useQueryClient();
  const key = ['rating', textId];
  const path = `/texts/${encodeURIComponent(textId)}/rating`;
  const rating = useQuery({
    queryKey: key,
    queryFn: () => fetchApi(path, ratingStateSchema, { auth: true }),
    enabled: authenticated,
  });
  const rate = useMutation({
    mutationFn: (value: RatingState['value']) =>
      fetchApi(path, ratingStateSchema, { method: 'PUT', body: { value }, auth: true }),
    onSuccess: (state) => {
      client.setQueryData(key, state);
    },
  });

  if (!authenticated) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.rich('rateSignIn', {
          login: (chunks) => (
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    );
  }
  const value = rate.data?.value ?? rating.data?.value ?? 0;
  const toggle = (next: 1 | -1) => {
    rate.mutate(value === next ? 0 : next);
  };
  return (
    <div role="group" aria-label={t('rateLabel')} className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('rateLabel')}</span>
      <Button
        variant={value === 1 ? 'default' : 'outline'}
        size="sm"
        aria-pressed={value === 1}
        disabled={rating.isPending || rate.isPending}
        onClick={() => {
          toggle(1);
        }}
      >
        <ThumbsUp aria-hidden="true" />
        {t('like')}
      </Button>
      <Button
        variant={value === -1 ? 'default' : 'outline'}
        size="sm"
        aria-pressed={value === -1}
        disabled={rating.isPending || rate.isPending}
        onClick={() => {
          toggle(-1);
        }}
      >
        <ThumbsDown aria-hidden="true" />
        {t('dislike')}
      </Button>
    </div>
  );
}
