'use client';

import { DEFAULT_ROOM_CONFIG, roomCodeSchema, type RealtimeError } from '@tecleo/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePathname } from '@/i18n/navigation';
import { connectRealtime, readGuest, setGuestName } from '@/lib/realtime';
import { useSettingsStore } from '@/settings/settings-store';

import { createRoom } from './room-store';
import { RoomScreen } from './room-screen';

/** Nombre con el que un invitado aparece en las salas (se guarda en este navegador). */
function GuestNameField() {
  const t = useTranslations('room');
  const id = useId();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      setName(readGuest().name);
    });
  }, []);
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor={id}>{t('guestName')}</Label>
      <Input
        id={id}
        maxLength={20}
        autoComplete="nickname"
        value={name ?? ''}
        disabled={name === null}
        onChange={(event) => {
          setName(event.target.value);
          setGuestName(event.target.value.trim());
        }}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t('guestNameHint')}
      </p>
    </div>
  );
}

/**
 * Crear una sala privada o entrar a una con su código. La sala se muestra aquí mismo y la URL
 * pasa a `/room/CÓDIGO` con `history.pushState`: sin pedir otra página al servidor, entrar es
 * casi inmediato. Recargar esa URL abre la página de la sala como siempre.
 */
export function RoomEntry() {
  const t = useTranslations('room');
  const pathname = usePathname();
  const code = /^\/room\/([^/]+)$/.exec(pathname)?.[1]?.toUpperCase();
  // `pushState` no cambia el título como lo haría una página nueva.
  const title = code ? t('title', { code }) : t('entryTitle');
  useEffect(() => {
    document.title = `${title} · Tecleo`;
  }, [title]);
  if (code) {
    return (
      <>
        <div data-chrome>
          <PageHeader title={t('title', { code })} description={t('description')} />
        </div>
        <RoomScreen target={{ mode: 'private', code }} />
      </>
    );
  }
  return (
    <>
      <div data-chrome>
        <PageHeader title={t('entryTitle')} description={t('entryDescription')} />
      </div>
      <EntryForms />
    </>
  );
}

function EntryForms() {
  const t = useTranslations('room');
  const tErrors = useTranslations('room.errors');
  const locale = useLocale();
  const codeId = useId();
  const authStatus = useAuthStore((state) => state.status);
  const guest = authStatus === 'guest';
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<RealtimeError | 'offline' | null>(null);
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);

  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);

  // La conexión (y la medición del reloj) se prepara mientras se lee la página: crear o entrar
  // a una sala no tiene que esperarla.
  useEffect(() => {
    if (authStatus !== 'unknown') void connectRealtime().catch(() => undefined);
  }, [authStatus]);

  const openRoom = (roomCode: string) => {
    window.history.pushState(null, '', `/${locale}/room/${roomCode}`);
  };

  const onCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const { textLanguage } = useSettingsStore.getState().settings;
      const result = await createRoom({ ...DEFAULT_ROOM_CONFIG, language: textLanguage });
      if (typeof result === 'string') openRoom(result);
      else setCreateError(result);
    } catch {
      setCreateError('offline');
    } finally {
      setCreating(false);
    }
  };

  const onJoin = (event: { preventDefault(): void }) => {
    event.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    setCodeInvalid(!parsed.success);
    if (parsed.success) openRoom(parsed.data);
  };

  return (
    <div className="flex flex-col gap-10">
      {guest && <GuestNameField />}
      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="create-title"
          className="flex flex-col items-start gap-4 rounded-lg border bg-card p-6"
        >
          <h2 id="create-title" className="font-heading text-xl font-semibold">
            {t('createTitle')}
          </h2>
          <p className="text-muted-foreground">{t('createHint')}</p>
          <Button
            size="lg"
            disabled={creating}
            onClick={() => {
              void onCreate();
            }}
          >
            {creating ? t('creating') : t('create')}
          </Button>
          {createError && (
            <p role="alert" className="text-sm text-error">
              {createError === 'offline' ? t('connectionFailed') : tErrors(createError.code)}
            </p>
          )}
        </section>

        <section
          aria-labelledby="join-title"
          className="flex flex-col gap-4 rounded-lg border bg-card p-6"
        >
          <h2 id="join-title" className="font-heading text-xl font-semibold">
            {t('joinTitle')}
          </h2>
          <form onSubmit={onJoin} className="flex flex-col gap-2" noValidate>
            <Label htmlFor={codeId}>{t('codeLabel')}</Label>
            <div className="flex gap-3">
              <Input
                id={codeId}
                value={code}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-40 font-game text-lg tracking-[0.2em] uppercase"
                aria-invalid={codeInvalid || undefined}
                aria-describedby={`${codeId}-hint`}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeInvalid(false);
                }}
              />
              <Button type="submit" variant="outline">
                {t('join')}
              </Button>
            </div>
            <p
              id={`${codeId}-hint`}
              className={codeInvalid ? 'text-sm text-error' : 'text-sm text-muted-foreground'}
            >
              {codeInvalid ? t('codeInvalid') : t('codeHint')}
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
