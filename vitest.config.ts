import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts', 'src/**/*.test.ts'],
    // Datenbanktests teilen sich ein Schema und duerfen nicht parallel laufen.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': new URL('./src/', import.meta.url).pathname } },
});
