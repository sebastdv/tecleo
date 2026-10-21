import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { ApiException } from '../common/api-exception.js';
import { TokensService } from './tokens.service.js';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

/** Exige `Authorization: Bearer <access token>` válido y deja el id en la petición. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    const userId = token ? await this.tokens.verifyAccessToken(token) : null;
    if (!userId) throw new ApiException(401, 'UNAUTHORIZED', 'Inicia sesión para continuar');
    request.userId = userId;
    return true;
  }
}

export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().userId;
  if (!userId) throw new ApiException(401, 'UNAUTHORIZED', 'Inicia sesión para continuar');
  return userId;
});
