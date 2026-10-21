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
