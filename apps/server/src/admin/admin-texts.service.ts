import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { bigramFrequencies, textDifficulty, type BigramFrequencies } from '@tecleo/content';
import {
  ADMIN_PAGE_SIZE,
  type AdminText,
  type AdminTextsPage,
  type adminTextsQuerySchema,
  type createTextSchema,
} from '@tecleo/shared';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import type { Prisma, Text } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toTextDto } from '../texts/text-dto.js';

/** Mismos cortes que el corpus (`packages/content/scripts/build-corpus.ts`). */
function lengthCategory(length: number): 'short' | 'medium' | 'long' {
  if (length <= 140) return 'short';
  return length <= 320 ? 'medium' : 'long';
}

function toAdminText(text: Text): AdminText {
  return {
    ...toTextDto(text),
    active: text.active,
    likes: text.likes,
    dislikes: text.dislikes,
    createdAt: text.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminTextsService {
  /** Frecuencias de pares de letras por idioma (para la dificultad), calculadas una vez. */
  private readonly bigrams = new Map<string, Promise<BigramFrequencies>>();

  constructor(private readonly prisma: PrismaService) {}

  async list(query: z.output<typeof adminTextsQuerySchema>): Promise<AdminTextsPage> {
    const where: Prisma.TextWhereInput = {
      ...(query.language && { language: query.language }),
      ...(query.type && { type: query.type }),
      ...(query.active && { active: query.active === 'true' }),
      ...(query.q && {
        OR: [
          { content: { contains: query.q, mode: 'insensitive' } },
          { author: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      this.prisma.text.count({ where }),
      this.prisma.text.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
      }),
    ]);
    return {
      items: items.map(toAdminText),
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    };
  }

  private frequencies(language: string, type: Text['type']): Promise<BigramFrequencies> {
    const key = `${type}:${language}`;
    let cached = this.bigrams.get(key);
    if (!cached) {
      cached = this.prisma.text
        .findMany({ where: { language, type }, select: { content: true } })
        .then((rows) => bigramFrequencies(rows.map((row) => row.content)));
      this.bigrams.set(key, cached);
    }
    return cached;
  }

  async create(input: z.output<typeof createTextSchema>): Promise<AdminText> {
    // El código se guarda como inglés, igual que el del corpus (palabras clave en inglés).
    const language = input.type === 'code' ? 'en' : input.language;
    const prefix = input.type === 'code' ? 'code' : language;
    const text = await this.prisma.text.create({
      data: {
        id: `${prefix}-u${randomBytes(4).toString('hex')}`,
        content: input.content,
        language,
        type: input.type,
        author: input.author,
        source: input.source,
        length: input.content.length,
        lengthCategory: input.type === 'quote' ? lengthCategory(input.content.length) : null,
        difficulty: textDifficulty(input.content, await this.frequencies(language, input.type)),
      },
    });
    return toAdminText(text);
  }

  async setActive(id: string, active: boolean): Promise<AdminText> {
    const existing = await this.prisma.text.findUnique({ where: { id } });
    if (!existing) throw new ApiException(404, 'NOT_FOUND', 'No existe ese texto');
    return toAdminText(await this.prisma.text.update({ where: { id }, data: { active } }));
  }
}
