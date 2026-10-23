import {
  earnedAchievements,
  levelFromXp,
  type AchievementId,
  type AchievementStats,
  type ProgressUpdate,
} from '@tecleo/shared';

import type { Prisma } from '../generated/prisma/client.js';

type Db = Prisma.TransactionClient;

export interface PreviousMarks {
  readonly previousAverageWpm: number | null;
  readonly previousBestWpm: number | null;
  readonly previousTextBestWpm: number | null;
}

/** Marcas de la persona antes de guardar una prueba nueva, para comparar en los resultados. */
export async function previousMarks(
  db: Db,
  userId: string,
  textId: string | null,
): Promise<PreviousMarks> {
  const clean = { userId, completed: true, flagged: false, ignoreAccents: false };
  const [recent, best, textBest] = await Promise.all([
    db.raceResult.findMany({
      where: { userId, completed: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { wpm: true },
    }),
    db.raceResult.aggregate({ where: clean, _max: { wpm: true } }),
    textId === null
      ? null
      : db.raceResult.aggregate({ where: { ...clean, race: { textId } }, _max: { wpm: true } }),
  ]);
  return {
    previousAverageWpm: recent.length
      ? recent.reduce((sum, row) => sum + row.wpm, 0) / recent.length
      : null,
    previousBestWpm: best._max.wpm,
    previousTextBestWpm: textBest?._max.wpm ?? null,
  };
}

async function achievementStats(db: Db, userId: string, level: number): Promise<AchievementStats> {
  const [row] = await db.$queryRaw<Omit<AchievementStats, 'level'>[]>`
    SELECT
      count(*)::int AS "races",
      count(*) FILTER (WHERE "position" = 1)::int AS "wins",
      coalesce(max("wpm") FILTER (WHERE "completed" AND NOT "ignoreAccents"), 0)::float AS "bestWpm",
      count(*) FILTER (
        WHERE "completed" AND "accuracy" >= 100 AND "durationMs" >= 15000
      )::int AS "perfect",
      count(*) FILTER (WHERE "mode" IN ('public', 'private') AND "completed")::int AS "online",
      count(*) FILTER (WHERE "mode" = 'daily' AND "completed")::int AS "daily",
      count(*) FILTER (WHERE "mode" = 'ghost' AND "position" = 1)::int AS "ghostWins"
    FROM "RaceResult"
    WHERE "userId" = ${userId}::uuid AND NOT "flagged"`;
  return {
    races: row?.races ?? 0,
    wins: row?.wins ?? 0,
    bestWpm: row?.bestWpm ?? 0,
    perfect: row?.perfect ?? 0,
    online: row?.online ?? 0,
    daily: row?.daily ?? 0,
    ghostWins: row?.ghostWins ?? 0,
    level,
  };
}

/**
 * Suma la XP de un resultado recién guardado, recalcula el nivel y entrega los logros nuevos.
 * Va dentro de la misma transacción que el resultado.
 */
export async function applyProgress(
  db: Db,
  userId: string,
  xpGained: number,
  previous: PreviousMarks,
): Promise<ProgressUpdate> {
  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const xp = before.xp + xpGained;
  const level = levelFromXp(xp);
  await db.user.update({ where: { id: userId }, data: { xp, level } });

  const stats = await achievementStats(db, userId, level);
  const owned = await db.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const ownedIds = new Set(owned.map((row) => row.achievementId));
  const fresh: AchievementId[] = earnedAchievements(stats).filter((id) => !ownedIds.has(id));
  if (fresh.length > 0) {
    await db.userAchievement.createMany({
      data: fresh.map((achievementId) => ({ userId, achievementId })),
      skipDuplicates: true,
    });
  }
  return {
    xpGained,
    xp,
    level,
    leveledUp: level > before.level,
    achievements: fresh,
    ...previous,
  };
}
