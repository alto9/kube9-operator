import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only - exclude database/integration tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/integration/**',
      // Exclude database integration tests
      '**/src/database/manager.test.ts',
      '**/src/database/schema.test.ts',
      '**/src/database/event-repository.test.ts',
      '**/src/database/event-repository-queries.test.ts',
      '**/src/database/retention-cleanup.test.ts',
      '**/src/database/assessment-repository.test.ts',
      '**/src/assessment/runner.integration.test.ts',
      // Exclude cleanup workaround files
      '**/zzz-final-cleanup.test.ts',
    ],
    include: ['**/*.test.ts'],
    // Fast execution for unit tests
    testTimeout: 5000,
    hookTimeout: 5000,
    // Show console output during tests
    silent: false,
    // ESM support
    globals: false,
    environment: 'node',
  },
});

