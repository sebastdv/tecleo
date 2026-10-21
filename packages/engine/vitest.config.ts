import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/test-helpers.ts', 'src/index.ts'],
      // Las ramas sin cubrir son los `?? valor` que exige noUncheckedIndexedAccess.
      thresholds: { lines: 95, functions: 95, branches: 85, statements: 95 },
    },
  },
});
