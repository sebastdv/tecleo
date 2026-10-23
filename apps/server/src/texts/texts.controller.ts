import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  randomTextQuerySchema,
  ratingSchema,
  ratingStateSchema,
  textLeaderboardSchema,
  textSchema,
  type RatingState,
  type TextDto,
  type TextLeaderboard,
} from '@tecleo/shared';
import type { z } from 'zod';

import { AuthGuard, CurrentUserId } from '../auth/auth.guard.js';
import { ApiException } from '../common/api-exception.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LeaderboardsService } from '../leaderboards/leaderboards.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toTextDto } from './text-dto.js';

@ApiTags('texts')
@Controller('texts')
export class TextsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboards: LeaderboardsService,
  ) {}

  @Get('random')
  @ApiOperation({ summary: 'Texto activo al azar' })
  @ApiOkResponse({ schema: zodToOpenApi(textSchema) })
  async random(
    @Query(new ZodValidationPipe(randomTextQuerySchema))
    query: z.output<typeof randomTextQuerySchema>,
  ): Promise<TextDto> {
    const where = {
      active: true,
      type: query.type,
      ...(query.type === 'quote' && { language: query.language }),
      ...(query.length && { lengthCategory: query.length }),
      ...(query.exclude && { id: { not: query.exclude } }),
    };
    const count = await this.prisma.text.count({ where });
    if (count === 0) throw new ApiException(404, 'NOT_FOUND', 'No hay textos con esos filtros');
    const [text] = await this.prisma.text.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * count),
      take: 1,
    });
    if (!text) throw new ApiException(404, 'NOT_FOUND', 'No hay textos con esos filtros');
    return toTextDto(text);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Un texto por id' })
  @ApiOkResponse({ schema: zodToOpenApi(textSchema) })
  async byId(@Param('id') id: string): Promise<TextDto> {
    const text = await this.prisma.text.findUnique({ where: { id } });
    if (!text) throw new ApiException(404, 'NOT_FOUND', 'No existe ese texto');
    return toTextDto(text);
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Ranking de un texto: la mejor marca de cada persona' })
  @ApiOkResponse({ schema: zodToOpenApi(textLeaderboardSchema) })
  leaderboard(@Param('id') id: string): Promise<TextLeaderboard> {
    return this.leaderboards.text(id);
  }

  @Get(':id/rating')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mi calificación de un texto y los totales' })
  @ApiOkResponse({ schema: zodToOpenApi(ratingStateSchema) })
  async rating(@CurrentUserId() userId: string, @Param('id') id: string): Promise<RatingState> {
    const text = await this.prisma.text.findUnique({ where: { id } });
    if (!text) throw new ApiException(404, 'NOT_FOUND', 'No existe ese texto');
    const own = await this.prisma.textRating.findUnique({
      where: { userId_textId: { userId, textId: id } },
    });
    return { value: own?.value === 1 ? 1 : own?.value === -1 ? -1 : 0, ...counts(text) };
  }

  @Put(':id/rating')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Calificar un texto: 1 (👍), -1 (👎) o 0 (quitar)' })
  @ApiBody({ schema: zodToOpenApi(ratingSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(ratingStateSchema) })
  async rate(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ratingSchema)) body: z.output<typeof ratingSchema>,
  ): Promise<RatingState> {
    if (!(await this.prisma.text.findUnique({ where: { id } }))) {
      throw new ApiException(404, 'NOT_FOUND', 'No existe ese texto');
    }
    const text = await this.prisma.$transaction(async (tx) => {
      const key = { userId_textId: { userId, textId: id } };
      if (body.value === 0) await tx.textRating.deleteMany({ where: { userId, textId: id } });
      else
        await tx.textRating.upsert({
          where: key,
          create: { userId, textId: id, value: body.value },
          update: { value: body.value },
        });
      // Los totales se recuentan (no se suman): calificar dos veces no los infla.
      const [likes, dislikes] = await Promise.all([
        tx.textRating.count({ where: { textId: id, value: 1 } }),
        tx.textRating.count({ where: { textId: id, value: -1 } }),
      ]);
      return tx.text.update({ where: { id }, data: { likes, dislikes } });
    });
    return { value: body.value, ...counts(text) };
  }
}

function counts(text: { likes: number; dislikes: number }) {
  return { likes: text.likes, dislikes: text.dislikes };
}
