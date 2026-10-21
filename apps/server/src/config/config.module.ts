import { Global, Module } from '@nestjs/common';

import { loadEnv, readAppVersion, type Env } from './env.js';

export const ENV = Symbol('ENV');
export const APP_VERSION = Symbol('APP_VERSION');

export type { Env };

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: APP_VERSION, useFactory: readAppVersion },
  ],
  exports: [ENV, APP_VERSION],
})
export class ConfigModule {}
