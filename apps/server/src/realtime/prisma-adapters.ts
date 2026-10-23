import { Injectable } from '@nestjs/common';
import {
  analyze,
  correctChars,
  createTypingState,
  encodeKeystrokes,
  playKeystrokes,
} from '@tecleo/engine';
import { raceXp, type RaceResults, type RoomConfig } from '@tecleo/shared';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { applyProgress, previousMarks } from '../progression/progression.js';
import { addKeyStats } from '../results/key-stats.js';
import { packKeystrokes } from '../results/keystroke-storage.js';
import type { Room, RoomText } from './room.js';
import { RaceRecorder, TextPicker, type SavedResult } from './rooms.service.js';

@Injectable()
export class PrismaTextPicker extends TextPicker {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async pick(config: RoomConfig, excludeId?: string): Promise<RoomText> {
    const where: Prisma.TextWhereInput = {
      active: true,
      type: 'quote',
      language: config.language,
      ...(config.length !== 'any' && { lengthCategory: config.length }),
      ...(excludeId && { id: { not: excludeId } }),
    };
    const count = await this.prisma.text.count({ where });
    const [text] = await this.prisma.text.findMany({
      where: count > 0 ? where : { active: true, type: 'quote', language: config.language },
      orderBy: { id: 'asc' },
      skip: count > 0 ? Math.floor(Math.random() * count) : 0,
      take: 1,
    });
    if (!text) throw new Error(`No hay textos activos en ${config.language}`);
    return { id: text.id, content: text.content, author: text.author, source: text.source };
  }
}

/**
 * Guarda la carrera multijugador: resultados de quienes tienen cuenta (con pulsaciones, XP y
 * logros) y bots.
 */
@Injectable()
export class PrismaRaceRecorder extends RaceRecorder {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async record(room: Room, standings: RaceResults['standings']): Promise<Map<string, SavedResult>> {
    const saved = new Map<string, SavedResult>();
    const registered = [...room.players.values()].flatMap((player) =>
      player.identity.userId === null ? [] : [{ player, userId: player.identity.userId }],
    );
    if (registered.length === 0) return saved;
    const positions = new Map(standings.map((standing) => [standing.id, standing]));
    const botTemplate = createTypingState({
      text: room.text.content,
      startOn: 'signal',
      rules: { mode: 'strict' },
    });
    const config: Prisma.InputJsonObject = {
      practiceKind: null,
      timeLimitMs: room.timeLimitMs,
      preserveLines: false,
      rules: { mode: 'strict', ignoreAccents: false },
      bots: { levels: room.bots.map((bot) => bot.profile.level) },
      roomCode: room.code,
    };

    await this.prisma.$transaction(async (tx) => {
      const race = await tx.race.create({
        data: {
          textId: room.text.id,
          content: room.text.content,
          language: room.config.language,
          mode: room.mode,
          config,
          seed: room.seed,
        },
      });
      for (const { player, userId } of registered) {
        const standing = positions.get(player.identity.id);
        const run = player.run;
        const previous = await previousMarks(tx, userId, room.text.id);
        const flagged = run?.flagReason != null;
        const xp = raceXp({
          wpm: standing?.wpm ?? 0,
          accuracy: run?.metrics.accuracy ?? 0,
          correctChars: run ? correctChars(run.state) : player.progressChars,
          completed: run !== null,
          position: standing?.position ?? null,
          runners: standings.length,
          flagged,
        });
        const result = await tx.raceResult.create({
          data: {
            raceId: race.id,
            userId,
            position: standing?.position ?? null,
            wpm: standing?.wpm ?? 0,
            rawWpm: run?.metrics.rawWpm ?? 0,
            accuracy: run?.metrics.accuracy ?? 0,
            consistency: run?.metrics.consistency ?? 0,
            durationMs: Math.round(run?.metrics.durationMs ?? room.timeLimitMs),
            completed: run !== null,
            keystrokes: run ? packKeystrokes(encodeKeystrokes(run.state.keystrokes)) : null,
            mode: room.mode,
            language: room.config.language,
            validated: run !== null,
            flagged,
            flagReason: run?.flagReason ?? null,
            xp,
          },
        });
        const progress = await applyProgress(tx, userId, xp, previous);
        saved.set(player.identity.id, { id: result.id, progress });
        if (run?.flagReason === null) await addKeyStats(tx, userId, run.metrics);
      }
      if (room.bots.length > 0) {
        await tx.raceResult.createMany({
          data: room.bots.map((bot) => {
            const metrics = analyze(playKeystrokes(botTemplate, bot.keystrokes));
            return {
              raceId: race.id,
              botName: bot.profile.name,
              botLevel: bot.profile.level,
              position: positions.get(bot.profile.id)?.position ?? null,
              wpm: metrics.wpm,
              rawWpm: metrics.rawWpm,
              accuracy: metrics.accuracy,
              consistency: metrics.consistency,
              durationMs: Math.round(bot.finishMs),
              completed: bot.finishMs <= room.timeLimitMs,
              mode: room.mode,
              language: room.config.language,
              validated: true,
            };
          }),
        });
      }
    });
    return saved;
  }
}
