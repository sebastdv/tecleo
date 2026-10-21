import { defineConfig } from 'vitest/config';

/** Base de datos de prueba: la del docker-compose local o la del servicio de CI. */
const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://tecleo:tecleo@localhost:5440/tecleo_test';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-0123',
      // Las pruebas registran muchos usuarios; la del rate limiting baja el límite a propósito.
      AUTH_RATE_LIMIT: '1000',
      RATE_LIMIT: '10000',
    },
    // Las pruebas de integración comparten la base: una a la vez.
    fileParallelism: false,
  },
});
