// Crea los archivos de entorno de desarrollo a partir de `.env.example` si todavía no existen.
// Lo usa `pnpm local`; nunca pisa un archivo que ya esté.
import { copyFileSync, existsSync } from 'node:fs';

for (const target of ['apps/server/.env', 'apps/web/.env.local']) {
  if (existsSync(target)) continue;
  copyFileSync('.env.example', target);
  console.log(`Creado ${target} a partir de .env.example`);
}
