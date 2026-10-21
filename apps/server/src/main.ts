import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { ENV, type Env } from './config/config.module.js';

const app = await NestFactory.create(AppModule);
setupApp(app);

const { PORT } = app.get<Env>(ENV);
await app.listen(PORT);
Logger.log(`Server escuchando en http://localhost:${PORT} (Swagger en /docs)`, 'Bootstrap');
