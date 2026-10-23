import { z } from 'zod';

import { AVATARS } from './auth.js';
import { resultSummarySchema } from './results.js';
import { LANGUAGES } from './settings.js';
import { textSchema } from './texts.js';

/** Rankings (spec 8): solo resultados validados, completos, sin marcar y sin «ignorar tildes». */
export const LEADERBOARD_PERIODS = ['day', 'week', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const leaderboardQuerySchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS).default('week'),
  language: z.enum(LANGUAGES).default('es'),
  /** Un modo concreto o todos. */
  mode: z.enum(['all', ...resultSummarySchema.shape.mode.options]).default('all'),
});
export type LeaderboardQuery = z.input<typeof leaderboardQuerySchema>;

/** La mejor marca de cada persona en el ranking. */
export const leaderboardEntrySchema = z.object({
  rank: z.number().int(),
  nickname: z.string(),
  avatar: z.enum(AVATARS).nullable(),
  level: z.number().int(),
  wpm: z.number(),
  accuracy: z.number(),
  mode: resultSummarySchema.shape.mode,
  resultId: z.uuid(),
  raceId: z.uuid(),
  createdAt: z.iso.datetime(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const LEADERBOARD_SIZE = 50;

export const leaderboardSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

export const textLeaderboardSchema = z.object({
  text: textSchema.extend({ likes: z.number().int(), dislikes: z.number().int() }),
  entries: z.array(leaderboardEntrySchema),
});
export type TextLeaderboard = z.infer<typeof textLeaderboardSchema>;

// ── Desafío diario ────────────────────────────────────────────────────────────────────────

export const dailyQuerySchema = z.object({ language: z.enum(LANGUAGES).default('es') });

export const dailySchema = z.object({
  /** Día UTC del desafío (AAAA-MM-DD). */
  date: z.iso.date(),
  text: textSchema,
  entries: z.array(leaderboardEntrySchema),
});
export type Daily = z.infer<typeof dailySchema>;

// ── Calificar textos ──────────────────────────────────────────────────────────────────────

export const ratingSchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});
export type RatingInput = z.infer<typeof ratingSchema>;

export const ratingStateSchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  likes: z.number().int(),
  dislikes: z.number().int(),
});
export type RatingState = z.infer<typeof ratingStateSchema>;
