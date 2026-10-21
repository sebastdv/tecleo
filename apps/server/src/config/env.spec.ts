import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('aplica valores por defecto', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4100,
      WEB_ORIGIN: ['http://localhost:3100'],
    });
  });

  it('separa varios orígenes y convierte el puerto', () => {
    const env = loadEnv({ PORT: '8080', WEB_ORIGIN: 'https://a.dev, https://b.dev,' });
    expect(env.PORT).toBe(8080);
    expect(env.WEB_ORIGIN).toEqual(['https://a.dev', 'https://b.dev']);
  });

  it('falla con un mensaje claro si una variable es inválida', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
