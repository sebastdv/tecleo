'use client';

import {
  analyze,
  appendText,
  applyInput,
  createTypingState,
  tick,
  type RaceMetrics,
  type TypingAction,
  type TypingState,
} from '@tecleo/engine';
import type { UserSettings } from '@tecleo/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { readFirstStorage } from '@/lib/persist-storage';

import { useSettingsStore } from '@/settings/settings-store';

import {
  buildPracticeText,
  DEFAULT_CONFIG,
  DURATIONS,
  randomSeed,
  TIME_MODE_REFILL_THRESHOLD,
  TIME_MODE_REFILL_WORDS,
  WORD_COUNTS,
  type PracticeConfig,
  type PracticeText,
} from './practice-config';

type Status = 'loading' | 'ready' | 'error';

interface PracticeStore {
  readonly config: PracticeConfig;
  readonly status: Status;
  readonly seed: number;
  readonly source: PracticeText | null;
  readonly typing: TypingState | null;
  readonly metrics: RaceMetrics | null;
  /** Aumenta con cada texto nuevo o repetición; la UI lo usa para reiniciar el área de escritura. */
  readonly round: number;
  /** Cambia la configuración y prepara un texto nuevo. */
  configure: (patch: Partial<PracticeConfig>) => Promise<void>;
  /** Texto nuevo; con `seed` explícita se puede reproducir (enlaces y tests). */
  next: (seed?: number) => Promise<void>;
  /** Mismo texto desde cero. */
  repeat: () => void;
  input: (action: TypingAction, timestamp: number) => void;
  tick: (now: number) => void;
}

type TypingPreferences = Pick<UserSettings, 'textLanguage' | 'typingMode' | 'ignoreAccents'>;

function preferences(): TypingPreferences {
  const { textLanguage, typingMode, ignoreAccents } = useSettingsStore.getState().settings;
  return { textLanguage, typingMode, ignoreAccents };
}

function freshState(config: PracticeConfig, source: PracticeText): TypingState {
  const { typingMode, ignoreAccents } = preferences();
  return createTypingState({
    text: source.text,
    preserveLines: source.preserveLines,
    timeLimitMs: config.mode === 'time' ? config.durationSeconds * 1_000 : null,
    rules: { mode: typingMode, ignoreAccents },
  });
}

function withMetrics(typing: TypingState) {
  return { typing, metrics: typing.phase === 'finished' ? analyze(typing) : null };
}

/** Valida la configuración guardada: un valor que ya no existe vuelve al de por defecto. */
function sanitize(saved: Partial<PracticeConfig> | undefined): PracticeConfig {
  const config = { ...DEFAULT_CONFIG, ...saved };
  return {
    ...config,
    durationSeconds: DURATIONS.includes(config.durationSeconds)
      ? config.durationSeconds
      : DEFAULT_CONFIG.durationSeconds,
    wordCount: WORD_COUNTS.includes(config.wordCount) ? config.wordCount : DEFAULT_CONFIG.wordCount,
  };
}

/** Peticiones en vuelo: si el usuario cambia de opción rápido, solo vale la última. */
let requestId = 0;

export const usePracticeStore = create<PracticeStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      status: 'loading',
      seed: 0,
      source: null,
      typing: null,
      metrics: null,
      round: 0,

      // Conserva la semilla: con `?seed=` el texto sigue siendo reproducible al cambiar opciones.
      configure: async (patch) => {
        set({ config: { ...get().config, ...patch } });
        await get().next(get().seed);
      },

      next: async (seed = randomSeed()) => {
        const request = ++requestId;
        const { config, source } = get();
        const previousId = source?.quote?.id ?? source?.snippet?.id;
        set({ status: 'loading' });
        try {
          const built = await buildPracticeText(
            config,
            preferences().textLanguage,
            seed,
            previousId,
          );
          if (request !== requestId) return;
          set({
            status: 'ready',
            seed,
            source: built,
            typing: freshState(config, built),
            metrics: null,
            round: get().round + 1,
          });
        } catch (error) {
          if (request !== requestId) return;
          console.error(error);
          set({ status: 'error' });
        }
      },

      repeat: () => {
        const { config, source } = get();
        if (!source) return;
        set({ typing: freshState(config, source), metrics: null, round: get().round + 1 });
      },

      input: (action, timestamp) => {
        const { typing, source } = get();
        if (!typing) return;
        let next = applyInput(typing, action, timestamp);
        if (next === typing) return;
        if (
          source?.more &&
          next.phase === 'running' &&
          next.words.length - next.wordIndex < TIME_MODE_REFILL_THRESHOLD
        ) {
          next = appendText(next, source.more(TIME_MODE_REFILL_WORDS));
        }
        set(withMetrics(next));
      },

      tick: (now) => {
        const { typing } = get();
        if (!typing) return;
        const next = tick(typing, now);
        if (next !== typing) set(withMetrics(next));
      },
    }),
    {
      name: 'tecleo-practice',
      version: 1,
      // Se rehidrata en el cliente tras montar (PracticeScreen) para no romper la hidratación de React.
      skipHydration: true,
      storage: readFirstStorage(),
      // Solo las opciones: el texto en curso no se guarda.
      partialize: (state) => ({ config: state.config }),
      merge: (persisted, current) => ({
        ...current,
        config: sanitize((persisted as { config?: Partial<PracticeConfig> } | undefined)?.config),
      }),
    },
  ),
);
