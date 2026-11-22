import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const testUrl = "postgresql://test@localhost:5433/attendpro_test";
const developmentUrl = "postgresql://dev@dev.invalid:5432/development";
const setupModule = new URL("../setup.ts", import.meta.url).href;
const guardModule = new URL("../dbGuard.ts", import.meta.url).href;

const runIsolated = (code: string): boolean => {
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", code],
    {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: {
        ...process.env,
        NODE_ENV: "test",
        TEST_DATABASE_URL: testUrl,
        TEST_DB_HOST: "localhost",
        TEST_DB_NAME: "attendpro_test",
        DATABASE_URL: developmentUrl,
        DEV_DATABASE_URL: developmentUrl,
        DEV_DB_HOST: "",
        DATABASE_URL_APP: "postgresql://app@managed.invalid:5432/development",
      },
      encoding: "utf8",
      timeout: 15000,
    }
  );

  // Never include child output in failures: it could contain inherited config.
  expect(child.error?.name).toBeUndefined();
  expect(child.status).toBe(0);
  return child.stdout.trim().split("\n").at(-1) === "true";
};

it("removes an external app URL only after verifying the isolated test target", () => {
  expect(
    runIsolated(`
      await import(${JSON.stringify(setupModule)});
      console.log(process.env.DATABASE_URL === ${JSON.stringify(testUrl)} &&
        process.env.DATABASE_URL_APP === undefined);
    `)
  ).toBe(true);
});

it.each(["host", "hostaddr", "port", "dbname", "service", "unknown"])(
  "refuses a %s query override without exposing its value",
  (key) => {
    const url = `${testUrl}?${key}=private-override-value`;
    expect(
      runIsolated(`
        const { assertSafeTestDatabase } = await import(${JSON.stringify(guardModule)});
        let refusal = "";
        try {
          assertSafeTestDatabase(${JSON.stringify(url)}, {
            developmentUrl: ${JSON.stringify(developmentUrl)},
          });
        } catch (error) {
          refusal = String(error);
        }
        console.log(/TEST_DATABASE_URL is not a valid connection URL/.test(refusal) &&
          !refusal.includes("private-override-value"));
      `)
    ).toBe(true);
  }
);

it("accepts a schema-only query parameter for the declared test target", () => {
  expect(
    runIsolated(`
      const { assertSafeTestDatabase } = await import(${JSON.stringify(guardModule)});
      const target = assertSafeTestDatabase(${JSON.stringify(`${testUrl}?schema=public`)}, {
        developmentUrl: ${JSON.stringify(developmentUrl)},
      });
      console.log(target.host === "localhost" && target.port === "5433" &&
        target.database === "attendpro_test");
    `)
  ).toBe(true);
});
