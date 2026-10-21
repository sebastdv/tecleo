import { Global, Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionsService } from './sessions.service.js';
import { TokensService } from './tokens.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionsService, TokensService, AuthGuard],
  exports: [TokensService, AuthGuard],
})
export class AuthModule {}
