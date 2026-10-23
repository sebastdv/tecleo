/**
 * Carga el corpus de @tecleo/content en la tabla Text. Es idempotente: actualiza los textos
 * existentes por id y no toca su estado (activo), likes ni dislikes.
 *
 *   pnpm --filter @tecleo/server db:seed
 *
 * Con `--if-empty` no hace nada si ya hay textos: así puede correr en cada arranque del
 * server en producción sin alargarlo (ver `start:prod`).
 */
import { existsSync } from 'node:fs';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  bigramFrequencies,
  CODE_SNIPPETS,
  loadQuotes,
  TEXT_LANGUAGES,
  textDifficulty,
} from '@tecleo/content';

import { PrismaClient } from '../src/generated/prisma/client.js';

// En local, el `.env` del server (como `prisma.config.ts`); en producción, el entorno.
if (existsSync('.env')) process.loadEnvFile('.env');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Falta DATABASE_URL');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  if (process.argv.includes('--if-empty') && (await prisma.text.count()) > 0) {
    console.log('Ya hay textos: no se carga el corpus');
    return;
  }
  let count = 0;
  for (const language of TEXT_LANGUAGES) {
    for (const quote of await loadQuotes(language)) {
      const data = {
        content: quote.content,
        language,
        type: 'quote' as const,
        author: quote.author,
        source: quote.source,
        gutenbergId: quote.gutenbergId,
        length: quote.length,
        lengthCategory: quote.lengthCategory,
        difficulty: quote.difficulty,
      };
      await prisma.text.upsert({
        where: { id: quote.id },
        create: { id: quote.id, ...data },
        update: data,
      });
      count++;
    }
  }

  // El código no tiene idioma natural: se guarda como 'en' (palabras clave en inglés).
  const bigrams = bigramFrequencies(CODE_SNIPPETS.map((snippet) => snippet.content));
  for (const snippet of CODE_SNIPPETS) {
    const data = {
      content: snippet.content,
      language: 'en',
      type: 'code' as const,
      source: snippet.title,
      length: snippet.content.length,
      difficulty: textDifficulty(snippet.content, bigrams),
    };
    await prisma.text.upsert({
      where: { id: snippet.id },
      create: { id: snippet.id, ...data },
      update: data,
    });
    count++;
  }
  console.log(`Textos cargados: ${count}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
