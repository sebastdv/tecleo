import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7 no carga `.env` solo; en local se usa el del server si existe.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` no necesita conexión: sin la variable, la URL queda vacía.
    url: process.env.DATABASE_URL ?? '',
  },
});
