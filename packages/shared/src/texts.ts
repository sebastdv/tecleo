import { z } from 'zod';

import { encodedKeystrokesSchema, resultSummarySchema } from './results.js';
import { BOT_LEVELS, LANGUAGES } from './settings.js';

export const textSchema = z.object({
  id: z.string(),
  content: z.string(),
  language: z.enum(LANGUAGES),
  type: z.enum(['quote', 'code']),
  author: z.string().nullable(),
  source: z.string().nullable(),
  length: z.number().int(),
  lengthCategory: z.enum(['short', 'medium', 'long']).nullable(),
  difficulty: z.number().int(),
});
export type TextDto = z.infer<typeof textSchema>;

export const randomTextQuerySchema = z.object({
  language: z.enum(LANGUAGES).default('es'),
  type: z.enum(['quote', 'code']).default('quote'),
  length: z.enum(['short', 'medium', 'long']).optional(),
  /** Para no repetir el texto anterior. */
  exclude: z.string().max(64).optional(),
});

/** Carrera con todo lo necesario para verla de nuevo (repetición) o correr contra ella. */
export const raceDetailSchema = z.object({
  id: z.uuid(),
  mode: resultSummarySchema.shape.mode,
  language: z.enum(LANGUAGES),
  textId: z.string().nullable(),
  content: z.string(),
  preserveLines: z.boolean(),
  timeLimitMs: z.number().int().nullable(),
  rules: z.object({ mode: z.enum(['strict', 'free']), ignoreAccents: z.boolean() }),
  /** Con la semilla y los niveles, los bots se regeneran idénticos en el cliente. */
  seed: z.number().int().nullable(),
  botLevels: z.array(z.enum(BOT_LEVELS)).nullable(),
  createdAt: z.iso.datetime(),
  results: z.array(
    z.object({
      id: z.uuid(),
      nickname: z.string().nullable(),
      botName: z.string().nullable(),
      position: z.number().int().nullable(),
      wpm: z.number(),
      accuracy: z.number(),
      durationMs: z.number().int(),
      completed: z.boolean(),
      keystrokes: encodedKeystrokesSchema.nullable(),
    }),
  ),
});
export type RaceDetail = z.infer<typeof raceDetailSchema>;
