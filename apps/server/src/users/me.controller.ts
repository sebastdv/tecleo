import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  meSchema,
  storedSettingsSchema,
  updateProfileSchema,
  userSettingsSchema,
  type Me,
  type StoredSettings,
  type UserSettings,
} from '@tecleo/shared';
import type { z } from 'zod';

import { AuthGuard, CurrentUserId } from '../auth/auth.guard.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Usuario de la sesión' })
  @ApiOkResponse({ schema: zodToOpenApi(meSchema) })
  me(@CurrentUserId() userId: string): Promise<Me> {
    return this.users.byId(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Cambiar avatar (si está desbloqueado) o país' })
  @ApiBody({ schema: zodToOpenApi(updateProfileSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(meSchema) })
  update(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: z.output<typeof updateProfileSchema>,
  ): Promise<Me> {
    return this.users.updateProfile(userId, body);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Preferencias guardadas (settings: null si nunca se guardaron)' })
  @ApiOkResponse({ schema: zodToOpenApi(storedSettingsSchema) })
  async settings(@CurrentUserId() userId: string): Promise<StoredSettings> {
    return { settings: await this.users.settings(userId) };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Guardar las preferencias completas' })
  @ApiBody({ schema: zodToOpenApi(userSettingsSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(userSettingsSchema) })
  saveSettings(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(userSettingsSchema)) body: UserSettings,
  ): Promise<UserSettings> {
    return this.users.saveSettings(userId, body);
  }
}
