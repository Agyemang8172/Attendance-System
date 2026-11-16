import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runWithTenant, currentTenant } from "../utils/tenantContext.js";
import prisma from "../config/prismaClient.js";

/**
 * The tenant store is the input every RLS transaction reads. These checks pin
 * the two properties the middleware relies on: the value survives awaits, and
 * it is gone once the request's callback finishes.
 */
describe("tenant context", () => {
  it("keeps the tenant across async work and clears it afterwards", async () => {
    expect(currentTenant()).toBeUndefined();

    const seen = await runWithTenant("business-a", async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 1));
      return currentTenant();
    });

    expect(seen).toBe("business-a");
    expect(currentTenant()).toBeUndefined();
  });

  it("keeps concurrent requests in separate stores", async () => {
    const [first, second] = await Promise.all([
      runWithTenant("business-a", async () => {
        await Promise.resolve();
        return currentTenant();
      }),
      runWithTenant("business-b", async () => {
        await Promise.resolve();
        return currentTenant();
      }),
    ]);

    expect(first).toBe("business-a");
    expect(second).toBe("business-b");
  });

  it("refuses the array form of $transaction", async () => {
    await expect(prisma.$transaction([] as never)).rejects.toThrow(
      /Array-form \$transaction is not supported/
    );
  });
});

describe("verify-auth database selection", () => {
  it("removes an external app URL before importing Prisma-backed modules", () => {
    const source = readFileSync(
      new URL("../scripts/verify-auth.ts", import.meta.url),
      "utf8"
    );
    const selectGuardedDatabase = source.indexOf(
      "process.env.DATABASE_URL = testDatabaseUrl;"
    );
    const removeExternalAppDatabase = source.indexOf(
      "delete process.env.DATABASE_URL_APP;"
    );
    const firstPrismaBackedImport = source.indexOf(
      'await import("../tests/fixtures.js")'
    );

    expect(selectGuardedDatabase).toBeGreaterThan(-1);
    expect(removeExternalAppDatabase).toBeGreaterThan(selectGuardedDatabase);
    expect(firstPrismaBackedImport).toBeGreaterThan(removeExternalAppDatabase);
  });
});
