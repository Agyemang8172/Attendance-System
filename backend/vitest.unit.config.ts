import { defineConfig } from "vitest/config";

// Controller contracts deliberately exclude the integration setup and database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.contract.test.ts"],
    setupFiles: [],
    fileParallelism: false,
  },
});
