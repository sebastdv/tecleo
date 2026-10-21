import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  importResultsResponseSchema,
  importResultsSchema,
  resultSummarySchema,
  submitResultSchema,
  type ResultSummary,
} from '@tecleo/shared';
import type { z } from 'zod';

import { AuthGuard, CurrentUserId } from '../auth/auth.guard.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ResultsService } from './results.service.js';

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Guardar un resultado: el servidor reproduce las pulsaciones y lo valida',
  })
  @ApiBody({ schema: zodToOpenApi(submitResultSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(resultSummarySchema) })
  submit(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(submitResultSchema)) body: z.output<typeof submitResultSchema>,
  ): Promise<ResultSummary> {
    return this.results.submit(userId, body);
  }

  @Post('import')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Migrar los resultados guardados como invitado (máx. 50)' })
  @ApiBody({ schema: zodToOpenApi(importResultsSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(importResultsResponseSchema) })
  import(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(importResultsSchema)) body: z.output<typeof importResultsSchema>,
  ) {
    return this.results.import(userId, body.results);
  }
}
