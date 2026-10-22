import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadEnv', () => {
  it('aplica valores por defecto', () => {
    expect(loadEnv(REQUIRED)).toEqual({
      ...REQUIRED,
      NODE_ENV: 'development',
      PORT: 4100,
      WEB_ORIGIN: ['http://localhost:3100'],
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
      REFRESH_COOKIE_PATH: '/api/auth',
      AUTH_RATE_LIMIT: 10,
      RATE_LIMIT: 120,
      MATCHMAKING_WAIT_MS: 10_000,
      COUNTDOWN_MS: 5_000,
      RECONNECT_GRACE_MS: 30_000,
      TRUST_PROXY: 1,
    });
  });

  it('exige base de datos y un secreto de al menos 32 caracteres', () => {
    expect(() => loadEnv({ JWT_SECRET: REQUIRED.JWT_SECRET })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...REQUIRED, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...REQUIRED, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('separa varios orígenes y convierte el puerto', () => {
    const env = loadEnv({ ...REQUIRED, PORT: '8080', WEB_ORIGIN: 'https://a.dev, https://b.dev,' });
    expect(env.PORT).toBe(8080);
    expect(env.WEB_ORIGIN).toEqual(['https://a.dev', 'https://b.dev']);
  });

  it('falla con un mensaje claro si una variable es inválida', () => {
    expect(() => loadEnv({ ...REQUIRED, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...REQUIRED, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
