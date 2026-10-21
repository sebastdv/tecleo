import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { authResponseSchema, loginSchema, registerSchema, type AuthResponse } from '@tecleo/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { ApiException } from '../common/api-exception.js';
import { zodToOpenApi } from '../common/zod-openapi.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ENV, type Env } from '../config/config.module.js';
import { AuthService, type AuthResult } from './auth.service.js';

export const REFRESH_COOKIE = 'tecleo_refresh';
/**
 * Límite de registro y login por IP (`AUTH_RATE_LIMIT`, validado al arrancar). Se lee en cada
 * petición porque los decoradores se evalúan antes de que exista la configuración.
 */
const authLimit = () => Number(process.env.AUTH_RATE_LIMIT ?? 10);
const AUTH_THROTTLE = { default: { limit: authLimit, ttl: 60_000 } };
/** El refresh ocurre en cada carga de página: admite el triple. */
const REFRESH_THROTTLE = { default: { limit: () => authLimit() * 3, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Crear cuenta (deja la cookie de refresh)' })
  @ApiOkResponse({ schema: zodToOpenApi(authResponseSchema) })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.output<typeof registerSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.respond(await this.auth.register(body, request.headers['user-agent']), response);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Entrar (deja la cookie de refresh)' })
  @ApiOkResponse({ schema: zodToOpenApi(authResponseSchema) })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.output<typeof loginSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.respond(await this.auth.login(body, request.headers['user-agent']), response);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(REFRESH_THROTTLE)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Nuevo access token a partir de la cookie (rota el refresh token)' })
  @ApiOkResponse({ schema: zodToOpenApi(authResponseSchema) })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const token = this.cookie(request);
    if (!token) throw new ApiException(401, 'SESSION_EXPIRED', 'No hay sesión');
    try {
      return this.respond(await this.auth.refresh(token, request.headers['user-agent']), response);
    } catch (error) {
      this.clearCookie(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Cerrar sesión (revoca la familia del refresh token)' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.cookie(request);
    if (token) await this.auth.logout(token);
    this.clearCookie(response);
  }

  private cookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  private respond({ response: body, session }: AuthResult, response: Response): AuthResponse {
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      path: this.env.REFRESH_COOKIE_PATH,
      expires: session.expiresAt,
    });
    return body;
  }

  private clearCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, { path: this.env.REFRESH_COOKIE_PATH });
  }
}
