/**
 * M9 — direct unit coverage for the small infrastructure utilities.
 *
 * The HTTP suites exercise the happy path of every controller but never the
 * middleware's own edges: a rate-limit window rolling over, the tracking-map
 * cap, a slow request log, a failed response log, and the error/audit helper
 * calls. These are unit tests with fake req/res objects because there is no
 * route that can reach them deterministically.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createRateLimiter } from "../utils/rateLimit.js";
import { requestLogger, logError, auditLog } from "../utils/logger.js";

type FakeRes = Response & {
  statusCode: number;
  body: unknown;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
};

function fakeRes(): FakeRes {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    get: vi.fn(() => "0"),
    setHeader: vi.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send.mockImplementation(() => res);
  return res as unknown as FakeRes;
}

function fakeReq(overrides: Partial<Record<string, unknown>> = {}): Request {
  return {
    method: "GET",
    url: "/test",
    ip: "127.0.0.1",
    headers: {},
    user: undefined,
    body: {},
    query: {},
    params: {},
    get: () => "vitest",
    log: undefined,
    ...overrides,
  } as unknown as Request;
}

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createRateLimiter", () => {
  it("lets every request through in the test environment", () => {
    process.env.NODE_ENV = "test";
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, keyer: () => "k" });
    const next = vi.fn();
    for (let i = 0; i < 20; i++) limiter(fakeReq(), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(20);
  });

  it("counts per key, trips at max and falls back to 'unknown' for an empty key", () => {
    process.env.NODE_ENV = "development";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyer: () => "" });
    const next = vi.fn();
    const res = fakeRes();

    limiter(fakeReq(), res, next);
    limiter(fakeReq(), res, next);
    limiter(fakeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: "Too many requests, please try again later.",
    });
  });

  it("uses the caller's key and custom message", () => {
    process.env.NODE_ENV = "development";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyer: (req: Request) => (req.ip as string) || "",
      message: { success: false, message: "Slow down" },
    });
    const next = vi.fn();
    const first = fakeReq({ ip: "10.0.0.1" });
    const second = fakeReq({ ip: "10.0.0.1" });
    const other = fakeReq({ ip: "10.0.0.2" });
    const res = fakeRes();

    limiter(first, res, next);
    limiter(second, res, next);
    limiter(other, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ success: false, message: "Slow down" });
  });

  it("starts a fresh window after the old one lapses", () => {
    process.env.NODE_ENV = "development";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, keyer: () => "k" });
    const next = vi.fn();

    limiter(fakeReq(), fakeRes(), next);
    limiter(fakeReq(), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    limiter(fakeReq(), fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("prunes the oldest entries when the tracking map reaches its cap", () => {
    process.env.NODE_ENV = "development";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyer: (req: Request) => (req.headers["x-key"] as string) ?? "",
    });
    const next = vi.fn();
    for (let i = 0; i < 5001; i++) {
      limiter(fakeReq({ headers: { "x-key": `key-${i}` } }), fakeRes(), next);
    }
    expect(next).toHaveBeenCalledTimes(5001);
  });
});

describe("requestLogger", () => {
  it("logs the incoming request, the slow-path warning and the error body", () => {
    const warn = vi.fn();
    const info = vi.fn();
    const res = fakeRes();
    const req = fakeReq({ log: { info, warn } });
    const next = vi.fn();

    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValue(2500);
    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ url: "/test" }), "Incoming request");

    res.statusCode = 500;
    res.send("failure body");

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/test" }),
      "Slow request detected"
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, body: "failure body" }),
      "Request error"
    );
  });

  it("does not warn for a fast, successful response", () => {
    const warn = vi.fn();
    const res = fakeRes();
    const req = fakeReq({ log: { info: vi.fn(), warn } });
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValue(1005);
    requestLogger(req, res, vi.fn());

    res.statusCode = 200;
    res.send("ok");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("log helpers", () => {
  it("writes a structured application error", () => {
    expect(() => logError(new Error("boom"), { route: "unit" })).not.toThrow();
  });

  it("writes the rejected-login and clock-in audit events", () => {
    expect(() => auditLog.loginRejected("nobody@example.com", "127.0.0.1")).not.toThrow();
    expect(() => auditLog.loginRejected("nobody@example.com", "127.0.0.1", "inactive")).not.toThrow();
    expect(() => auditLog.clockIn("user-1", "attendance-1", "127.0.0.1")).not.toThrow();
  });
});
