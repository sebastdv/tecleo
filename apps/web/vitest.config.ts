import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resuelve el alias `@/` igual que Next (tsconfig.json → paths).
  resolve: { tsconfigPaths: true },
});
