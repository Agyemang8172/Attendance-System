/** Test-process credential; never import this module into browser code. */
import { assertSafeTestDatabase } from "./dbGuard.js";
import { passwordString } from "../validators/index.js";

export function resolveTestCredential(): string {
  assertSafeTestDatabase(process.env.TEST_DATABASE_URL, {
    developmentUrl: process.env.DEV_DATABASE_URL ?? process.env.DATABASE_URL,
    developmentHost: process.env.DEV_DB_HOST,
  });

  const value = process.env.ATTENDPRO_TEST_PASSWORD;
  if (!value || !passwordString.safeParse(value).success) {
    throw new Error("ATTENDPRO_TEST_PASSWORD must be supplied and satisfy the password policy.");
  }
  return value;
}
