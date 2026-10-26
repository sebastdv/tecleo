import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const isCI = Boolean(process.env.CI);
/** Con `E2E_BASE_URL` se prueba un despliegue (p. ej. la demo) y no se levanta nada local. */
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // En CI se prueban los builds de producción; en local se reutiliza `pnpm dev` si está corriendo.
  webServer: external
    ? []
    : [
        {
          command: isCI ? 'pnpm --filter @tecleo/server start' : 'pnpm --filter @tecleo/server dev',
          cwd: '..',
          url: 'http://localhost:4100/health',
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
        {
          command: isCI ? 'pnpm --filter @tecleo/web start' : 'pnpm --filter @tecleo/web dev',
          cwd: '..',
          port: PORT,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      ],
});
