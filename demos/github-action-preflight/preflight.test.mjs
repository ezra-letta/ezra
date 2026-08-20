import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeWorkflow,
  parseGitHubRepoFromRemote,
  parseScopesFromGhAuthStatus,
} from "./preflight.mjs";

const GOOD_WORKFLOW = `
name: Letta Code
on:
  issue_comment:
    types: [created]
jobs:
  letta:
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - uses: letta-ai/letta-code-action@v0
        with:
          letta_api_key: \${{ secrets.LETTA_API_KEY }}
          github_token: \${{ secrets.GITHUB_TOKEN }}
`;

test("parses supported GitHub remote styles", () => {
  assert.equal(
    parseGitHubRepoFromRemote("https://github.com/letta-ai/letta-code.git"),
    "letta-ai/letta-code",
  );
  assert.equal(
    parseGitHubRepoFromRemote("git@github.com:letta-ai/letta-code.git"),
    "letta-ai/letta-code",
  );
  assert.equal(
    parseGitHubRepoFromRemote("ssh://git@github.com/letta-ai/letta-code.git"),
    "letta-ai/letta-code",
  );
  assert.equal(
    parseGitHubRepoFromRemote("https://gitlab.com/letta-ai/letta-code.git"),
    null,
  );
});

test("extracts scopes without retaining token text", () => {
  const status = [
    "github.com",
    "  - Token: REDACTED",
    "  - Token scopes: gist, repo, workflow",
  ].join("\n");
  assert.deepEqual(parseScopesFromGhAuthStatus(status), [
    "gist",
    "repo",
    "workflow",
  ]);
});

test("accepts the generated Letta workflow contract", () => {
  const result = analyzeWorkflow(GOOD_WORKFLOW);
  assert.equal(result.ok, true);
  assert.equal(result.checks.every((check) => check.ok), true);
});

test("reports each missing workflow requirement", () => {
  const result = analyzeWorkflow("name: incomplete\n");
  assert.equal(result.ok, false);
  assert.equal(result.checks.filter((check) => !check.ok).length, 7);
});

test("does not accept plaintext lookalikes for secret references", () => {
  const unsafe = GOOD_WORKFLOW
    .replace("${{ secrets.LETTA_API_KEY }}", "hardcoded-key")
    .replace("${{ secrets.GITHUB_TOKEN }}", "hardcoded-token");
  const result = analyzeWorkflow(unsafe);
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((check) => check.id === "api-key")?.ok, false);
  assert.equal(
    result.checks.find((check) => check.id === "github-token")?.ok,
    false,
  );
});
