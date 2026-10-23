'use client';

import { useQuery } from '@tanstack/react-query';
import { loadWords, targetedWords, weakSpots, type WeakSpots } from '@tecleo/content';
import { createRng } from '@tecleo/engine';
import { profileStatsSchema } from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { fetchApi } from '@/lib/api';
import { readGuestResults } from '@/results/guest-results';
import { useSettings, useSettingsStore } from '@/settings/settings-store';

import { randomSeed } from '../practice/practice-config';
import { SoloRun } from '../solo/solo-run';
import { localWeaknesses } from './local-weaknesses';

const WORDS = 30;

/** Puntos débiles: los de la cuenta (servidor) o los de las pruebas guardadas como invitado. */
function useWeakSpots(): WeakSpots | null {
  const { status, user } = useAuthStore();
  const stats = useQuery({
    queryKey: ['profile-stats', user?.nickname],
    queryFn: () =>
      fetchApi(`/users/${encodeURIComponent(user?.nickname ?? '')}/stats`, profileStatsSchema),
    enabled: status === 'authenticated' && user !== null,
  });
  const [guest, setGuest] = useState<WeakSpots | null>(null);
  useEffect(() => {
    if (status !== 'guest') return;
    queueMicrotask(() => {
      const local = localWeaknesses(readGuestResults());
      setGuest(weakSpots(local.keys, local.bigrams));
    });
  }, [status]);
  if (status === 'guest') return guest;
  return stats.data ? weakSpots(stats.data.keys, stats.data.bigrams) : null;
}

/** Práctica dirigida (spec 5.7): ejercicios con las teclas y pares de letras donde más fallas. */
export function TargetedScreen() {
  const t = useTranslations('targeted');
  const settings = useSettings();
  const spots = useWeakSpots();
  // La semilla se elige en el navegador: un valor al azar no puede salir del prerender.
  const [seed, setSeed] = useState<number | null>(null);
  const [words, setWords] = useState<readonly string[] | null>(null);

  useEffect(() => {
    void Promise.resolve(useSettingsStore.persist.rehydrate()).then(async () => {
      setSeed((current) => current ?? randomSeed());
      setWords(await loadWords(useSettingsStore.getState().settings.textLanguage, 5000));
    });
  }, [settings.textLanguage]);

  const text = useMemo(
    () =>
      spots && words && seed !== null ? targetedWords(words, spots, WORDS, createRng(seed)) : null,
    [spots, words, seed],
  );
  const rules = useMemo(
    () => ({ mode: settings.typingMode, ignoreAccents: settings.ignoreAccents }),
    [settings.typingMode, settings.ignoreAccents],
  );

  if (!spots || !words || seed === null) {
    return (
      <p aria-busy="true" className="text-muted-foreground">
        {t('loading')}
      </p>
    );
  }
  if (!text) {
    return (
      <div className="flex max-w-2xl flex-col items-start gap-4 rounded-lg border border-dashed p-6">
        <p>{t('notEnough')}</p>
        <Button asChild>
          <Link href="/practice">{t('goPractice')}</Link>
        </Button>
      </div>
    );
  }
  const focus = [...spots.bigrams, ...spots.keys];
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="focus-title" className="flex flex-col gap-2" data-chrome>
        <h2 id="focus-title" className="text-sm font-medium">
          {t('focus')}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {focus.map((item) => (
            <li key={item} className="rounded-md border bg-card px-2.5 py-1 font-game text-lg">
              {item}
            </li>
          ))}
        </ul>
      </section>
      <SoloRun
        key={`${String(seed)}-${settings.textLanguage}`}
        text={text}
        preserveLines={false}
        language={settings.textLanguage}
        textId={null}
        rules={rules}
        mode="targeted"
        attribution={t('attribution')}
        nextLabel={t('next')}
        onNext={() => {
          setSeed(randomSeed());
        }}
      />
    </div>
  );
}
