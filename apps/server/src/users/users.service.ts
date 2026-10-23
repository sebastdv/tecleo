import { Injectable } from '@nestjs/common';
import {
  ACHIEVEMENT_IDS,
  AVATAR_UNLOCKS,
  isUnlocked,
  parseSettings,
  type AchievementId,
  type Me,
  type Profile,
  type ProfileStats,
  type RacesPage,
  type racesQuerySchema,
  type UpdateProfileInput,
  type UserSettings,
} from '@tecleo/shared';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toResultSummary } from '../results/result-summary.js';
import { toMe, toPublicUser } from './public-user.js';

/** Mínimo de intentos para que un par de letras aparezca entre los problemáticos. */
const MIN_BIGRAM_ATTEMPTS = 5;
const HISTORY_LIMIT = 100;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async byId(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiException(401, 'UNAUTHORIZED', 'La cuenta ya no existe');
    return toMe(user);
  }

  private async achievementsOf(userId: string): Promise<{ id: AchievementId; unlockedAt: Date }[]> {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'asc' },
    });
    return rows.flatMap((row) => {
      const id = ACHIEVEMENT_IDS.find((known) => known === row.achievementId);
      return id ? [{ id, unlockedAt: row.unlockedAt }] : [];
    });
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Me> {
    if (input.avatar) {
      const current = await this.byId(userId);
      const achievements = (await this.achievementsOf(userId)).map((row) => row.id);
      if (!isUnlocked(AVATAR_UNLOCKS[input.avatar], current.level, achievements)) {
        throw new ApiException(403, 'LOCKED', 'Ese avatar todavía no está desbloqueado');
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.avatar !== undefined && { avatar: input.avatar }),
        ...(input.country !== undefined && { country: input.country }),
      },
    });
    return toMe(user);
  }

  async settings(userId: string): Promise<UserSettings | null> {
    const row = await this.prisma.userSettings.findUnique({ where: { userId } });
    return row ? parseSettings(row.data) : null;
  }

  async saveSettings(userId: string, settings: UserSettings): Promise<UserSettings> {
    const data = settings as Prisma.InputJsonObject;
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, data },
      update: { data },
    });
    return settings;
  }

  private async byNickname(nickname: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { nicknameKey: nickname.toLowerCase() },
    });
    if (!user) throw new ApiException(404, 'NOT_FOUND', 'No existe ese jugador');
    return user;
  }

  async profile(nickname: string): Promise<Profile> {
    const user = await this.byNickname(nickname);
    const where = { userId: user.id };
    const [races, recent, best, accuracy, wins, contested, achievements] = await Promise.all([
      this.prisma.raceResult.count({ where }),
      this.prisma.raceResult.findMany({
        where: { ...where, completed: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { wpm: true },
      }),
      this.prisma.raceResult.aggregate({
        where: { ...where, completed: true, flagged: false, ignoreAccents: false },
        _max: { wpm: true },
      }),
      this.prisma.raceResult.aggregate({
        where: { ...where, completed: true },
        _avg: { accuracy: true },
      }),
      this.prisma.raceResult.count({ where: { ...where, position: 1 } }),
      this.prisma.raceResult.count({ where: { ...where, position: { not: null } } }),
      this.achievementsOf(user.id),
    ]);
    const averageWpm = recent.length
      ? recent.reduce((sum, r) => sum + r.wpm, 0) / recent.length
      : 0;
    return {
      ...toPublicUser(user),
      stats: {
        races,
        averageWpm,
        bestWpm: best._max.wpm ?? 0,
        averageAccuracy: accuracy._avg.accuracy ?? 0,
        wins,
        winRate: contested ? (wins / contested) * 100 : 0,
      },
      achievements: achievements.map((row) => ({
        id: row.id,
        unlockedAt: row.unlockedAt.toISOString(),
      })),
    };
  }

  async stats(nickname: string): Promise<ProfileStats> {
    const user = await this.byNickname(nickname);
    const [history, bestByMode, keys, bigrams] = await Promise.all([
      this.prisma.raceResult.findMany({
        where: { userId: user.id, completed: true },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_LIMIT,
        select: { createdAt: true, wpm: true, accuracy: true, mode: true },
      }),
      this.prisma.$queryRaw<
        { mode: ProfileStats['bestByMode'][number]['mode']; wpm: number; id: string }[]
      >`
        SELECT DISTINCT ON ("mode") "mode", "wpm", "id"
        FROM "RaceResult"
        WHERE "userId" = ${user.id}::uuid AND "completed" AND NOT "flagged" AND NOT "ignoreAccents"
        ORDER BY "mode", "wpm" DESC`,
      this.prisma.keyStat.findMany({
        where: { userId: user.id, kind: 'key' },
        select: { key: true, attempts: true, errors: true },
      }),
      this.prisma.$queryRaw<{ key: string; attempts: number; errors: number }[]>`
        SELECT "key", "attempts", "errors" FROM "KeyStat"
        WHERE "userId" = ${user.id}::uuid AND "kind" = 'bigram'
          AND "attempts" >= ${MIN_BIGRAM_ATTEMPTS} AND "errors" > 0
        ORDER BY "errors"::float / "attempts" DESC, "attempts" DESC
        LIMIT 20`,
    ]);
    return {
      history: history.reverse().map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      bestByMode: bestByMode.map((row) => ({ mode: row.mode, wpm: row.wpm, resultId: row.id })),
      keys,
      bigrams,
    };
  }

  async races(nickname: string, query: z.output<typeof racesQuerySchema>): Promise<RacesPage> {
    const user = await this.byNickname(nickname);
    const rows = await this.prisma.raceResult.findMany({
      where: {
        userId: user.id,
        ...(query.mode && { mode: query.mode }),
        ...(query.language && { language: query.language }),
        // Los ids son UUID v7: ordenarlos equivale a ordenar por fecha de creación.
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: { race: { select: { _count: { select: { results: true } } } } },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ race, ...row }) =>
        toResultSummary({ ...row, runners: race._count.results }),
      ),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
