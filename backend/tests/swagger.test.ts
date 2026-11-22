import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { setupLazySwagger } from "../server.js";

const observations = vi.hoisted(() => ({ imports: 0, setups: 0 }));
vi.mock("../docs/swagger.js", async (importOriginal) => {
  observations.imports++;
  const actual = await importOriginal<typeof import("../docs/swagger.js")>();
  return {
    ...actual,
    setupSwagger: (...args: Parameters<typeof actual.setupSwagger>) => {
      observations.setups++;
      return actual.setupSwagger(...args);
    },
  };
});

describe("lazy Swagger initialization", () => {
  it("does not load documentation for production or unrelated requests", async () => {
    const production = express();
    setupLazySwagger(production, "production");
    for (const path of ["/api/docs", "/api/docs/", "/api/docs.json", "/api/docs/swagger-ui.css"]) {
      expect((await request(production).get(path)).status).toBe(404);
    }
    const development = express();
    setupLazySwagger(development, "development");
    expect((await request(development).get("/api/docs-other")).status).toBe(404);
    expect(observations.imports).toBe(0);
    expect(observations.setups).toBe(0);
  });

  it("shares first-request initialization and preserves the UI and OpenAPI contract", async () => {
    const app = express();
    setupLazySwagger(app, "development");
    const [ui, spec] = await Promise.all([
      request(app).get("/api/docs/"),
      request(app).get("/api/docs.json?download=1"),
    ]);
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("Attendance System API Docs");
    expect(spec.status).toBe(200);
    expect(spec.type).toBe("application/json");
    expect(spec.body.openapi).toBe("3.0.3");
    expect(spec.body.info.title).toBe("Attendance System API");
    expect(observations.imports).toBe(1);
    expect(observations.setups).toBe(1);
    const redirect = await request(app).get("/api/docs");
    expect(redirect.status).toBe(301);
    expect(redirect.headers.location).toBe("/api/docs/");
    const css = await request(app).get("/api/docs/swagger-ui.css");
    expect(css.status).toBe(200);
    expect(css.type).toBe("text/css");
    const init = await request(app).get("/api/docs/swagger-ui-init.js");
    expect(init.status).toBe(200);
    expect(init.text).toContain('"persistAuthorization": true');
    expect(init.text).toContain('"displayRequestDuration": true');
    expect((await request(app).get("/API/DOCS.JSON/")).status).toBe(200);
    expect((await request(app).get("/API/DOCS/")).status).toBe(200);
    expect(observations.setups).toBe(1);
  });
});
