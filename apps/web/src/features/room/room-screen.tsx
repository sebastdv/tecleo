'use client';

import { botWpmAt, correctChars, liveMetrics, totalChars } from '@tecleo/engine';
import { ROOM_CODE_PATTERN, type RealtimeError, type RoomState } from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { useSettings, useSettingsStore } from '@/settings/settings-store';

import { Confetti } from '../race/confetti';
import { Countdown } from '../race/countdown';
import { Podium } from '../race/podium';
import { interpolatedProgress } from '../race/progress';
import { Track, type TrackLane } from '../race/track';
import { ResultInsights } from '../results/result-insights';
import { ResultsPanel } from '../results/results-panel';
import { TypingArea } from '../typing/typing-area';
import { useFocusMode } from '../typing/use-focus-mode';
import { useNow } from '../typing/use-now';
import { useSoundedInput } from '../typing/use-sounded-input';
import { Lobby } from './lobby';
import { Matchmaking } from './matchmaking';
import { rivalSamples, useRoomStore, type RoomTarget } from './room-store';
import { progressAt, RENDER_DELAY_MS } from './snapshots';

const currentTyping = () => useRoomStore.getState().typing;

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/5 px-4 py-3"
    >
      <p>{children}</p>
      {action}
    </div>
  );
}

function ErrorText({ error }: { error: RealtimeError }) {
  const t = useTranslations('room.errors');
  return <>{t(error.code)}</>;
}

/** Pista en línea: los bots siguen su registro y los rivales se interpolan entre envíos. */
function LiveTrack({ room }: { room: RoomState }) {
  const t = useTranslations('room');
  const { typing, bots, startAt, selfId, liveWpm, arrivals, results } = useRoomStore();
  const racing = startAt !== null && typing !== null && room.phase !== 'waiting';
  const now = useNow(250, racing);
  const elapsed = startAt === null ? 0 : Math.max(0, now - startAt);
  const positions = useMemo(
    () => new Map(results?.standings.map((standing) => [standing.id, standing.position])),
    [results],
  );

  const progressFor = useCallback(
    (id: string, at: number) => {
      const bot = bots.find((candidate) => candidate.profile.id === id);
      if (bot) return startAt === null ? 0 : interpolatedProgress(bot, Math.max(0, at - startAt));
      return progressAt(rivalSamples(id), at - RENDER_DELAY_MS);
    },
    [bots, startAt],
  );

  if (!typing) return null;
  const lanes: TrackLane[] = [
    ...room.players.map((player): TrackLane => {
      if (player.id === selfId) {
        const reference = typing.phase === 'running' ? now : (typing.finishedAt ?? now);
        return {
          id: player.id,
          name: player.name,
          isBot: false,
          self: true,
          progress: correctChars(typing) / Math.max(1, totalChars(typing)),
          wpm: liveMetrics(typing, reference).wpm,
          position: positions.get(player.id) ?? arrivals[player.id],
        };
      }
      return {
        id: player.id,
        name: player.name,
        isBot: false,
        self: false,
        animated: true,
        progress: progressAt(rivalSamples(player.id), now - RENDER_DELAY_MS),
        wpm: liveWpm[player.id] ?? player.wpm,
        position: positions.get(player.id) ?? arrivals[player.id],
        note: player.connected ? undefined : t('disconnected'),
      };
    }),
    ...bots.map((bot): TrackLane => ({
      id: bot.profile.id,
      name: bot.profile.name,
      isBot: true,
      self: false,
      animated: true,
      progress: interpolatedProgress(bot, elapsed),
      wpm: botWpmAt(bot, elapsed),
      position:
        positions.get(bot.profile.id) ??
        (elapsed >= bot.finishMs
          ? 1 + bots.filter((other) => other.finishMs < bot.finishMs).length
          : undefined),
    })),
  ];
  return <Track lanes={lanes} progressAt={progressFor} animating={racing && results === null} />;
}

/** Cuenta regresiva, escritura y pista. */
function LiveRace({ room, onExit }: { room: RoomState; onExit: () => void }) {
  const t = useTranslations('race');
  const tRoom = useTranslations('room');
  const settings = useSettings();
  const { typing, startAt, input, selfId, arrivals } = useRoomStore();
  const onAction = useSoundedInput(input, currentTyping);
  useFocusMode(settings.focusMode && typing?.phase === 'running');

  // Esc sale de la carrera (spec 9.5).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onExit();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onExit]);

  if (!typing) return null;
  const arrived = selfId === null ? undefined : arrivals[selfId];

  return (
    <div className="flex flex-col gap-10">
      <LiveTrack room={room} />
      {typing.phase === 'finished' ? (
        <p role="status" className="font-heading text-2xl font-bold">
          {arrived === undefined
            ? tRoom('waitingResults')
            : tRoom('arrived', { position: arrived })}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="relative">
            <TypingArea
              key={`typing-${room.race?.id ?? ''}`}
              state={typing}
              onAction={onAction}
              caretStyle={settings.caretStyle}
            />
            {startAt !== null && (
              <Countdown key={`countdown-${room.race?.id ?? ''}`} startAt={startAt} />
            )}
          </div>
          <div data-chrome className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {room.race?.author && (
                <>
                  {room.race.author}
                  {room.race.source && (
                    <>
                      , <cite>{room.race.source}</cite>
                    </>
                  )}
                </>
              )}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="pointer-coarse:hidden">{t('leaveShortcut')}</span>
              <Button variant="ghost" size="sm" onClick={onExit}>
                {t('leave')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Dónde quedó el resultado en línea: en el perfil con cuenta; sin cuenta no se guarda. */
function SaveNote({ saved }: { saved: boolean }) {
  const t = useTranslations('room');
  const tSave = useTranslations('saveStatus');
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  if (authenticated)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {saved ? tSave('saved') : tSave('error')}
      </p>
    );
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {t.rich('guestNotSaved', {
        register: (chunks) => (
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

function RoomResults({
  room,
  onAgain,
  onExit,
}: {
  room: RoomState;
  onAgain: () => void;
  onExit: () => void;
}) {
  const t = useTranslations('race');
  const tRoom = useTranslations('room');
  const tPlay = useTranslations('play');
  const { results, metrics, selfId } = useRoomStore();
  if (!results) {
    return (
      <p role="status" className="font-heading text-2xl font-bold">
        {tRoom('waitingResults')}
      </p>
    );
  }
  const self = results.standings.find((standing) => standing.id === selfId);
  const isPrivate = room.mode === 'private';

  return (
    <div className="flex flex-col gap-10">
      {self?.position === 1 && self.finishMs !== null && !self.flagged && <Confetti />}
      <div className="flex flex-col gap-2">
        <p role="status" className="font-heading text-2xl font-bold">
          {self?.finishMs == null
            ? tRoom('dnf')
            : t('yourPlace', { position: self.position, total: results.standings.length })}
        </p>
        {self?.flagged && <p className="text-muted-foreground">{tRoom('flagged')}</p>}
      </div>
      <Podium outcomes={results.standings} selfId={selfId ?? ''} />
      {metrics ? (
        <ResultsPanel
          metrics={metrics}
          attribution={
            room.race?.author && (
              <>
                {room.race.author}
                {room.race.source && (
                  <>
                    , <cite>{room.race.source}</cite>
                  </>
                )}
              </>
            )
          }
          ignoreAccents={false}
          saveNote={
            <>
              <SaveNote saved={results.savedResultId !== null} />
              <ResultInsights
                resultId={results.savedResultId}
                progress={results.progress}
                wpm={metrics.wpm}
                textId={room.race?.textId ?? null}
              />
            </>
          }
          nextLabel={isPrivate ? t('rematch') : tPlay('another')}
          repeatLabel={tRoom('leave')}
          onNext={onAgain}
          onRepeat={onExit}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={onAgain}>{isPrivate ? t('rematch') : tPlay('another')}</Button>
          <Button variant="outline" onClick={onExit}>
            {tRoom('leave')}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Sala en línea (privada o pública). Se une al montar y sale al desmontar; recargar la página
 * vuelve a la misma carrera (el servidor guarda el lugar ~30 s y lo escrito vive en la pestaña).
 */
export function RoomScreen({ target }: { target: RoomTarget }) {
  const t = useTranslations('room');
  const router = useRouter();
  const authStatus = useAuthStore((state) => state.status);
  const { connection, error, selfId, enter, leave, tick, rematch, dismissError } = useRoomStore();
  const code = target.mode === 'private' ? target.code : null;
  // Un código mal formado no puede existir: ni se intenta conectar.
  const invalidCode = code !== null && !ROOM_CODE_PATTERN.test(code);
  const language = target.mode === 'public' ? target.language : null;
  // El store es uno solo: mientras se entra a otra sala, no se muestra la anterior.
  const room = useRoomStore((state) =>
    state.room &&
    !invalidCode &&
    (code === null ? state.room.mode === 'public' : state.room.code === code)
      ? state.room
      : null,
  );

  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    // Hasta saber si hay sesión no se conecta: entraría como invitado.
    if (authStatus === 'unknown' || invalidCode) return;
    void enter(
      code !== null ? { mode: 'private', code } : { mode: 'public', language: language ?? 'es' },
    );
    return () => {
      leave();
    };
  }, [authStatus, invalidCode, code, language, enter, leave]);

  // Reloj local: salida y límite de tiempo.
  const live = room?.phase === 'countdown' || room?.phase === 'racing';
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      tick(performance.now());
    }, 50);
    return () => {
      clearInterval(id);
    };
  }, [live, tick]);

  const exitHref = target.mode === 'private' ? '/room' : '/race';
  const onExit = useCallback(() => {
    router.push(exitHref);
  }, [router, exitHref]);
  const onAgain = useCallback(() => {
    // Revancha en la misma sala privada; en las públicas, a buscar otra (el servidor saca de la
    // terminada al entrar a la nueva).
    if (target.mode === 'private') void rematch();
    else void enter(target);
  }, [target, rematch, enter]);

  if (!room) {
    if (error || invalidCode) {
      return (
        <Notice
          action={
            <Button asChild variant="outline">
              <Link href={exitHref}>{t('back')}</Link>
            </Button>
          }
        >
          <ErrorText error={error ?? { code: 'ROOM_NOT_FOUND', message: '' }} />
        </Notice>
      );
    }
    return (
      <p role="status" className="text-muted-foreground">
        {connection === 'failed' ? t('connectionFailed') : t('connecting')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {connection === 'reconnecting' && (
        <p role="status" className="rounded-lg border px-4 py-3 text-sm">
          {t('reconnecting')}
        </p>
      )}
      {error && (
        <Notice
          action={
            <Button variant="ghost" size="sm" onClick={dismissError}>
              {t('dismiss')}
            </Button>
          }
        >
          <ErrorText error={error} />
        </Notice>
      )}
      {room.phase === 'waiting' &&
        (room.mode === 'private' ? (
          <Lobby room={room} selfId={selfId} />
        ) : (
          <Matchmaking room={room} selfId={selfId} />
        ))}
      {(room.phase === 'countdown' || room.phase === 'racing') && (
        <LiveRace room={room} onExit={onExit} />
      )}
      {room.phase === 'finished' && <RoomResults room={room} onAgain={onAgain} onExit={onExit} />}
    </div>
  );
}
