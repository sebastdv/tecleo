import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminTextSchema,
  adminTextsPageSchema,
  adminTextsQuerySchema,
  createTextSchema,
  updateTextSchema,
  type AdminText,
  type AdminTextsPage,
} from '@tecleo/shared';
import type { z } from 'zod';

import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminTextsService } from './admin-texts.service.js';
import { AdminGuard } from './admin.guard.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/texts')
export class AdminController {
  constructor(private readonly texts: AdminTextsService) {}

  @Get()
  @ApiOperation({ summary: 'Textos con filtros (incluye los desactivados)' })
  @ApiOkResponse({ schema: zodToOpenApi(adminTextsPageSchema) })
  list(
    @Query(new ZodValidationPipe(adminTextsQuerySchema))
    query: z.output<typeof adminTextsQuerySchema>,
  ): Promise<AdminTextsPage> {
    return this.texts.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Agregar un texto (dominio público u original)' })
  @ApiBody({ schema: zodToOpenApi(createTextSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(adminTextSchema) })
  create(
    @Body(new ZodValidationPipe(createTextSchema)) body: z.output<typeof createTextSchema>,
  ): Promise<AdminText> {
    return this.texts.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Activar o desactivar un texto' })
  @ApiBody({ schema: zodToOpenApi(updateTextSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(adminTextSchema) })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTextSchema)) body: z.output<typeof updateTextSchema>,
  ): Promise<AdminText> {
    return this.texts.setActive(id, body.active);
  }
}
