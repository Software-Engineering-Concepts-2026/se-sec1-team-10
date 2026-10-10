import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/server/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}', 'src/client/**/*.{ts,tsx}'],
      exclude: ['src/tests/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      reporter: ['text', 'html', 'lcov', 'json'],
    },
  },
});
