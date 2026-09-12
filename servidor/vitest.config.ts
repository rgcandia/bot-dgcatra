import { defineConfig } from 'vitest/config';

// Tests unitarios (sin DB). Los de integración van con vitest.integration.config.ts
export default defineConfig({
  test: {
    include: ['src/__tests__/*.test.ts'],
    // dist/ queda excluido: antes se compilaban los tests a dist y se corrían duplicados.
    exclude: ['node_modules/**', 'dist/**'],
  },
});
