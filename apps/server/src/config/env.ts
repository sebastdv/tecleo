import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  /** Orígenes permitidos por CORS y por Socket.IO, separados por comas. */
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:3100')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Firma de los access tokens (HS256). En producción, un valor aleatorio largo. */
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /**
   * Ruta de la cookie del refresh token tal como la ve el navegador: la web expone la API bajo
   * `/api` (proxy de Next), así que la cookie va a `/api/auth`.
   */
  REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/api/auth'),
  /** Intentos por minuto y por IP en registro y login (el refresh admite el triple). */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  /** Peticiones por minuto y por IP en el resto de la API. */
  RATE_LIMIT: z.coerce.number().int().positive().default(120),
  /** Saltos de proxy de confianza para leer la IP real (rate limiting detrás de Next/Render). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
});

export type Env = z.infer<typeof envSchema>;

/** Carga `.env` si existe (solo en local) y valida las variables; si falta algo, falla al arrancar. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && existsSync('.env')) process.loadEnvFile('.env');
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

const packageJsonSchema = z.object({ version: z.string() });

/** Versión del server, leída del package.json (src/ y dist/ están a la misma profundidad). */
export function readAppVersion(): string {
  const raw: unknown = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
  );
  return packageJsonSchema.parse(raw).version;
}
