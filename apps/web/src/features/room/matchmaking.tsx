'use client';

import type { RoomState } from '@tecleo/shared';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { serverToLocal } from '@/lib/realtime';

import { useNow } from '../typing/use-now';
import { PlayersList } from './players-list';

/** Carreras públicas: corredores por sala, contando los bots de relleno. */
export const PUBLIC_RUNNERS = 5;

/** Espera del matchmaking: quiénes llegaron y cuánto falta para completar con bots. */
export function Matchmaking({ room, selfId }: { room: RoomState; selfId: string | null }) {
  const t = useTranslations('play');
  const now = useNow(250, true);
  const endsAt = room.waitingEndsAt === null ? null : serverToLocal(room.waitingEndsAt);
  const seconds = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1_000));

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p role="status" className="flex items-center gap-2 font-heading text-2xl font-bold">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          {t('searching')}
        </p>
        {seconds !== null && (
          <p className="tabular text-muted-foreground">{t('startsIn', { seconds })}</p>
        )}
        <p className="text-sm text-muted-foreground">{t('fillHint')}</p>
      </div>
      <PlayersList room={room} selfId={selfId} max={PUBLIC_RUNNERS} showReady={false} />
    </div>
  );
}
