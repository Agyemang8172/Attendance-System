import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import securityHeaders from "./middleware/securityHeaders.js";
import { logger, correlationIdMiddleware, requestLogger, logError } from "./utils/logger.js";
import { setupSwagger } from "./docs/swagger.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8000;

// ── Security Headers ─────────────────────────────────────────────────────────

// First, so every response carries them — including error responses, which are
// the ones most likely to be reflected back at a browser.
app.use(securityHeaders);

// ── Logging & Correlation ID Middleware ────────────────────────────────────────

app.use(correlationIdMiddleware);
app.use(requestLogger);

// ── Swagger API Documentation ──────────────────────────────────────────────────

setupSwagger(app);

// ── Middleware ──────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10kb" }));

// Strict CORS — only allow specific origins
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  process.env.CORS_ORIGIN || "",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Rate Limiting ─────────────────────────────────────────────────────────────

import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * D9 — a limiter keyed on the account as well as the address.
 *
 * The IP limiter above cannot see the difference between one person trying one
 * password ten times and ten people behind the same office NAT trying ten
 * different accounts. It also stops mattering the moment an attacker rotates
 * addresses. This one bounds guesses against a single account however many
 * sources they come from, which is the axis a credential attack actually runs
 * along.
 */
const accountAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: (req) =>
    `account:${String(req.body?.email || "").toLowerCase()}:${req.ip}`,
  message: {
    success: false,
    message: "Too many sign-in attempts for this account, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // The library validates that keyGenerator output is a bare IP against its
  // IPv6 subnet rules and throws during construction when it is not. This key
  // deliberately joins an address to an email, so that check cannot apply.
  validate: false,
});

// Rate limiting is disabled under test: the login limiter allows 10 attempts
// per 15 minutes per IP, so a second test run inside that window would return
// 429 before reaching the code under test.
if (process.env.NODE_ENV !== "test") {
  app.use("/api/", limiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/login", accountAuthLimiter);
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    const { prisma } = await import("./config/prismaClient.js");
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

// ── Global Error Handler ─────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const correlationId = (req as any).correlationId || "unknown";

    logError(err, {
      correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    if (err.message === "Not allowed by CORS") {
      res.status(403).json({ message: "Origin not allowed" });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
);

// ── Start Server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server started");
});

export default app;