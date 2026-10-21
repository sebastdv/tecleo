'use client';

import { loadQuotes, pickQuote, type LengthCategory, type Quote } from '@tecleo/content';
import {
  analyze,
  applyInput,
  beginCountdown,
  BOT_LEVEL_IDS,
  botProgressAt,
  correctChars,
  createBots,
  createRng,
  createTypingState,
  randomInt,
  rankRunners,
  replayKeystrokes,
  start,
  stateText,
  tick,
  totalChars,
  type BotLevel,
  type BotRun,
  type RaceMetrics,
  type RunnerResult,
  type Standing,
  type TypingAction,
  type TypingState,
} from '@tecleo/engine';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { readFirstStorage } from '@/lib/persist-storage';

import { useSettingsStore } from '@/settings/settings-store';

import { randomSeed } from '../practice/practice-config';

export type RacePhase = 'setup' | 'loading' | 'countdown' | 'racing' | 'finished';
export type BotLevelChoice = BotLevel | 'mixed';

export interface RaceConfig {
  readonly botCount: 1 | 2 | 3 | 4 | 5;
  readonly level: BotLevelChoice;
  readonly length: LengthCategory | 'any';
}

export const BOT_COUNTS = [1, 2, 3, 4, 5] as const;
export const COUNTDOWN_MS = 3_000;
/** Límite de tiempo: el texto completo a 12 ppm, con un mínimo de un minuto. */
const MIN_WPM_FOR_LIMIT = 12;
export const PLAYER_ID = 'player';

/** Resultado de un corredor al cerrar la carrera, para el podio y la tabla. */
export interface RunnerOutcome extends Standing {
  readonly name: string;
  readonly isBot: boolean;
  readonly wpm: number;
  readonly accuracy: number;
}

interface RaceStore {
  readonly config: RaceConfig;
  readonly phase: RacePhase;
  readonly seed: number;
  readonly quote: Quote | null;
  readonly typing: TypingState | null;
  readonly bots: readonly BotRun[];
  /** Instante de la salida (reloj de `performance.now()`). */
  readonly startAt: number | null;
  readonly metrics: RaceMetrics | null;
  readonly outcomes: readonly RunnerOutcome[];
  readonly round: number;
  configure: (patch: Partial<RaceConfig>) => void;
  /** Prepara texto y bots y arranca la cuenta regresiva. Con `rematch` repite texto y bots. */
  prepare: (options?: { seed?: number; rematch?: boolean }) => Promise<void>;
  input: (action: TypingAction, timestamp: number) => void;
  tick: (now: number) => void;
  /** Abandona la carrera y vuelve a la configuración. */
  leave: () => void;
}

function botLevels(config: RaceConfig, seed: number): BotLevel[] {
  const { level } = config;
  if (level !== 'mixed') return Array.from({ length: config.botCount }, () => level);
  const rng = createRng(seed ^ 0x2545f491);
  return Array.from(
    { length: config.botCount },
    () => BOT_LEVEL_IDS[randomInt(rng, 0, BOT_LEVEL_IDS.length - 1)] ?? 'intermediate',
  );
}

function newTyping(quote: Quote): TypingState {
  const { ignoreAccents } = useSettingsStore.getState().settings;
  const template = createTypingState({ text: quote.content, startOn: 'signal' });
  const limitMs = Math.max(60_000, (totalChars(template) / 5 / MIN_WPM_FOR_LIMIT) * 60_000);
  // Las carreras siempre son estrictas (spec 3.2).
  return createTypingState({
    text: quote.content,
    startOn: 'signal',
    timeLimitMs: Math.round(limitMs),
    rules: { mode: 'strict', ignoreAccents },
  });
}

/** Cierra la carrera: posiciones con los tiempos de llegada de todos. */
function outcomes(typing: TypingState, bots: readonly BotRun[]): RunnerOutcome[] {
  const metrics = analyze(typing);
  const completed = correctChars(typing) === totalChars(typing);
  const limit = typing.timeLimitMs ?? Number.POSITIVE_INFINITY;
  const botTemplate = start(
    createTypingState({ text: stateText(typing), startOn: 'signal', rules: { mode: 'strict' } }),
    0,
  );

  const runners: RunnerResult[] = [
    {
      id: PLAYER_ID,
      finishMs: completed ? metrics.durationMs : null,
      progress: correctChars(typing) / totalChars(typing),
    },
    ...bots.map((bot) => ({
      id: bot.profile.id,
      finishMs: bot.finishMs <= limit ? bot.finishMs : null,
      progress: botProgressAt(bot, limit),
    })),
  ];
  // El nombre del jugador lo pone la interfaz ("Tú"), traducido.
  const details = new Map<string, Omit<RunnerOutcome, keyof Standing>>([
    [PLAYER_ID, { name: '', isBot: false, wpm: metrics.wpm, accuracy: metrics.accuracy }],
  ]);
  for (const bot of bots) {
    const botMetrics = analyze(replayKeystrokes(botTemplate, bot.keystrokes));
    details.set(bot.profile.id, {
      name: bot.profile.name,
      isBot: true,
      wpm: botMetrics.wpm,
      accuracy: botMetrics.accuracy,
    });
  }
  return rankRunners(runners).map((standing) => {
    const detail = details.get(standing.id);
    if (!detail) throw new Error(`Corredor desconocido: ${standing.id}`);
    return { ...standing, ...detail };
  });
}

let requestId = 0;

export const useRaceStore = create<RaceStore>()(
  persist(
    (set, get) => ({
      config: { botCount: 3, level: 'intermediate', length: 'any' },
      phase: 'setup',
      seed: 0,
      quote: null,
      typing: null,
      bots: [],
      startAt: null,
      metrics: null,
      outcomes: [],
      round: 0,

      configure: (patch) => {
        set({ config: { ...get().config, ...patch } });
      },

      prepare: async ({ seed: requestedSeed, rematch = false } = {}) => {
        const request = ++requestId;
        const { config, quote: previous, seed: previousSeed } = get();
        const seed = rematch ? previousSeed : (requestedSeed ?? randomSeed());
        set({ phase: 'loading' });
        let quote = previous;
        if (!rematch || !quote) {
          const { textLanguage } = useSettingsStore.getState().settings;
          const quotes = await loadQuotes(textLanguage);
          quote = pickQuote(quotes, createRng(seed), {
            ...(config.length !== 'any' && { lengthCategory: config.length }),
            ...(previous && !requestedSeed && { excludeId: previous.id }),
          });
        }
        if (request !== requestId) return;
        const bots = createBots({ text: quote.content, levels: botLevels(config, seed), seed });
        set({
          phase: 'countdown',
          seed,
          quote,
          bots,
          typing: beginCountdown(newTyping(quote)),
          startAt: performance.now() + COUNTDOWN_MS,
          metrics: null,
          outcomes: [],
          round: get().round + 1,
        });
      },

      input: (action, timestamp) => {
        const { typing, phase } = get();
        if (!typing || phase !== 'racing') return;
        const next = applyInput(typing, action, timestamp);
        if (next !== typing) set({ typing: next });
        if (next.phase === 'finished') get().tick(timestamp);
      },

      tick: (now) => {
        const { phase, typing, startAt, bots } = get();
        if (!typing || startAt === null) return;
        if (phase === 'countdown' && now >= startAt) {
          set({ phase: 'racing', typing: start(typing, startAt) });
          return;
        }
        if (phase !== 'racing') return;
        const current = tick(typing, now);
        if (current.phase !== 'finished') {
          if (current !== typing) set({ typing: current });
          return;
        }
        set({
          phase: 'finished',
          typing: current,
          metrics: analyze(current),
          outcomes: outcomes(current, bots),
        });
      },

      leave: () => {
        requestId++;
        set({ phase: 'setup', typing: null, bots: [], startAt: null, metrics: null, outcomes: [] });
      },
    }),
    {
      name: 'tecleo-race',
      version: 1,
      skipHydration: true,
      storage: readFirstStorage(),
      partialize: (state) => ({ config: state.config }),
      merge: (persisted, current) => {
        const saved = (persisted as { config?: Partial<RaceConfig> } | undefined)?.config;
        const config = { ...current.config, ...saved };
        const valid =
          BOT_COUNTS.includes(config.botCount) &&
          (config.level === 'mixed' || BOT_LEVEL_IDS.includes(config.level));
        return { ...current, config: valid ? config : current.config };
      },
    },
  ),
);
