import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Only the code we own. `src/types/**` is interface-only (no runtime
      // statements) and `index.ts` is the server bootstrap, exercised by
      // route tests through Fastify's `inject()` rather than by listening.
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/types/**'],
      reporter: ['text', 'lcov', 'json-summary'],
      // Baseline pinned at today's measured numbers. Raised to 100 by #14;
      // every PR in between may only move these up.
      thresholds: {
        statements: 25,
        branches: 36,
        functions: 26,
        lines: 23,
      },
    },
  },
});
