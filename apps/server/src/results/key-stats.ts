import type { RaceMetrics } from '@tecleo/engine';

import type { Prisma } from '../generated/prisma/client.js';

/** Suma intentos y errores por tecla y por par de letras en una sola sentencia. */
export async function addKeyStats(
  tx: Prisma.TransactionClient,
  userId: string,
  metrics: RaceMetrics,
): Promise<void> {
  const rows = [
    ...Object.entries(metrics.keyStats).map(([key, stat]) => ['key', key, stat] as const),
    ...Object.entries(metrics.bigramStats).map(([key, stat]) => ['bigram', key, stat] as const),
  ];
  if (rows.length === 0) return;
  await tx.$executeRaw`
    INSERT INTO "KeyStat" ("userId", "kind", "key", "attempts", "errors")
    SELECT ${userId}::uuid, k::"KeyStatKind", key, a, e
    FROM unnest(${rows.map((r) => r[0])}::text[], ${rows.map((r) => r[1])}::text[],
                ${rows.map((r) => r[2].attempts)}::int[], ${rows.map((r) => r[2].errors)}::int[])
      AS t(k, key, a, e)
    ON CONFLICT ("userId", "kind", "key") DO UPDATE
      SET "attempts" = "KeyStat"."attempts" + EXCLUDED."attempts",
          "errors" = "KeyStat"."errors" + EXCLUDED."errors"`;
}
