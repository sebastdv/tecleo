import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../auth/auth.guard.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Sesión válida y rol de administrador (leído de la base en cada petición, no del token). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const { userId } = context.switchToHttp().getRequest<Request & { userId?: string }>();
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      : null;
    if (user?.role !== 'admin') throw new ApiException(403, 'FORBIDDEN', 'Solo administradores');
    return true;
  }
}
