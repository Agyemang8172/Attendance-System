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
    // Phase 1's coverage target applies to the backend logic surface named in
    // the plan: controllers, middleware, jobs, utils and validators. Routes and
    // server.ts are wire-up exercised through supertest but not counted here.
    coverage: {
      provider: "v8",
      include: [
        "controllers/**/*.ts",
        "middleware/**/*.ts",
        "jobs/**/*.ts",
        "utils/**/*.ts",
        "validators/**/*.ts",
      ],
      reporter: ["text", "json"],
      // M9 release gate (plan 2026-10-18, owner decision B on 2026-10-20):
      // 90% statements and 85% branches across the backend logic surface.
      thresholds: {
        statements: 90,
        branches: 85,
      },
    },
  },
});
