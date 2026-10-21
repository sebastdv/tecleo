import { z } from 'zod';

import { BOT_LEVELS, LANGUAGES } from './settings.js';

/** Máximo de pulsaciones que se aceptan en un resultado (unos 10 minutos a 200 ppm). */
export const MAX_KEYSTROKES = 20_000;

/**
 * Pulsaciones en formato compacto: tiempo desde la anterior y el carácter de cada una
 * (`\b` = borrar, `\u0017` = borrar palabra). Ver `encodeKeystrokes` en @tecleo/engine.
 */
export const encodedKeystrokesSchema = z
  .object({
    deltas: z.array(z.number().int().min(0).max(600_000)).max(MAX_KEYSTROKES),
    inputs: z.string().max(MAX_KEYSTROKES * 2),
  })
  .refine((value) => Array.from(value.inputs).length === value.deltas.length, {
    message: 'Cada pulsación necesita su tiempo',
    path: ['inputs'],
  });
export type EncodedKeystrokesInput = z.infer<typeof encodedKeystrokesSchema>;

export const RESULT_MODES = ['practice', 'bots'] as const;
export type ResultMode = (typeof RESULT_MODES)[number];
export const PRACTICE_KINDS = ['time', 'words', 'text'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

/**
 * Resultado enviado por el cliente. El servidor no confía en sus métricas: reproduce las
 * pulsaciones con el motor sobre `content` y calcula todo de nuevo.
 */
export const submitResultSchema = z.object({
  mode: z.enum(RESULT_MODES),
  /** Texto del corpus, si lo es; el servidor verifica que `content` coincida. */
  textId: z.string().max(64).nullable(),
  content: z.string().min(1).max(10_000),
  preserveLines: z.boolean(),
  language: z.enum(LANGUAGES),
  rules: z.object({ mode: z.enum(['strict', 'free']), ignoreAccents: z.boolean() }),
  timeLimitMs: z.number().int().positive().max(600_000).nullable(),
  practiceKind: z.enum(PRACTICE_KINDS).nullable(),
  bots: z
    .object({
      seed: z.number().int().min(0).max(0xffffffff),
      levels: z.array(z.enum(BOT_LEVELS)).min(1).max(5),
    })
    .nullable(),
  keystrokes: encodedKeystrokesSchema,
  /** Cuándo se jugó (resultados de invitado que se migran); el servidor lo acota a "ahora". */
  playedAt: z.iso.datetime(),
});
export type SubmitResultInput = z.input<typeof submitResultSchema>;

export const importResultsSchema = z.object({
  results: z.array(submitResultSchema).min(1).max(50),
});

export const resultSummarySchema = z.object({
  id: z.uuid(),
  raceId: z.uuid(),
  mode: z.enum(['practice', 'bots', 'public', 'private', 'ghost', 'daily', 'targeted']),
  language: z.enum(LANGUAGES),
  wpm: z.number(),
  rawWpm: z.number(),
  accuracy: z.number(),
  consistency: z.number(),
  durationMs: z.number().int(),
  completed: z.boolean(),
  position: z.number().int().nullable(),
  runners: z.number().int(),
  ignoreAccents: z.boolean(),
  flagged: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type ResultSummary = z.infer<typeof resultSummarySchema>;

export const importResultsResponseSchema = z.object({
  imported: z.number().int(),
  rejected: z.number().int(),
});
