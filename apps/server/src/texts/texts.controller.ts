import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomTextQuerySchema, textSchema, type TextDto } from '@tecleo/shared';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Text } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

function toTextDto(text: Text): TextDto {
  const lengthCategory = text.lengthCategory;
  return {
    id: text.id,
    content: text.content,
    language: text.language === 'en' ? 'en' : 'es',
    type: text.type === 'code' ? 'code' : 'quote',
    author: text.author,
    source: text.source,
    length: text.length,
    lengthCategory:
      lengthCategory === 'short' || lengthCategory === 'medium' || lengthCategory === 'long'
        ? lengthCategory
        : null,
    difficulty: text.difficulty,
  };
}

@ApiTags('texts')
@Controller('texts')
export class TextsController {
  constructor(private readonly prisma: PrismaService) {}

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
}
