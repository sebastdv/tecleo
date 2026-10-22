'use client';

import type { RoomState } from '@tecleo/shared';
import { Check, Crown, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { TypeAvatar } from '@/components/type-avatar';
import { cn } from '@/lib/utils';

/** Quiénes están en la sala, con anfitrión, si están listos y si siguen conectados. */
export function PlayersList({
  room,
  selfId,
  max,
  showReady,
}: {
  room: RoomState;
  selfId: string | null;
  max: number;
  showReady: boolean;
}) {
  const t = useTranslations('room');
  return (
    <section aria-labelledby="players-title" className="flex flex-col gap-3">
      <h2 id="players-title" className="font-heading text-lg font-semibold">
        {t('players', { count: room.players.length, max })}
      </h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {room.players.map((player) => (
          <li key={player.id} className="flex items-center gap-3 px-4 py-3">
            <TypeAvatar nickname={player.name} avatar={player.avatar} size="sm" />
            <span className={cn('min-w-0 truncate', player.id === selfId && 'font-semibold')}>
              {player.name}
              {player.id === selfId && (
                <span className="font-normal text-muted-foreground"> ({t('you')})</span>
              )}
            </span>
            {player.id === room.hostId && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Crown aria-hidden="true" className="size-3.5 text-primary" />
                {t('host')}
              </span>
            )}
            <span className="ml-auto flex items-center gap-3 text-sm">
              {!player.connected && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <WifiOff aria-hidden="true" className="size-4" />
                  {t('disconnected')}
                </span>
              )}
              {showReady &&
                (player.ready ? (
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    <Check aria-hidden="true" className="size-4" />
                    {t('ready')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('notReady')}</span>
                ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
