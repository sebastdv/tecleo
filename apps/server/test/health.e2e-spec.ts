import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@tecleo/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';

describe('GET /health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde con el contrato de @tecleo/shared', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    const body = healthResponseSchema.parse(response.body);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(Math.abs(body.serverTime - Date.now())).toBeLessThan(5_000);
  });

  it('permite CORS desde el origen de la web', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3100')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3100');
  });

  it('publica la documentación OpenAPI con el esquema de health', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(JSON.stringify(response.body)).toContain('uptimeSeconds');
  });
});
