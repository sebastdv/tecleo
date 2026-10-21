'use client';

import { DEFAULT_SETTINGS, parseSettings, type UserSettings } from '@tecleo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SETTINGS_STORAGE_KEY } from './storage-key';

interface SettingsStore {
  readonly settings: UserSettings;
  update: (patch: Partial<UserSettings>) => void;
  reset: () => void;
}

/**
 * Preferencias del invitado, guardadas en este navegador. Con sesión (Fase 4) se sincronizan
 * con `/me/settings`; el esquema es el mismo (`@tecleo/shared`).
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      update: (patch) => {
        set({ settings: parseSettings({ ...get().settings, ...patch }) });
      },
      reset: () => {
        set({ settings: DEFAULT_SETTINGS });
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      // Se rehidrata en el cliente tras montar (SettingsEffects) para no romper la hidratación.
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      // Lo guardado puede venir de otra versión o estar corrupto: se valida campo por campo.
      merge: (persisted, current) => ({
        ...current,
        settings: parseSettings((persisted as { settings?: unknown } | undefined)?.settings),
      }),
    },
  ),
);

export function useSettings(): UserSettings {
  return useSettingsStore((state) => state.settings);
}
