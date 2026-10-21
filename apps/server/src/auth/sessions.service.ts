import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../common/api-exception.js';
import { ENV, type Env } from '../config/config.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokensService } from './tokens.service.js';

export interface IssuedSession {
  readonly userId: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

/**
 * Sesiones con refresh token rotativo. Cada uso entrega un token nuevo de la misma familia y
 * marca el anterior. Reusar un token ya rotado revoca la familia entera: alguien lo copió.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private expiry(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }

  async create(
    userId: string,
    userAgent: string | undefined,
    familyId: string = randomUUID(),
  ): Promise<IssuedSession> {
    const { token, hash } = this.tokens.newRefreshToken();
    const expiresAt = this.expiry();
    await this.prisma.session.create({
      data: {
        userId,
        familyId,
        tokenHash: hash,
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? null,
      },
    });
    return { userId, refreshToken: token, expiresAt };
  }

  async rotate(refreshToken: string, userAgent: string | undefined): Promise<IssuedSession> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: TokensService.hash(refreshToken) },
    });
    if (!session) throw new ApiException(401, 'SESSION_EXPIRED', 'Sesión no válida');

    if (session.rotatedAt !== null || session.revokedAt !== null) {
      await this.revokeFamily(session.familyId);
      throw new ApiException(401, 'SESSION_EXPIRED', 'Sesión no válida');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ApiException(401, 'SESSION_EXPIRED', 'La sesión venció');
    }

    // Solo una petición puede rotar el token: la condición evita carreras entre pestañas.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, rotatedAt: null },
      data: { rotatedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeFamily(session.familyId);
      throw new ApiException(401, 'SESSION_EXPIRED', 'Sesión no válida');
    }
    return this.create(session.userId, userAgent, session.familyId);
  }

  async revoke(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: TokensService.hash(refreshToken) },
      select: { familyId: true },
    });
    if (session) await this.revokeFamily(session.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
