import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped tenant identity (SEC-07, M10).
 *
 * The value here is a business id and nothing else. It is set once by the
 * middleware that has already authenticated the caller (session token or kiosk
 * device token) and read by the Prisma proxy in `config/prismaClient.ts` when
 * it opens the short transaction that carries `app.business_id`.
 *
 * A request-scoped store, not a request-scoped transaction: every query gets
 * its own transaction with the same setting. That costs a BEGIN/COMMIT per
 * query, and buys two things the long transaction did not have — a commit
 * happens before the response is written, and a long report cannot hold a
 * pooled connection open while it formats.
 */
export type TenantStore = {
  businessId: string;
};

const storage = new AsyncLocalStorage<TenantStore>();

/** Run `fn` (and every async continuation it starts) as one tenant. */
export const runWithTenant = <T>(businessId: string, fn: () => T): T =>
  storage.run({ businessId }, fn);

/** The current tenant, or undefined on a public path that has none yet. */
export const currentTenant = (): string | undefined =>
  storage.getStore()?.businessId;
