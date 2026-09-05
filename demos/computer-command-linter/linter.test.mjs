import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { formatHuman, lintText, run } from "./linter.mjs";

test("detects every released compatibility spelling", () => {
  const findings = lintText(`
letta environments list --online-only
letta envs current
letta -p --environment cloud "work"
letta -p --env runner-1 "work"
letta server --env-name runner-1
`, "commands.sh");

  assert.deepEqual(
    findings.map(({ line, legacy, replacement }) => ({ line, legacy, replacement })),
    [
      { line: 2, legacy: "letta environments", replacement: "letta computers" },
      { line: 3, legacy: "letta envs", replacement: "letta computers" },
      { line: 4, legacy: "--environment", replacement: "--computer" },
      { line: 5, legacy: "--env", replacement: "--computer" },
      { line: 6, legacy: "--env-name", replacement: "--computer-name" },
    ],
  );
});

test("does not flag canonical commands or longer unrelated words", () => {
  assert.deepEqual(
    lintText(`
letta computers list --online-only
letta -p --computer cloud "work"
letta server --computer-name runner-1
echo --environmental --envelope
my-letta environments list
`, "clean.sh"),
    [],
  );
});

test("does not confuse other canonical --env flags with computer routing", () => {
  assert.deepEqual(
    lintText(`
letta secret set GITHUB_TOKEN --env SOURCE_TOKEN
letta mcp call tool --env REGION=us-west-2
/mods learn --env ./environment.json
`, "other-env-commands.sh"),
    [],
  );
});

test("reports multiple findings on one line in column order", () => {
  const findings = lintText(
    "letta environments list && letta -p --env cloud work",
    "one-line.sh",
  );
  assert.deepEqual(findings.map(({ column, legacy }) => ({ column, legacy })), [
    { column: 1, legacy: "letta environments" },
    { column: 37, legacy: "--env" },
  ]);
});

test("formats clean and finding output", () => {
  assert.equal(formatHuman([]), "No legacy Letta remote-routing spellings found.");
  assert.equal(
    formatHuman(lintText("letta envs current", "ops.sh")),
    "ops.sh:1:1  letta envs  →  letta computers",
  );
});

test("run emits JSON and uses finding exit code", async () => {
  let output = "";
  const code = await run(["--json", "commands.sh"], {
    stdout: { write: (text) => { output += text; } },
    stderr: { write: () => {} },
    readFile: async () => "letta server --env-name office-mac",
  });

  assert.equal(code, 1);
  const parsed = JSON.parse(output);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.findings[0].replacement, "--computer-name");
});

test("CLI scans the sample and returns one for findings", () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const result = spawnSync(
    process.execPath,
    ["linter.mjs", "fixtures/legacy-commands.sh"],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stdout, /letta environments  →  letta computers/);
  assert.match(result.stdout, /--env-name  →  --computer-name/);
  assert.equal(result.stderr, "");
});

test("run returns two for missing input and read failures", async () => {
  let errorOutput = "";
  assert.equal(
    await run([], {
      stdout: { write: () => {} },
      stderr: { write: (text) => (errorOutput += text) },
    }),
    2,
  );
  assert.match(errorOutput, /Usage:/);

  errorOutput = "";
  assert.equal(
    await run(["missing.sh"], {
      stdout: { write: () => {} },
      stderr: { write: (text) => (errorOutput += text) },
      readFile: async () => {
        throw new Error("not found");
      },
    }),
    2,
  );
  assert.match(errorOutput, /not found/);
});
