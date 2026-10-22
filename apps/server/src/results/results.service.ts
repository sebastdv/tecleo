import { Injectable } from '@nestjs/common';
import {
  analyze,
  botProgressAt,
  correctChars,
  createBots,
  createTypingState,
  decodeKeystrokes,
  encodeKeystrokes,
  inspectRun,
  normalizeText,
  playKeystrokes,
  rankRunners,
  stateText,
  totalChars,
  type BotRun,
  type RaceMetrics,
  type TypingState,
} from '@tecleo/engine';
import type { ResultSummary, submitResultSchema } from '@tecleo/shared';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addKeyStats } from './key-stats.js';
import { packKeystrokes } from './keystroke-storage.js';
import { toResultSummary } from './result-summary.js';

type SubmitResult = z.output<typeof submitResultSchema>;

const MAX_AGE_MS = 30 * 86_400_000;
export const PLAYER_ID = 'player';

/** Fecha de juego declarada por el cliente, acotada a los últimos 30 días y nunca en el futuro. */
function clampPlayedAt(playedAt: string): Date {
  const now = Date.now();
  const time = Date.parse(playedAt);
  return new Date(Number.isNaN(time) ? now : Math.min(now, Math.max(now - MAX_AGE_MS, time)));
}

interface Verified {
  readonly state: TypingState;
  readonly metrics: RaceMetrics;
  readonly completed: boolean;
  readonly flagReason: string | null;
}

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reproduce el registro con el motor: las métricas oficiales salen de aquí, no del cliente. */
  private async verify(input: SubmitResult): Promise<Verified> {
    if (input.textId !== null) {
      const text = await this.prisma.text.findUnique({ where: { id: input.textId } });
      const options = { preserveLines: input.preserveLines };
      if (!text || normalizeText(text.content, options) !== normalizeText(input.content, options)) {
        throw new ApiException(422, 'TEXT_MISMATCH', 'El texto no coincide con el del corpus');
      }
    }
    let keystrokes;
    try {
      keystrokes = decodeKeystrokes(input.keystrokes);
    } catch {
      throw new ApiException(400, 'VALIDATION', 'Pulsaciones mal codificadas', ['keystrokes']);
    }
    const template = createTypingState({
      text: input.content,
      preserveLines: input.preserveLines,
      timeLimitMs: input.timeLimitMs,
      startOn: input.mode === 'bots' ? 'signal' : 'firstInput',
      rules: input.rules,
    });
    const state = playKeystrokes(template, keystrokes);
    if (state.phase !== 'finished') {
      throw new ApiException(422, 'INCOMPLETE_RUN', 'Las pulsaciones no completan la prueba');
    }
    const metrics = analyze(state);
    const report = inspectRun(metrics, state.keystrokes);
    return {
      state,
      metrics,
      completed: correctChars(state) === totalChars(state),
      flagReason: report.flagged ? report.reasons.join(',') : null,
    };
  }

  async submit(userId: string, input: SubmitResult): Promise<ResultSummary> {
    const verified = await this.verify(input);
    return this.store(userId, input, verified);
  }

  /** Migra los resultados que el invitado guardó en su navegador. Los inválidos se descartan. */
  async import(
    userId: string,
    inputs: readonly SubmitResult[],
  ): Promise<{ imported: number; rejected: number }> {
    let imported = 0;
    for (const input of inputs) {
      try {
        await this.submit(userId, input);
        imported++;
      } catch (error) {
        if (!(error instanceof ApiException)) throw error;
      }
    }
    return { imported, rejected: inputs.length - imported };
  }

  private async store(
    userId: string,
    input: SubmitResult,
    verified: Verified,
  ): Promise<ResultSummary> {
    const { state, metrics, completed, flagReason } = verified;
    const content = stateText(state);
    const createdAt = clampPlayedAt(input.playedAt);

    // Carrera contra bots: el servidor los regenera con la semilla y decide las posiciones.
    let bots: BotRun[] = [];
    let positions = new Map<string, number>();
    if (input.mode === 'bots' && input.bots) {
      bots = createBots({
        text: input.content,
        preserveLines: input.preserveLines,
        levels: input.bots.levels,
        seed: input.bots.seed,
      });
      const limit = state.timeLimitMs ?? Number.POSITIVE_INFINITY;
      const standings = rankRunners([
        {
          id: PLAYER_ID,
          finishMs: completed ? metrics.durationMs : null,
          progress: correctChars(state) / totalChars(state),
        },
        ...bots.map((bot) => ({
          id: bot.profile.id,
          finishMs: bot.finishMs <= limit ? bot.finishMs : null,
          progress: botProgressAt(bot, limit),
        })),
      ]);
      positions = new Map(standings.map((standing) => [standing.id, standing.position]));
    }

    const botTemplate = createTypingState({
      text: content,
      preserveLines: input.preserveLines,
      startOn: 'signal',
      rules: { mode: 'strict' },
    });
    const config: Prisma.InputJsonObject = {
      practiceKind: input.practiceKind,
      timeLimitMs: input.timeLimitMs,
      preserveLines: input.preserveLines,
      rules: input.rules,
      ...(input.bots && { bots: { levels: input.bots.levels } }),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const race = await tx.race.create({
        data: {
          textId: input.textId,
          content,
          language: input.language,
          mode: input.mode,
          config,
          seed: input.bots?.seed ?? null,
          createdAt,
        },
      });
      const player = await tx.raceResult.create({
        data: {
          raceId: race.id,
          userId,
          position: positions.get(PLAYER_ID) ?? null,
          wpm: metrics.wpm,
          rawWpm: metrics.rawWpm,
          accuracy: metrics.accuracy,
          consistency: metrics.consistency,
          durationMs: Math.round(metrics.durationMs),
          completed,
          keystrokes: packKeystrokes(encodeKeystrokes(state.keystrokes)),
          mode: input.mode,
          language: input.language,
          ignoreAccents: input.rules.ignoreAccents,
          validated: true,
          flagged: flagReason !== null,
          flagReason,
          createdAt,
        },
      });
      if (bots.length > 0) {
        await tx.raceResult.createMany({
          data: bots.map((bot) => {
            const botMetrics = analyze(playKeystrokes(botTemplate, bot.keystrokes));
            return {
              raceId: race.id,
              botName: bot.profile.name,
              botLevel: bot.profile.level,
              position: positions.get(bot.profile.id) ?? null,
              wpm: botMetrics.wpm,
              rawWpm: botMetrics.rawWpm,
              accuracy: botMetrics.accuracy,
              consistency: botMetrics.consistency,
              durationMs: Math.round(bot.finishMs),
              completed: true,
              mode: input.mode,
              language: input.language,
              validated: true,
              createdAt,
            };
          }),
        });
      }
      // Las teclas débiles solo aprenden de resultados limpios.
      if (flagReason === null) await addKeyStats(tx, userId, metrics);
      return player;
    });

    return toResultSummary({ ...result, runners: 1 + bots.length });
  }
}
