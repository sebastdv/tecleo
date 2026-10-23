import { z } from 'zod';

import type { AvatarId } from './auth.js';

/**
 * Progresión (spec 8): XP por carrera, niveles, logros y desbloqueos cosméticos. Funciones
 * puras: el servidor las aplica al guardar y la web las usa para mostrar lo que falta.
 */

// ── XP y niveles ──────────────────────────────────────────────────────────────────────────

export interface RaceXpInput {
  readonly wpm: number;
  /** 0–100. */
  readonly accuracy: number;
  /** Caracteres escritos bien: una prueba larga vale más que una corta. */
  readonly correctChars: number;
  readonly completed: boolean;
  /** Puesto entre `runners` corredores; `null` si fue práctica solo. */
  readonly position: number | null;
  readonly runners: number;
  readonly flagged: boolean;
}

export const MAX_RACE_XP = 500;

/**
 * XP de una prueba: caracteres bien escritos ponderados por velocidad y (mucho) por
 * precisión, más un bono por los rivales que quedaron detrás. Lo marcado no suma.
 */
export function raceXp(input: RaceXpInput): number {
  if (input.flagged || input.correctChars <= 0) return 0;
  const speed = Math.min(input.wpm, 200) / 60;
  const precision = (Math.max(0, Math.min(100, input.accuracy)) / 100) ** 2;
  let xp = (input.correctChars / 10) * speed * precision;
  if (!input.completed) xp *= 0.5;
  if (input.runners > 1 && input.position !== null) {
    xp += (input.runners - input.position) * 4 + (input.position === 1 ? 10 : 0);
  }
  return Math.min(MAX_RACE_XP, Math.max(0, Math.round(xp)));
}

/** XP total para llegar a `level` (el nivel 1 es el de partida): 0, 100, 300, 600, 1000… */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 50 * n * (n - 1);
}

export function levelFromXp(total: number): number {
  const xp = Math.max(0, total);
  const level = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
  // Corrige el redondeo de la raíz en los bordes exactos.
  if (xpForLevel(level + 1) <= xp) return level + 1;
  if (xpForLevel(level) > xp) return level - 1;
  return level;
}

/** Cuánto lleva dentro del nivel actual y cuánto necesita para el siguiente. */
export function levelProgress(xp: number): { level: number; current: number; needed: number } {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  return { level, current: xp - base, needed: xpForLevel(level + 1) - base };
}

// ── Logros ────────────────────────────────────────────────────────────────────────────────

/** Lo que el servidor cuenta de una persona para decidir sus logros (solo pruebas limpias). */
export interface AchievementStats {
  readonly races: number;
  readonly wins: number;
  readonly bestWpm: number;
  /** Pruebas completas con 100 % de precisión y al menos 15 s. */
  readonly perfect: number;
  /** Carreras públicas o privadas terminadas. */
  readonly online: number;
  readonly daily: number;
  readonly ghostWins: number;
  readonly level: number;
}

type Rule = readonly [keyof AchievementStats, number];

/** Catálogo de logros; nombre y descripción viven en los mensajes de la web. */
export const ACHIEVEMENT_RULES = {
  'first-race': ['races', 1],
  'races-10': ['races', 10],
  'races-100': ['races', 100],
  'races-500': ['races', 500],
  'wpm-60': ['bestWpm', 60],
  'wpm-80': ['bestWpm', 80],
  'wpm-100': ['bestWpm', 100],
  'wpm-120': ['bestWpm', 120],
  perfect: ['perfect', 1],
  'first-win': ['wins', 1],
  'wins-25': ['wins', 25],
  'online-first': ['online', 1],
  'daily-first': ['daily', 1],
  'daily-7': ['daily', 7],
  'ghost-first': ['ghostWins', 1],
  'level-5': ['level', 5],
  'level-10': ['level', 10],
} as const satisfies Record<string, Rule>;

export type AchievementId = keyof typeof ACHIEVEMENT_RULES;
export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENT_RULES) as AchievementId[];
export const achievementIdSchema = z.enum(ACHIEVEMENT_IDS as [AchievementId, ...AchievementId[]]);

/** Logros que cumplen estas estadísticas (todos, no solo los nuevos). */
export function earnedAchievements(stats: AchievementStats): AchievementId[] {
  return ACHIEVEMENT_IDS.filter((id) => {
    const [stat, threshold] = ACHIEVEMENT_RULES[id];
    return stats[stat] >= threshold;
  });
}

// ── Desbloqueos cosméticos ────────────────────────────────────────────────────────────────

export type Unlock =
  | { readonly kind: 'free' }
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'achievement'; readonly achievement: AchievementId };

/** Cómo se consigue cada avatar. */
export const AVATAR_UNLOCKS: Readonly<Record<AvatarId, Unlock>> = {
  brass: { kind: 'free' },
  ink: { kind: 'free' },
  graphite: { kind: 'free' },
  forest: { kind: 'level', level: 3 },
  plum: { kind: 'level', level: 6 },
  ribbon: { kind: 'achievement', achievement: 'wpm-80' },
};

export function isUnlocked(
  unlock: Unlock,
  level: number,
  achievements: readonly AchievementId[],
): boolean {
  switch (unlock.kind) {
    case 'free':
      return true;
    case 'level':
      return level >= unlock.level;
    case 'achievement':
      return achievements.includes(unlock.achievement);
  }
}

// ── Contratos ─────────────────────────────────────────────────────────────────────────────

export const unlockedAchievementSchema = z.object({
  id: achievementIdSchema,
  unlockedAt: z.iso.datetime(),
});
export type UnlockedAchievement = z.infer<typeof unlockedAchievementSchema>;

/** Lo que cambió en la cuenta con un resultado nuevo (para la pantalla de resultados). */
export const progressUpdateSchema = z.object({
  xpGained: z.number().int(),
  xp: z.number().int(),
  level: z.number().int(),
  leveledUp: z.boolean(),
  achievements: z.array(achievementIdSchema),
  /** Antes de esta prueba: promedio de las últimas 10, mejor marca y récord en este texto. */
  previousAverageWpm: z.number().nullable(),
  previousBestWpm: z.number().nullable(),
  previousTextBestWpm: z.number().nullable(),
});
export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;
