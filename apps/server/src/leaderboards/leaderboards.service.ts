import { Injectable } from '@nestjs/common';
import {
  AVATARS,
  LEADERBOARD_SIZE,
  type LeaderboardEntry,
  type leaderboardQuerySchema,
  type TextLeaderboard,
} from '@tecleo/shared';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toTextDto } from '../texts/text-dto.js';

type Query = z.output<typeof leaderboardQuerySchema>;

interface Row {
  id: string;
  raceId: string;
  wpm: number;
  accuracy: number;
  mode: LeaderboardEntry['mode'];
  createdAt: Date;
  nickname: string;
  avatar: string | null;
  level: number;
}

/** Inicio del día UTC de `now`. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function sinceFor(period: Query['period'], now: Date): Date | null {
  if (period === 'day') return startOfUtcDay(now);
  if (period === 'week') return new Date(now.getTime() - 7 * 86_400_000);
  return null;
}

function toEntry(row: Row, index: number): LeaderboardEntry {
  return {
    rank: index + 1,
    nickname: row.nickname,
    avatar: AVATARS.find((avatar) => avatar === row.avatar) ?? null,
    level: row.level,
    wpm: row.wpm,
    accuracy: row.accuracy,
    mode: row.mode,
    resultId: row.id,
    raceId: row.raceId,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Rankings: la mejor marca de cada persona entre resultados validados, completos, sin marcar
 * y sin «ignorar tildes» (spec 7.4 y 8).
 */
@Injectable()
export class LeaderboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async best(filters: Prisma.Sql[]): Promise<LeaderboardEntry[]> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (r."userId")
          r."id", r."raceId", r."wpm", r."accuracy", r."mode", r."createdAt",
          u."nickname", u."avatar", u."level"
        FROM "RaceResult" r
        JOIN "User" u ON u."id" = r."userId"
        JOIN "Race" ra ON ra."id" = r."raceId"
        WHERE r."completed" AND r."validated" AND NOT r."flagged" AND NOT r."ignoreAccents"
          AND ${Prisma.join(filters, ' AND ')}
        ORDER BY r."userId", r."wpm" DESC, r."createdAt" ASC
      ) best
      ORDER BY "wpm" DESC, "createdAt" ASC
      LIMIT ${LEADERBOARD_SIZE}`;
    return rows.map(toEntry);
  }

  global(query: Query, now = new Date()): Promise<LeaderboardEntry[]> {
    const since = sinceFor(query.period, now);
    return this.best([
      Prisma.sql`r."language" = ${query.language}`,
      query.mode === 'all' ? Prisma.sql`TRUE` : Prisma.sql`r."mode" = ${query.mode}::"RaceMode"`,
      since ? Prisma.sql`r."createdAt" >= ${since}` : Prisma.sql`TRUE`,
    ]);
  }

  async text(textId: string): Promise<TextLeaderboard> {
    const text = await this.prisma.text.findUnique({ where: { id: textId } });
    if (!text) throw new ApiException(404, 'NOT_FOUND', 'No existe ese texto');
    return {
      text: { ...toTextDto(text), likes: text.likes, dislikes: text.dislikes },
      entries: await this.best([Prisma.sql`ra."textId" = ${textId}`]),
    };
  }
}
