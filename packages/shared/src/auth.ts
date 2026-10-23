import { z } from 'zod';

/** Avatares propios: un tipo de imprenta con la inicial, en distintos acabados. */
export const AVATARS = ['brass', 'ink', 'forest', 'plum', 'graphite', 'ribbon'] as const;
export type AvatarId = (typeof AVATARS)[number];

export const NICKNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Se recorta y pasa a minúsculas antes de validar: "  Ana@Example.com " es válido. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  nickname: z.string().trim().regex(NICKNAME_PATTERN),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
});
export type LoginInput = z.input<typeof loginSchema>;

export const publicUserSchema = z.object({
  id: z.uuid(),
  nickname: z.string(),
  avatar: z.enum(AVATARS).nullable(),
  country: z.string().length(2).nullable(),
  level: z.number().int(),
  xp: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/** La propia cuenta: lo público más lo que solo ve su dueño. */
export const meSchema = publicUserSchema.extend({
  isAdmin: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: meSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const updateProfileSchema = z.object({
  avatar: z.enum(AVATARS).nullable().optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

/** Códigos de error de la API; la web los traduce. */
export const API_ERROR_CODES = [
  'VALIDATION',
  'EMAIL_TAKEN',
  'NICKNAME_TAKEN',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'SESSION_EXPIRED',
  'NOT_FOUND',
  'TEXT_MISMATCH',
  'INCOMPLETE_RUN',
  'RATE_LIMITED',
  'LOCKED',
  'FORBIDDEN',
  'NOT_DAILY',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  /** Rutas de los campos inválidos cuando `code` es VALIDATION. */
  fields: z.array(z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
