import { defineConfig } from 'vitest/config';

// Tests de integración: pegan contra la API real (supertest) y una DB Postgres de test.
// Requieren TEST_DATABASE_URL (o DATABASE_URL, se le agrega sufijo _test) y la DB accesible.
export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    setupFiles: ['src/__tests__/integration/setup.ts'],
    // Comparten la misma DB: sin paralelismo entre archivos.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
