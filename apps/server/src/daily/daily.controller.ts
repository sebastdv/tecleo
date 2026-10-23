import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { dailyQuerySchema, dailySchema, type Daily } from '@tecleo/shared';
import type { z } from 'zod';

import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DailyService } from './daily.service.js';

@ApiTags('daily')
@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  @Get()
  @ApiOperation({ summary: 'Desafío diario del idioma, con su ranking' })
  @ApiOkResponse({ schema: zodToOpenApi(dailySchema) })
  today(
    @Query(new ZodValidationPipe(dailyQuerySchema)) query: z.output<typeof dailyQuerySchema>,
  ): Promise<Daily> {
    return this.daily.today(query.language);
  }
}
