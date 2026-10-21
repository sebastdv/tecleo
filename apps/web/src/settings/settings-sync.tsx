'use client';

import { storedSettingsSchema, userSettingsSchema } from '@tecleo/shared';
import { useEffect } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { fetchApi } from '@/lib/api';

import { useSettingsStore } from './settings-store';

const SAVE_DELAY_MS = 800;

/**
 * Con sesión, las preferencias viven en el servidor: al entrar, las de la cuenta reemplazan a
 * las locales (o, si la cuenta no tiene, se suben las locales); después, cada cambio se guarda.
 */
export function SettingsSync() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const run = { cancelled: false };
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const push = (settings = useSettingsStore.getState().settings) =>
      fetchApi('/me/settings', userSettingsSchema, { method: 'PUT', body: settings, auth: true });

    void (async () => {
      await useSettingsStore.persist.rehydrate();
      try {
        const { settings } = await fetchApi('/me/settings', storedSettingsSchema, { auth: true });
        if (run.cancelled) return;
        if (settings) useSettingsStore.getState().update(settings);
        else await push();
      } catch {
        // Sin conexión: se siguen usando las locales y se reintenta en el próximo cambio.
      }
      ready = true;
    })();

    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (!ready || state.settings === previous.settings) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void push(state.settings).catch(() => undefined);
      }, SAVE_DELAY_MS);
    });
    return () => {
      run.cancelled = true;
      unsubscribe();
      clearTimeout(timer);
    };
  }, [status]);

  return null;
}
