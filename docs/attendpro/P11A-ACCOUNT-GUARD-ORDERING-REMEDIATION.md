# Proposal A — Account controller guard-ordering remediation

Prepared on 2026-11-10 after P11.1 was accepted; approved and implemented on 2026-11-14. The scope stayed limited to the 23 database-backed failures that the isolated test instance exposed. No route, middleware, schema, migration or RLS file changed.

## What the failures are

The isolated test instance ran the database-backed suite for the first time on this machine. Twenty-three tests failed, all in the account controller area: five in `backend/tests/controllerGuards.test.ts` and eighteen in `backend/tests/controllerFailures.test.ts`. They were proven pre-existing by swapping the pre-P11.1 code back in and observing the same twenty-three fail.

The observable pattern was one thing: the handler answered `400` where the test expected `401`, `400 "Account has no business"`, or `500`.

## The routes and the middleware order

Every account route already applies the middleware in the correct order, and the chain answers before the controller runs:

| Route | Middleware order |
|---|---|
| `POST /api/users` | auth → password change → role (SUPERADMIN, HR) → validate |
| `PUT /api/users/change-password` | auth → validate |
| `PUT /api/users/:id/reset-password` | auth → password change → role (SUPERADMIN, HR) → validate |
| `GET /api/users` | auth → password change → role (SUPERADMIN, HR) → validate |
| `GET /api/users/:id` | auth → password change → role (SUPERADMIN, HR, STAFF) → validate |
| `PUT /api/users/:id` | auth → password change → role (SUPERADMIN, HR) → validate |
| `DELETE /api/users/:id` | auth → password change → role (SUPERADMIN, HR) → validate |
| `POST /api/hr/employees` | auth → password change → role (HR, SUPERADMIN) → validate |
| `PATCH /api/hr/employees/:id` | auth → password change → role (HR, SUPERADMIN) → validate |

**So an HTTP request is already answered in the right order.** An anonymous request is refused by `authMiddleware` with 401 before any body is read, and a request from an account without a business is refused by the tenant step before the work runs. The twenty-three failures come from the tests, which call the controller functions directly and so bypass that chain entirely.

## The precedence the controller layer should hold

For a direct invocation to behave like the HTTP path, the controller should apply the same order:

1. **Authentication** — is there a caller? 401.
2. **Password change** — must the caller change their password first? 403.
3. **Authorization** — is the caller an administrator, and may they act on this target? 403.
4. **Tenant** — does the caller belong to a business? 400.
5. **Validation** — is the body well formed? 400.
6. **Work** — the persistence step, whose unexpected failure is a 500.

Two gaps sat between the direct-controller tests and that order.

**A body check ran before the caller was resolved** in three account handlers:

| Handler | File and line | Check that runs first |
|---|---|---|
| `createUser` | `backend/controllers/userController.ts:150` | the create schema, before `caller(req)` |
| `updateUser` | `backend/controllers/userController.ts:177` | the update schema, before the caller |
| `resetPin` | `backend/controllers/userController.ts:251` | the reason check, before `managed(req)` |

`staffProfile.changePin` already checks for a caller before reading the PIN fields. Its failure-arm test instead supplied an authenticated shape without the `businessId` that a real request carries, so the handler correctly stopped at its business guard before reaching the mocked query. `getAllUsers` also already resolves the caller before parsing pagination.

**The tenant guard those three tests expected is inapplicable to this controller.** The message `Account has no business` is produced by controllers that call `callerBusinessId` in `backend/utils/tenant.ts`. The account controller never calls it. It resolves the actor by account id and request business together, while `users.businessId` is non-nullable. A request naming another business therefore finds no actor and answers 401. The replacement tests prove that boundary with a real administrator account and a 200 positive control for the same account in its own business.

## The three remediation options

**Option one — move the checks in the controller (recommended and implemented).** Resolve the caller and authorization before judging the body. Direct invocation now follows the same precedence as the HTTP path. The remaining eighteen failures were test-harness errors: `controllerFailures.test.ts` made `prisma.user.findUnique` throw, while the eight account handlers issue `findFirst`, and its synthetic `changePin` request lacked a business. The harness now carries a business and intercepts the actual application-client delegates.

**Option two — change the tests to call through the middleware.** The HTTP behaviour is already right, so this is the smaller change. The cost is that the handlers keep an internal order that differs from the route chain, and a future route that mounts one of them without the full chain would inherit that difference.

**Option three — align the tenant model.** Make the account controller use `callerBusinessId` like the rest of the codebase, so it can answer `400 "Account has no business"`. This is the deepest change: it adds a database round trip to every account operation and changes what a tokenless-but-authenticated account sees.

The recommendation is option one for the ordering, plus the test alignment for the failure arm. Option three is a separate decision and is not proposed here.

## Focused regression tests

- `createUser`, `updateUser` and `resetPin` are called with an anonymous request and a body that cannot pass validation, and must answer 401 rather than 400.
- Every account handler is called with a real administrator id and a mismatched business, and must answer 401. The same id with its own business must list accounts with 200, proving the business mismatch is what caused the refusal.
- The failure arm must make the query the handler actually issues throw, and the handler must answer 500. The harness intercepts both user read methods used by the nine handlers rather than assuming they all call `findUnique`.
- A body that is well formed must still produce the same result as before, so the reordering cannot change any success path.
- The existing suite for the account controller stays green: 31 mocked cases today.

## Compatibility risks

- **The observable API does not change.** The middleware chain answers first at the HTTP layer, so no client sees a different status code. The reordering only affects a direct invocation.
- **A malformed request from an authenticated caller still fails the same way**, with the same field errors and the same status code.
- **One message could change if option three is ever taken**, because the tenant refusal would move from `404 "Business not found"` to `400 "Account has no business"`. That is why option three is kept out of this scope.
- **The failure-arm change touches only test code**, but it does change what those tests prove: they would then exercise the handler's real query rather than a nearby one.
- **The scope stays inside the account controller and its two test files.** No schema, migration, RLS, route or shared middleware change is needed, and no other controller is touched.

## What this proposal does not include

No change to the authentication, authorization or validation middleware, no change to any route, no change to another controller, no schema or migration change, and no change to the P11.1 work.
