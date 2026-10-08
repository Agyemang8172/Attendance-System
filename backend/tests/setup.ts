/**
 * Executes before `server.ts` is imported, so both values are in place before
 * its module body runs.
 *
 * NODE_ENV=test — server.ts skips its rate limiters under test. The login
 * limiter allows 10 attempts per 15 minutes per IP, so a second test run inside
 * that window would fail with 429 instead of exercising the code under test.
 *
 * PORT=0 — `app.listen("0")` binds an ephemeral port, so importing the app for
 * supertest never contends with a real server on 8000.
 *
 * Neither value is written back to .env; dotenv will not override them.
 */
process.env.NODE_ENV = "test";
process.env.PORT = "0";
