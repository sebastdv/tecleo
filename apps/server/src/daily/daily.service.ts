import { Injectable } from '@nestjs/common';
import { seedFromString } from '@tecleo/engine';
import type { Daily, Language } from '@tecleo/shared';

import { ApiException } from '../common/api-exception.js';
import { Prisma, type Text } from '../generated/prisma/client.js';
import { startOfUtcDay } from '../leaderboards/leaderboards.service.js';
import { LeaderboardsService } from '../leaderboards/leaderboards.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toTextDto } from '../texts/text-dto.js';

const DAY_MS = 86_400_000;

/**
 * Desafío diario (spec 5.6): un texto por idioma y día UTC, el mismo para todos. Se elige al
 * pedirlo por primera vez, de forma reproducible (semilla = fecha + idioma), entre las citas
 * activas de longitud media.
 */
@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboards: LeaderboardsService,
  ) {}

  private async pick(date: Date, language: Language): Promise<Text> {
    const key = date.toISOString().slice(0, 10);
    const medium = { active: true, type: 'quote' as const, language, lengthCategory: 'medium' };
    const any = { active: true, type: 'quote' as const, language };
    const where = (await this.prisma.text.count({ where: medium })) > 0 ? medium : any;
    const count = await this.prisma.text.count({ where });
    if (count === 0) throw new ApiException(404, 'NOT_FOUND', 'No hay textos para el desafío');
    const [text] = await this.prisma.text.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: seedFromString(`${key}:${language}`) % count,
      take: 1,
    });
    if (!text) throw new ApiException(404, 'NOT_FOUND', 'No hay textos para el desafío');
    return text;
  }

  /** Texto del desafío de ese día, creándolo si nadie lo pidió todavía. */
  async textFor(date: Date, language: Language): Promise<Text> {
    const day = startOfUtcDay(date);
    const existing = await this.prisma.dailyChallenge.findUnique({
      where: { date_language: { date: day, language } },
      include: { text: true },
    });
    if (existing) return existing.text;
    const text = await this.pick(day, language);
    // Dos pedidos a la vez eligen el mismo texto (es determinista): el segundo no hace nada.
    await this.prisma.dailyChallenge.createMany({
      data: [{ date: day, language, textId: text.id }],
      skipDuplicates: true,
    });
    const stored = await this.prisma.dailyChallenge.findUniqueOrThrow({
      where: { date_language: { date: day, language } },
      include: { text: true },
    });
    return stored.text;
  }

  async today(language: Language, now = new Date()): Promise<Daily> {
    const day = startOfUtcDay(now);
    const text = await this.textFor(day, language);
    const entries = await this.leaderboards.best([
      Prisma.sql`r."mode" = 'daily'`,
      Prisma.sql`ra."textId" = ${text.id}`,
      Prisma.sql`r."language" = ${language}`,
      Prisma.sql`r."createdAt" >= ${day} AND r."createdAt" < ${new Date(day.getTime() + DAY_MS)}`,
    ]);
    return { date: day.toISOString().slice(0, 10), text: toTextDto(text), entries };
  }

  /** ¿`textId` es el desafío de hoy o de ayer? (quien empezó antes de medianoche UTC). */
  async isCurrent(textId: string, language: Language, now = new Date()): Promise<boolean> {
    const today = startOfUtcDay(now);
    const days = [today, new Date(today.getTime() - DAY_MS)];
    const found = await this.prisma.dailyChallenge.count({
      where: { textId, language, date: { in: days } },
    });
    return found > 0;
  }
}
