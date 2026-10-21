import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { HttpExceptionFilter } from './common/http-exception.filter.js';

import { APP_VERSION, ENV, type Env } from './config/config.module.js';

/** Configuración común a `main.ts` y a los tests de integración. */
export function setupApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  // IP real del cliente detrás del proxy de Next o del balanceador (rate limiting).
  (app as NestExpressApplication).set('trust proxy', env.TRUST_PROXY);
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Tecleo API')
      .setDescription('API REST de Tecleo. El tiempo real va por Socket.IO.')
      .setVersion(app.get<string>(APP_VERSION))
      .addBearerAuth()
      .addCookieAuth('tecleo_refresh')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
