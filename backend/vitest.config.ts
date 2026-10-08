import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Serial execution: these are integration tests against one local database
    // and one IP-scoped rate limiter. Running tests concurrently makes results
    // depend on scheduling rather than on the code under test, and exhausts the
    // Prisma connection pool.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
