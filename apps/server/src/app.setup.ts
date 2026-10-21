import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { APP_VERSION, ENV, type Env } from './config/config.module.js';

/** Configuración común a `main.ts` y a los tests de integración. */
export function setupApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Tecleo API')
      .setDescription('API REST de Tecleo. El tiempo real va por Socket.IO.')
      .setVersion(app.get<string>(APP_VERSION))
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
