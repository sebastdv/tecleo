import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponse } from '@tecleo/shared';

import { clientIpSource, type RequestLike } from '../common/client-ip.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { APP_VERSION, ENV, type Env } from '../config/config.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_VERSION) private readonly version: string,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado del servidor (sirve para detectar el arranque en frío)' })
  @ApiOkResponse({ schema: zodToOpenApi(healthResponseSchema) })
  check(@Req() request: RequestLike): HealthResponse {
    return {
      status: 'ok',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      serverTime: Date.now(),
      clientIpSource: clientIpSource(request, this.env.PROXY_SECRET),
    };
  }
}
