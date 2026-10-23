import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { leaderboardQuerySchema, leaderboardSchema, type Leaderboard } from '@tecleo/shared';
import type { z } from 'zod';

import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LeaderboardsService } from './leaderboards.service.js';

@ApiTags('leaderboards')
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get()
  @ApiOperation({ summary: 'Ranking diario, semanal o histórico por idioma y modo' })
  @ApiOkResponse({ schema: zodToOpenApi(leaderboardSchema) })
  async list(
    @Query(new ZodValidationPipe(leaderboardQuerySchema))
    query: z.output<typeof leaderboardQuerySchema>,
  ): Promise<Leaderboard> {
    return { entries: await this.leaderboards.global(query) };
  }
}
