import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests only - database tests
    include: [
      '**/src/database/manager.test.ts',
      '**/src/database/schema.test.ts',
      '**/src/database/event-repository.test.ts',
      '**/src/database/event-repository-queries.test.ts',
      '**/src/database/retention-cleanup.test.ts',
      '**/src/database/assessment-repository.test.ts',
      '**/src/assessment/runner.integration.test.ts',
    ],
    // Longer timeouts for database operations
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests serially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Show console output during tests
    silent: false,
    // ESM support
    globals: false,
    environment: 'node',
  },
});

