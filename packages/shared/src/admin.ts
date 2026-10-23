import { z } from 'zod';

import { LANGUAGES } from './settings.js';
import { textSchema } from './texts.js';

/** Panel de textos para administradores (spec 4). */
export const adminTextsQuerySchema = z.object({
  language: z.enum(LANGUAGES).optional(),
  type: z.enum(['quote', 'code']).optional(),
  active: z.enum(['true', 'false']).optional(),
  /** Busca en el contenido y en el autor. */
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1_000).default(1),
});
export type AdminTextsQuery = z.input<typeof adminTextsQuerySchema>;

export const adminTextSchema = textSchema.extend({
  active: z.boolean(),
  likes: z.number().int(),
  dislikes: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type AdminText = z.infer<typeof adminTextSchema>;

export const ADMIN_PAGE_SIZE = 25;

export const adminTextsPageSchema = z.object({
  items: z.array(adminTextSchema),
  total: z.number().int(),
  page: z.number().int(),
  pages: z.number().int(),
});
export type AdminTextsPage = z.infer<typeof adminTextsPageSchema>;

/** Texto nuevo: de dominio público o escrito para el proyecto (spec 4). */
export const createTextSchema = z.object({
  content: z
    .string()
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().min(20).max(2_000)),
  language: z.enum(LANGUAGES),
  type: z.enum(['quote', 'code']),
  /** Vacío equivale a no tener. */
  author: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  source: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((value) => (value === '' ? null : value)),
});
export type CreateTextInput = z.input<typeof createTextSchema>;

export const updateTextSchema = z.object({ active: z.boolean() });
