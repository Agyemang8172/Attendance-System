import { Request, Response, NextFunction } from "express";

/**
 * D9 — security response headers.
 *
 * Deliberately dependency-free. `helmet` would add a package plus its
 * transitive tree for eleven headers, and its default Content-Security-Policy
 * breaks the Swagger UI this server serves at `/api/docs` by blocking the
 * inline styles and scripts that page uses. Every header set here is one that
 * cannot break a JSON API or that page.
 *
 * Content-Security-Policy is left alone for the same reason. It belongs on the
 * frontend, which is a separate origin and a separate milestone.
 */
const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Stops a response being reinterpreted as a different content type, which is
  // how a JSON endpoint becomes an XSS vector when it reflects user input.
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Refuses framing outright — clickjacking needs the page to be embeddable.
  res.setHeader("X-Frame-Options", "DENY");

  // No referrer leaks at all, rather than the default partial-leak policy.
  res.setHeader("Referrer-Policy", "no-referrer");

  // Cross-origin isolation for the API responses.
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // DNS prefetch reveals nothing about which hosts the client contacts next.
  res.setHeader("X-DNS-Prefetch-Control", "off");

  // Only under TLS, and never on localhost: a browser that sees HSTS from
  // http://localhost will pin that origin to https and lock the developer out
  // of their own server until the browser profile is cleared.
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
};

export default securityHeaders;
