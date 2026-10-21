import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BOT_LEVELS, raceDetailSchema, type RaceDetail } from '@tecleo/shared';
import { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { unpackKeystrokes } from '../results/keystroke-storage.js';

/** Lo que `ResultsService` guarda en `Race.config`. */
const storedConfigSchema = z.object({
  preserveLines: z.boolean().catch(false),
  timeLimitMs: z.number().int().nullable().catch(null),
  rules: z
    .object({ mode: z.enum(['strict', 'free']), ignoreAccents: z.boolean() })
    .catch({ mode: 'strict', ignoreAccents: false }),
  bots: z
    .object({ levels: z.array(z.enum(BOT_LEVELS)) })
    .optional()
    .catch(undefined),
});

@ApiTags('races')
@Controller('races')
export class RacesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Carrera con sus resultados y pulsaciones (repeticiones y fantasmas)' })
  @ApiOkResponse({ schema: zodToOpenApi(raceDetailSchema) })
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<RaceDetail> {
    const race = await this.prisma.race.findUnique({
      where: { id },
      include: {
        results: {
          orderBy: [{ position: 'asc' }, { wpm: 'desc' }],
          include: { user: { select: { nickname: true } } },
        },
      },
    });
    if (!race) throw new ApiException(404, 'NOT_FOUND', 'No existe esa carrera');
    const config = storedConfigSchema.parse(race.config);
    return {
      id: race.id,
      mode: race.mode,
      language: race.language === 'en' ? 'en' : 'es',
      textId: race.textId,
      content: race.content,
      preserveLines: config.preserveLines,
      timeLimitMs: config.timeLimitMs,
      rules: config.rules,
      seed: race.seed,
      botLevels: config.bots?.levels ?? null,
      createdAt: race.createdAt.toISOString(),
      results: race.results.map((result) => ({
        id: result.id,
        nickname: result.user?.nickname ?? null,
        botName: result.botName,
        position: result.position,
        wpm: result.wpm,
        accuracy: result.accuracy,
        durationMs: result.durationMs,
        completed: result.completed,
        keystrokes: result.keystrokes ? unpackKeystrokes(result.keystrokes) : null,
      })),
    };
  }
}
