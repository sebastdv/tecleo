import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  profileSchema,
  profileStatsSchema,
  racesPageSchema,
  racesQuerySchema,
  type Profile,
  type ProfileStats,
  type RacesPage,
} from '@tecleo/shared';
import type { z } from 'zod';

import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':nickname')
  @ApiOperation({ summary: 'Perfil público' })
  @ApiOkResponse({ schema: zodToOpenApi(profileSchema) })
  profile(@Param('nickname') nickname: string): Promise<Profile> {
    return this.users.profile(nickname);
  }

  @Get(':nickname/stats')
  @ApiOperation({ summary: 'Evolución, mejores marcas y teclas débiles' })
  @ApiOkResponse({ schema: zodToOpenApi(profileStatsSchema) })
  stats(@Param('nickname') nickname: string): Promise<ProfileStats> {
    return this.users.stats(nickname);
  }

  @Get(':nickname/races')
  @ApiOperation({ summary: 'Historial de pruebas, paginado y filtrable' })
  @ApiOkResponse({ schema: zodToOpenApi(racesPageSchema) })
  races(
    @Param('nickname') nickname: string,
    @Query(new ZodValidationPipe(racesQuerySchema)) query: z.output<typeof racesQuerySchema>,
  ): Promise<RacesPage> {
    return this.users.races(nickname, query);
  }
}
