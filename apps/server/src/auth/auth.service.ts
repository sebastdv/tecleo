import { Injectable } from '@nestjs/common';
import { type AuthResponse, type loginSchema, type registerSchema } from '@tecleo/shared';
import argon2 from 'argon2';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toMe } from '../users/public-user.js';
import { SessionsService, type IssuedSession } from './sessions.service.js';
import { TokensService } from './tokens.service.js';

export interface AuthResult {
  readonly response: AuthResponse;
  readonly session: IssuedSession;
}

/**
 * Hash con el que se compara cuando el correo no existe, para que el tiempo de respuesta no
 * delate qué correos tienen cuenta. Se calcula una vez, al primer login.
 */
let dummyHash: Promise<string> | null = null;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokensService,
  ) {}

  async register(input: z.output<typeof registerSchema>, userAgent?: string): Promise<AuthResult> {
    const passwordHash = await argon2.hash(input.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          nickname: input.nickname,
          nicknameKey: input.nickname.toLowerCase(),
        },
      });
      return await this.issue(user.id, userAgent);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta ?? {});
        if (target.includes('email'))
          throw new ApiException(409, 'EMAIL_TAKEN', 'Ese correo ya tiene cuenta');
        throw new ApiException(409, 'NICKNAME_TAKEN', 'Ese apodo ya está en uso');
      }
      throw error;
    }
  }

  async login(input: z.output<typeof loginSchema>, userAgent?: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    dummyHash ??= argon2.hash('tecleo-dummy-password');
    const valid = await argon2.verify(user?.passwordHash ?? (await dummyHash), input.password);
    if (!user || !valid) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
    }
    return this.issue(user.id, userAgent);
  }

  async refresh(refreshToken: string, userAgent?: string): Promise<AuthResult> {
    const session = await this.sessions.rotate(refreshToken, userAgent);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    return {
      session,
      response: {
        accessToken: await this.tokens.signAccessToken(user.id),
        user: toMe(user),
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessions.revoke(refreshToken);
  }

  private async issue(userId: string, userAgent?: string): Promise<AuthResult> {
    const [session, user] = await Promise.all([
      this.sessions.create(userId, userAgent),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    return {
      session,
      response: {
        accessToken: await this.tokens.signAccessToken(userId),
        user: toMe(user),
      },
    };
  }
}
