import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponse } from '@tecleo/shared';

import { zodToOpenApi } from '../common/zod-openapi.js';
import { APP_VERSION } from '../config/config.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(APP_VERSION) private readonly version: string) {}

  @Get()
  @ApiOperation({ summary: 'Estado del servidor (sirve para detectar el arranque en frío)' })
  @ApiOkResponse({ schema: zodToOpenApi(healthResponseSchema) })
  check(): HealthResponse {
    return {
      status: 'ok',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      serverTime: Date.now(),
    };
  }
}
