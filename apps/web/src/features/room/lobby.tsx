'use client';

import type { RoomState } from '@tecleo/shared';
import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PlayersList } from './players-list';
import { RoomConfigForm } from './room-config-form';
import { useRoomStore } from './room-store';

/** Código grande y enlace para compartir la sala. */
function ShareRoom({ code }: { code: string }) {
  const t = useTranslations('room');
  const [copied, setCopied] = useState(false);
  return (
    <section
      aria-labelledby="share-title"
      className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="share-title" className="text-sm text-muted-foreground">
          {t('code')}
        </h2>
        <p className="font-game text-4xl font-semibold tracking-[0.2em]" data-room-code>
          {code}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}`;
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
            });
          }}
        >
          <Copy aria-hidden="true" />
          {t('copyLink')}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">
          {copied && t('linkCopied')}
        </span>
      </div>
    </section>
  );
}

/** Sala privada antes de la carrera: compartir, jugadores, configuración y "listo". */
export function Lobby({ room, selfId }: { room: RoomState; selfId: string | null }) {
  const t = useTranslations('room');
  const { setReady, updateConfig, startNow } = useRoomStore();
  const self = room.players.find((player) => player.id === selfId);
  const isHost = room.hostId !== null && room.hostId === selfId;

  return (
    <div className="flex flex-col gap-10">
      <ShareRoom code={room.code} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <PlayersList room={room} selfId={selfId} max={room.config.maxPlayers} showReady />
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                aria-pressed={self?.ready ?? false}
                variant={self?.ready ? 'outline' : 'default'}
                onClick={() => {
                  void setReady(!(self?.ready ?? false));
                }}
              >
                {self?.ready ? t('cancelReady') : t('imReady')}
              </Button>
              {isHost && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    void startNow();
                  }}
                >
                  {t('startNow')}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t('readyHint')}</p>
          </div>
        </div>
        <RoomConfigForm
          config={room.config}
          editable={isHost}
          minPlayers={Math.max(2, room.players.length)}
          onChange={(config) => {
            void updateConfig(config);
          }}
        />
      </div>
    </div>
  );
}
