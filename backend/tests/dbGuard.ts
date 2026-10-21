/**
 * Fail-closed test-database guard.
 *
 * The automated suite once shared the development database, so every run
 * scattered synthetic accounts into it (532 of them at the last count). This
 * module is the gate that stops that happening again: it runs before any test
 * file imports Prisma, and it refuses to continue unless the target is the
 * database the developer deliberately declared as the test database.
 *
 * The check is positive verification, not a guess. A matching host or a
 * `_test` name suffix on its own proves nothing, so the guard requires the
 * caller to state the expected host (TEST_DB_HOST) and the exact database name
 * (TEST_DB_NAME) up front, then compares the connection URL against both. On
 * top of that exact match it rejects the shared development target by name,
 * by host and by URL, and it rejects a managed Prisma host outright.
 *
 * Called from:
 *   - tests/setup.ts          (before fixtures or test writes)
 *   - scripts/test-db.ts      (before migrations or a guarded reset)
 */
import { URL } from "node:url";

export type TestTarget = {
  host: string;
  port: string;
  database: string;
};

type GuardOptions = {
  /** The development connection string to reject (defaults to DATABASE_URL). */
  developmentUrl?: string;
  /** The development host to reject (defaults to DEV_DB_HOST). */
  developmentHost?: string;
};

const DEFAULT_PORT = "5432";

const parseTarget = (rawUrl: string): TestTarget => {
  const url = new URL(rawUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return {
    host: url.hostname,
    port: url.port || DEFAULT_PORT,
    database,
  };
};

const describeTarget = (target: TestTarget): string =>
  `${target.host}:${target.port}/${target.database}`;

/**
 * Throws unless `rawUrl` is positively verified as the declared test database.
 * Returns the sanitized target (host, port, database) for logging. The password
 * is never part of the returned value.
 */
export const assertSafeTestDatabase = (
  rawUrl: string | undefined,
  options: GuardOptions = {}
): TestTarget => {
  const refuse = (reason: string): never => {
    throw new Error(
      `[db-guard] REFUSED: ${reason}\n` +
        `[db-guard] Tests and migrations only ever run against the declared test database.`
    );
  };

  if (!rawUrl || rawUrl.trim() === "") {
    return refuse("TEST_DATABASE_URL is not set.");
  }

  let target: TestTarget;
  try {
    target = parseTarget(rawUrl.trim());
  } catch {
    return refuse("TEST_DATABASE_URL is not a valid connection URL.");
  }

  const expectedHost = process.env.TEST_DB_HOST?.trim();
  const expectedName = process.env.TEST_DB_NAME?.trim();

  if (!expectedHost) {
    return refuse(
      "TEST_DB_HOST is not set, so the guard cannot verify the target host."
    );
  }
  if (!expectedName) {
    return refuse(
      "TEST_DB_NAME is not set, so the guard cannot verify the target name."
    );
  }

  // Positive verification: exact match against the declared target.
  if (target.host !== expectedHost) {
    return refuse(
      `host "${target.host}" does not match TEST_DB_HOST "${expectedHost}".`
    );
  }
  if (target.database !== expectedName) {
    return refuse(
      `database "${target.database}" does not match TEST_DB_NAME "${expectedName}".`
    );
  }

  // Defence in depth beyond the exact match.
  if (!expectedName.endsWith("_test")) {
    return refuse(`TEST_DB_NAME "${expectedName}" does not end in "_test".`);
  }
  if (target.database === "postgres") {
    return refuse(`database "postgres" is the shared development database name.`);
  }
  if (target.host.endsWith("prisma.io")) {
    return refuse(
      `host "${target.host}" is a managed Prisma host, never the local test database.`
    );
  }

  // Reject the development target even if it carries a matching name.
  const developmentUrl = options.developmentUrl ?? process.env.DATABASE_URL;
  if (developmentUrl && developmentUrl.trim() !== "") {
    if (developmentUrl.trim() === rawUrl.trim()) {
      return refuse(
        "TEST_DATABASE_URL equals DATABASE_URL, so tests would run against the development database."
      );
    }
    try {
      const dev = parseTarget(developmentUrl.trim());
      if (dev.host === target.host && dev.database === target.database) {
        return refuse(
          "TEST_DATABASE_URL resolves to the same host and database as DATABASE_URL."
        );
      }
    } catch {
      // An unparseable DATABASE_URL cannot be a colliding target; the exact
      // match and the declared checks above already cover this URL.
    }
  }

  const developmentHost =
    options.developmentHost ?? process.env.DEV_DB_HOST?.trim();
  if (developmentHost && target.host === developmentHost) {
    return refuse(
      `host "${target.host}" is the declared development host (DEV_DB_HOST).`
    );
  }

  return target;
};

export { describeTarget };
