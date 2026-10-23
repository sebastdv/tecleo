import { z } from 'zod';

import { publicUserSchema } from './auth.js';
import { unlockedAchievementSchema } from './progression.js';
import { resultSummarySchema } from './results.js';
import { LANGUAGES } from './settings.js';

export const profileSchema = publicUserSchema.extend({
  stats: z.object({
    races: z.number().int(),
    /** Promedio de las últimas 10 pruebas completas. */
    averageWpm: z.number(),
    bestWpm: z.number(),
    averageAccuracy: z.number(),
    /** Carreras con rivales (bots o personas) ganadas, y su porcentaje. */
    wins: z.number().int(),
    winRate: z.number(),
  }),
  achievements: z.array(unlockedAchievementSchema),
});
export type Profile = z.infer<typeof profileSchema>;

const charStatSchema = z.object({
  key: z.string(),
  attempts: z.number().int(),
  errors: z.number().int(),
});
export type CharStatEntry = z.infer<typeof charStatSchema>;

export const profileStatsSchema = z.object({
  /** Evolución del ppm (de la más antigua a la más reciente). */
  history: z.array(
    z.object({
      createdAt: z.iso.datetime(),
      wpm: z.number(),
      accuracy: z.number(),
      mode: resultSummarySchema.shape.mode,
    }),
  ),
  bestByMode: z.array(
    z.object({ mode: resultSummarySchema.shape.mode, wpm: z.number(), resultId: z.uuid() }),
  ),
  keys: z.array(charStatSchema),
  /** Pares de letras con más errores (con un mínimo de intentos). */
  bigrams: z.array(charStatSchema),
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;

export const racesQuerySchema = z.object({
  mode: resultSummarySchema.shape.mode.optional(),
  language: z.enum(LANGUAGES).optional(),
  /** Cursor opaco devuelto por la página anterior. */
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type RacesQuery = z.input<typeof racesQuerySchema>;

export const racesPageSchema = z.object({
  items: z.array(resultSummarySchema),
  nextCursor: z.uuid().nullable(),
});
export type RacesPage = z.infer<typeof racesPageSchema>;
