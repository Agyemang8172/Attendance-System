import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { resolveTestCredential } from "../testCredential.js";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe("isolated test credential", () => {
  const configure = () => {
    process.env.TEST_DATABASE_URL = "postgresql://localhost:55434/credential_test";
    process.env.TEST_DB_HOST = "localhost";
    process.env.TEST_DB_NAME = "credential_test";
    process.env.DEV_DATABASE_URL = "postgresql://development.invalid/development";
    process.env.DEV_DB_HOST = "development.invalid";
  };

  it("returns the supplied policy-compliant value", () => {
    configure();
    const supplied = randomBytes(24).toString("hex");
    process.env.ATTENDPRO_TEST_PASSWORD = supplied;
    expect(resolveTestCredential() === supplied).toBe(true);
  });

  it("fails closed when the credential is absent or fails policy", () => {
    configure();
    delete process.env.ATTENDPRO_TEST_PASSWORD;
    expect(() => resolveTestCredential()).toThrow();
    process.env.ATTENDPRO_TEST_PASSWORD = randomBytes(2).toString("hex");
    expect(() => resolveTestCredential()).toThrow();
  });

  it("preserves the database guard", () => {
    configure();
    process.env.ATTENDPRO_TEST_PASSWORD = randomBytes(24).toString("hex");
    process.env.TEST_DB_NAME = "unexpected_test";
    expect(() => resolveTestCredential()).toThrow();
  });
});
