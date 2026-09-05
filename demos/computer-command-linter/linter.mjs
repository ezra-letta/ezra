#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

function isHeadlessLettaCommand(line) {
  return (
    /(?<![\w-])letta\b/.test(line) &&
    /(?:^|\s)(?:-p|--agent|--conversation|--conv|--from-agent)(?=\s|=|$)/.test(line)
  );
}

const RULES = [
  {
    id: "environments-subcommand",
    pattern: /(?<![\w-])letta\s+(?:environments|envs)\b/g,
    replacement: "letta computers",
  },
  {
    id: "environment-selector",
    pattern: /--environment(?![\w-])|--env(?![\w-])/g,
    replacement: "--computer",
    when: isHeadlessLettaCommand,
  },
  {
    id: "environment-name",
    pattern: /--env-name(?![\w-])/g,
    replacement: "--computer-name",
  },
];

export function lintText(text, file = "<stdin>") {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [lineIndex, line] of lines.entries()) {
    for (const rule of RULES) {
      if (rule.when && !rule.when(line)) continue;
      rule.pattern.lastIndex = 0;
      for (const match of line.matchAll(rule.pattern)) {
        findings.push({
          file,
          line: lineIndex + 1,
          column: (match.index ?? 0) + 1,
          rule: rule.id,
          legacy: match[0],
          replacement: rule.replacement,
        });
      }
    }
  }

  return findings.sort(
    (a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule),
  );
}

export function formatHuman(findings) {
  if (findings.length === 0) {
    return "No legacy Letta remote-routing spellings found.";
  }

  return findings
    .map(
      (finding) =>
        `${finding.file}:${finding.line}:${finding.column}  ` +
        `${finding.legacy}  →  ${finding.replacement}`,
    )
    .join("\n");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function usage() {
  return `Usage:
  node linter.mjs [--json] <file...>
  cat script.sh | node linter.mjs [--json] -

Exit codes:
  0  no legacy spellings
  1  legacy spellings found
  2  input or usage error`;
}

export async function run(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const loadFile = io.readFile ?? ((file) => readFile(file, "utf8"));
  const loadStdin = io.readStdin ?? readStdin;

  let json = false;
  const files = [];
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") {
      stdout.write(`${usage()}\n`);
      return 0;
    } else if (arg.startsWith("-") && arg !== "-") {
      stderr.write(`Unknown option: ${arg}\n${usage()}\n`);
      return 2;
    } else files.push(arg);
  }

  if (files.length === 0) {
    stderr.write(`${usage()}\n`);
    return 2;
  }

  const findings = [];
  let usedStdin = false;
  try {
    for (const file of files) {
      if (file === "-") {
        if (usedStdin) throw new Error("stdin may be read only once");
        usedStdin = true;
        findings.push(...lintText(await loadStdin(), "<stdin>"));
      } else {
        findings.push(...lintText(await loadFile(file), file));
      }
    }
  } catch (error) {
    stderr.write(`Unable to read input: ${error instanceof Error ? error.message : error}\n`);
    return 2;
  }

  if (json) {
    stdout.write(`${JSON.stringify({ findings, count: findings.length }, null, 2)}\n`);
  } else {
    stdout.write(`${formatHuman(findings)}\n`);
  }
  return findings.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await run(process.argv.slice(2));
}
