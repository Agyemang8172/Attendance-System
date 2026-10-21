/**
 * Local helper: set the attendpro_test password in backend/.env.
 *
 * This is a development convenience only. It never prints the password, it
 * refuses to write an empty value, and it percent-encodes the password so
 * special characters cannot corrupt the connection URL.
 *
 * Usage, from the project root or from backend/:
 *   node scripts/set-test-db-password.cjs          prompt (hidden) and write
 *   node scripts/set-test-db-password.cjs --check   report the stored length only
 *
 * It only touches backend/.env, which is gitignored.
 */
const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");

function findEnvFile() {
  const candidates = [
    path.join(process.cwd(), "backend", ".env"),
    path.join(process.cwd(), ".env"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.readFileSync(c, "utf8").includes("TEST_DB_HOST=")) return c;
    } catch {
      /* keep looking */
    }
  }
  return candidates[0];
}

const ENV_PATH = findEnvFile();

function storedPasswordLength() {
  let txt;
  try {
    txt = fs.readFileSync(ENV_PATH, "utf8");
  } catch {
    return { hasLine: false, length: 0 };
  }
  const line = txt.split(/\r?\n/).find((l) => l.startsWith("TEST_DATABASE_URL="));
  if (!line) return { hasLine: false, length: 0 };
  const value = line.slice("TEST_DATABASE_URL=".length).replace(/^["']|["']$/g, "");
  const schemeEnd = value.indexOf("://");
  const at = value.lastIndexOf("@");
  if (schemeEnd < 0 || at < 0) return { hasLine: true, length: 0 };
  const userinfo = value.slice(schemeEnd + 3, at);
  const colon = userinfo.indexOf(":");
  const password = colon >= 0 ? userinfo.slice(colon + 1) : "";
  return { hasLine: true, length: password.length };
}

if (process.argv.includes("--check")) {
  const result = storedPasswordLength();
  console.log(`env file: ${ENV_PATH}`);
  console.log(`TEST_DATABASE_URL line present: ${result.hasLine}`);
  console.log(`stored password length: ${result.length}`);
  console.log(
    result.length > 0 ? "CHECK: PASS (non-empty password stored)" : "CHECK: FAIL (password is empty)"
  );
  process.exit(result.length > 0 ? 0 : 1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl.stdoutMuted = true;
rl._writeToOutput = function (s) {
  if (this.stdoutMuted) return;
  this.output.write(s);
};

process.stdout.write("Enter password for role attendpro_test (hidden input): ");
rl.question("", (password) => {
  rl.stdoutMuted = false;
  rl.close();
  process.stdout.write("\n");

  if (!password) {
    console.log("ERROR: empty password, nothing written. Run again and type the value.");
    process.exit(1);
  }

  const encoded = encodeURIComponent(password);
  const url = `postgresql://attendpro_test:${encoded}@localhost:5432/attendpro_test?schema=public`;

  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  const index = lines.findIndex((l) => l.startsWith("TEST_DATABASE_URL="));
  const newLine = `TEST_DATABASE_URL="${url}"`;
  if (index >= 0) lines[index] = newLine;
  else lines.push(newLine);
  fs.writeFileSync(ENV_PATH, lines.join("\n"));

  const result = storedPasswordLength();
  console.log(`Wrote TEST_DATABASE_URL to ${ENV_PATH}`);
  console.log(`Password stored: ${password.length} characters (not printed).`);
  console.log(`Re-read from file: ${result.length} characters.`);
});
