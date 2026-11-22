import { PrismaClient, Prisma } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { currentTenant } from "../utils/tenantContext.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: resolve(__dirname, "../../.env"),
});

/**
 * Two clients, two roles (SEC-07, M1-ARCHITECTURE §3.1).
 *
 * `DATABASE_URL` belongs to the owner role. Migrations, tests and the seed use
 * it; it bypasses RLS because it owns the tables.
 *
 * `DATABASE_URL_APP` belongs to `attendpro_app`, which is subject to every
 * tenant policy. The running API uses it. In production an unset app URL, or
 * one that names the same role as the owner, is a startup failure rather than
 * a silent fallback to the bypassing role.
 *
 * Development and test keep the fallback so a machine without the two-role
 * split still runs. The fallback is logged once, not hidden.
 */
const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) {
  throw new Error("DATABASE_URL is not set");
}

const configuredAppUrl = process.env.DATABASE_URL_APP?.trim();
if (process.env.NODE_ENV === "production") {
  if (!configuredAppUrl) {
    throw new Error("DATABASE_URL_APP is required in production");
  }
  try {
    const ownerRole = new URL(ownerUrl).username;
    const appRole = new URL(configuredAppUrl).username;
    if (ownerRole === appRole) {
      throw new Error(
        "DATABASE_URL_APP must connect as a different role than DATABASE_URL"
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("must connect")) {
      throw error;
    }
    // A URL shape the platform does not parse is not a reason to guess; the
    // database still enforces the policy on whatever role the URL names.
  }
}

const appUrl = configuredAppUrl || ownerUrl;
const usingOwnerFallback = appUrl === ownerUrl;

const buildClient = (connectionString: string): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prismaProxy?: PrismaClient;
  prismaApp?: PrismaClient;
  prismaOwner?: PrismaClient;
};

/** Owner connection. Explicitly unscoped; only named call sites may use it. */
export const prismaUnscoped: PrismaClient =
  globalForPrisma.prismaOwner ?? buildClient(ownerUrl);

const appPrisma: PrismaClient =
  globalForPrisma.prismaApp ?? buildClient(appUrl);

/**
 * The model delegate keys on the client (`user`, `attendance`, `auditLog`, …).
 * Anything starting with `$` is a client method and is handled separately.
 */
const MODEL_KEYS = new Set(
  Object.keys(Prisma.ModelName).map(
    (name) => name.charAt(0).toLowerCase() + name.slice(1)
  )
);

const PASSTHROUGH = new Set([
  "$connect",
  "$disconnect",
  "$on",
  "$extends",
  "$use",
]);

const TENANT_TRANSACTION_OPTIONS = {
  maxWait: 5_000,
  timeout: 15_000,
};

/**
 * The test suite runs on a single owner connection with no `attendpro_app`
 * role. Wrapping each of its queries in a transaction would buy no isolation
 * and would make the 590-test suite several times slower, so the fallback is
 * left alone in test. Development keeps the production shape on purpose.
 */
const skipTenantTransaction =
  usingOwnerFallback && process.env.NODE_ENV === "test";

/**
 * Run one operation against the app role with `app.business_id` set for the
 * life of a short transaction. With no tenant in scope the operation still
 * runs — the policies then return zero rows, which is the fail-closed answer
 * for a path that forgot to establish one (login uses the SECURITY DEFINER
 * lookup instead, and kiosk token resolution deliberately uses the owner
 * client because the tenant is what it is trying to discover).
 */
const withTenant = async <T>(
  operation: (client: PrismaClient | Prisma.TransactionClient) => Promise<T>
): Promise<T> => {
  const tenant = currentTenant();
  if (!tenant || skipTenantTransaction) {
    return operation(appPrisma);
  }

  return appPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.business_id', ${tenant}, true)`;
    return operation(tx);
  }, TENANT_TRANSACTION_OPTIONS);
};

const tenantProxy = new Proxy(appPrisma, {
  get(target, prop, receiver) {
    if (prop === "$transaction") {
      return async (
        input: unknown,
        options?: { maxWait?: number; timeout?: number }
      ) => {
        // Every caller in this codebase uses the interactive form. The array
        // form cannot carry a preceding SET inside the same transaction, so
        // it is refused rather than run unscoped.
        if (typeof input !== "function") {
          throw new Error(
            "Array-form $transaction is not supported under tenant scoping"
          );
        }

        const tenant = currentTenant();
        return appPrisma.$transaction(
          async (tx) => {
            if (tenant && !skipTenantTransaction) {
              await tx.$executeRaw`SELECT set_config('app.business_id', ${tenant}, true)`;
            }
            return (input as (client: Prisma.TransactionClient) => Promise<unknown>)(tx);
          },
          { ...TENANT_TRANSACTION_OPTIONS, ...(options ?? {}) }
        );
      };
    }

    if (typeof prop === "string" && PASSTHROUGH.has(prop)) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    }

    const value = Reflect.get(target, prop, receiver) as unknown;

    if (typeof value === "function") {
      return (...args: unknown[]) =>
        withTenant((client) => (client as unknown as Record<string, Function>)[prop as string](...args));
    }

    if (typeof prop === "string" && MODEL_KEYS.has(prop) && value && typeof value === "object") {
      return new Proxy(value as Record<string, unknown>, {
        get(delegate, method) {
          const fn = Reflect.get(delegate, method) as unknown;
          if (typeof fn !== "function") return fn;
          return (...args: unknown[]) =>
            withTenant(
              (client) =>
                (client as unknown as Record<string, Record<string, Function>>)[prop][method as string](
                  ...args
                )
            );
        },
      });
    }

    return value;
  },
}) as PrismaClient;

/**
 * The default client every controller imports. It is the app role plus the
 * tenant proxy; it is never the owner connection.
 */
export const prisma: PrismaClient = globalForPrisma.prismaProxy ?? tenantProxy;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaProxy = prisma;
  globalForPrisma.prismaApp = appPrisma;
  globalForPrisma.prismaOwner = prismaUnscoped;
  if (usingOwnerFallback) {
    // One line, once per process. The pilot runs the two-role split; local
    // development without it should not look like a broken login.
    console.warn(
      "[prisma] DATABASE_URL_APP is unset; development/test is using DATABASE_URL (RLS bypass role)."
    );
  }
}

export default prisma;
