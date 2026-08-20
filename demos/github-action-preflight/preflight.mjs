#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOW_CANDIDATES = [
  ".github/workflows/letta.yml",
  ".github/workflows/letta-code.yml",
];

function run(command, args, cwd) {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      error:
        typeof error?.stderr === "string" && error.stderr.trim()
          ? error.stderr.trim()
          : error?.message ?? `Failed to run ${command}`,
    };
  }
}

export function parseGitHubRepoFromRemote(remoteUrl) {
  const value = remoteUrl.trim();
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1] && match[2]) return `${match[1]}/${match[2]}`;
  }
  return null;
}

export function parseScopesFromGhAuthStatus(rawStatus) {
  const line = rawStatus
    .split(/\r?\n/)
    .find((entry) => entry.toLowerCase().includes("token scopes:"));
  if (!line) return [];
  const [, raw = ""] = line.split(/token scopes:/i);
  return raw
    .split(",")
    .map((scope) => scope.replace(/['"`]/g, "").trim())
    .filter(Boolean);
}

export function analyzeWorkflow(text) {
  const checks = [
    {
      id: "action",
      ok: /uses:\s*letta-ai\/letta-code-action@v0\b/.test(text),
      label: "uses letta-ai/letta-code-action@v0",
    },
    {
      id: "api-key",
      ok: /letta_api_key:\s*\$\{\{\s*secrets\.LETTA_API_KEY\s*\}\}/.test(
        text,
      ),
      label: "passes secrets.LETTA_API_KEY",
    },
    {
      id: "github-token",
      ok: /github_token:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/.test(
        text,
      ),
      label: "passes secrets.GITHUB_TOKEN",
    },
    {
      id: "contents-permission",
      ok: /contents:\s*write\b/.test(text),
      label: "grants contents: write",
    },
    {
      id: "issues-permission",
      ok: /issues:\s*write\b/.test(text),
      label: "grants issues: write",
    },
    {
      id: "pull-requests-permission",
      ok: /pull-requests:\s*write\b/.test(text),
      label: "grants pull-requests: write",
    },
    {
      id: "comment-trigger",
      ok: /issue_comment:\s*(?:\n|$)/.test(text),
      label: "listens for issue comments",
    },
  ];
  return { ok: checks.every((check) => check.ok), checks };
}

export function inspectRepository(cwd, commandRunner = run) {
  const findings = [];

  const git = commandRunner("git", ["rev-parse", "--show-toplevel"], cwd);
  if (!git.ok) {
    return {
      ok: false,
      repoRoot: null,
      repo: null,
      workflow: null,
      findings: [
        {
          status: "FAIL",
          check: "git repository",
          detail: "Run this command inside a Git repository.",
        },
      ],
    };
  }
  const repoRoot = git.stdout;

  const remote = commandRunner(
    "git",
    ["remote", "get-url", "origin"],
    repoRoot,
  );
  const repo = remote.ok ? parseGitHubRepoFromRemote(remote.stdout) : null;
  findings.push({
    status: repo ? "OK" : "WARN",
    check: "GitHub origin",
    detail: repo ?? "origin is missing or is not a github.com repository",
  });

  const ghVersion = commandRunner("gh", ["--version"], repoRoot);
  if (!ghVersion.ok) {
    findings.push({
      status: "FAIL",
      check: "GitHub CLI",
      detail: "gh is unavailable; install it from https://cli.github.com/",
    });
  } else {
    const auth = commandRunner(
      "gh",
      ["auth", "status", "-h", "github.com"],
      repoRoot,
    );
    if (!auth.ok) {
      findings.push({
        status: "FAIL",
        check: "GitHub authentication",
        detail: "gh is not authenticated; run: gh auth login",
      });
    } else {
      const scopes = parseScopesFromGhAuthStatus(auth.stdout);
      const missing =
        scopes.length === 0
          ? []
          : ["repo", "workflow"].filter((scope) => !scopes.includes(scope));
      findings.push({
        status: missing.length === 0 ? "OK" : "FAIL",
        check: "GitHub token scopes",
        detail:
          scopes.length === 0
            ? "gh did not expose scopes; verify repo and workflow access manually"
            : missing.length === 0
              ? "repo and workflow scopes are present"
              : `missing ${missing.join(", ")}; run: gh auth refresh -h github.com -s repo,workflow`,
      });
    }
  }

  const workflow = WORKFLOW_CANDIDATES.find((path) =>
    existsSync(resolve(repoRoot, path)),
  );
  if (!workflow) {
    findings.push({
      status: "WARN",
      check: "Letta workflow",
      detail:
        "No standard workflow found. In Letta Code, run /install-github-app to create a reviewed setup PR.",
    });
  } else {
    const analysis = analyzeWorkflow(
      readFileSync(resolve(repoRoot, workflow), "utf8"),
    );
    findings.push({
      status: analysis.ok ? "OK" : "FAIL",
      check: "Letta workflow",
      detail: workflow,
    });
    for (const check of analysis.checks) {
      findings.push({
        status: check.ok ? "OK" : "FAIL",
        check: `workflow: ${check.id}`,
        detail: check.label,
      });
    }
  }

  return {
    ok: !findings.some((finding) => finding.status === "FAIL"),
    repoRoot,
    repo,
    workflow: workflow ?? null,
    findings,
  };
}

function renderHuman(result) {
  const lines = [
    "Letta GitHub Action preflight",
    `Repository: ${result.repo ?? result.repoRoot ?? "unknown"}`,
    "",
  ];
  for (const finding of result.findings) {
    lines.push(`[${finding.status}] ${finding.check}: ${finding.detail}`);
  }
  lines.push(
    "",
    result.ok
      ? "No blocking preflight failures found. Review the workflow before merging."
      : "Blocking preflight failures found. Nothing was changed.",
  );
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const pathArg = args.find((arg) => arg !== "--json");
  const result = inspectRepository(resolve(pathArg ?? process.cwd()));
  console.log(json ? JSON.stringify(result, null, 2) : renderHuman(result));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
