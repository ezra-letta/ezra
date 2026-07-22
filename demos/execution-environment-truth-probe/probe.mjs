import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir, hostname, platform, arch, release } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";

export function redactHome(value, home = homedir()) {
  if (!value || !home) return value;
  if (value === home) return "~";
  const isInsideHome = ["/", "\\"].some((separator) =>
    value.startsWith(`${home}${separator}`),
  );
  return isInsideHome ? `~${value.slice(home.length)}` : value;
}

export function findExecutable(name, envPath = process.env.PATH ?? "") {
  const suffixes = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const directory of envPath.split(delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const candidate = join(directory, `${name}${suffix}`);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Continue searching PATH.
      }
    }
  }
  return null;
}

function run(command, args, cwd, timeout = 3_000) {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout,
      }).trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { ok: false, output: null, error: message };
  }
}

function inspectGit(cwd) {
  const root = run("git", ["rev-parse", "--show-toplevel"], cwd);
  if (!root.ok) return { repository: false };
  const branch = run("git", ["branch", "--show-current"], cwd);
  const status = run("git", ["status", "--short"], cwd);
  return {
    repository: true,
    root: redactHome(root.output),
    branch: branch.ok && branch.output ? branch.output : null,
    clean: status.ok ? status.output.length === 0 : null,
  };
}

function inspectLetta(cwd) {
  const executable = findExecutable("letta");
  if (!executable) return { found: false, path: null, version: null };
  const version = run(executable, ["--version"], cwd);
  return {
    found: true,
    path: redactHome(executable),
    version: version.ok ? version.output : null,
    versionCheckError: version.ok ? null : version.error,
  };
}

export function buildReport({ cwd = process.cwd(), includeIds = false } = {}) {
  const hostHash = createHash("sha256").update(hostname()).digest("hex").slice(0, 12);
  const ids = {
    agentIdPresent: Boolean(process.env.AGENT_ID),
    conversationIdPresent: Boolean(process.env.CONVERSATION_ID),
  };
  if (includeIds) {
    ids.agentId = process.env.AGENT_ID ?? null;
    ids.conversationId = process.env.CONVERSATION_ID ?? null;
  }

  return {
    generatedAt: new Date().toISOString(),
    observedToolProcess: {
      platform: platform(),
      release: release(),
      architecture: arch(),
      node: process.version,
      hostFingerprint: hostHash,
      cwd: redactHome(cwd),
      home: "~",
    },
    lettaCli: inspectLetta(cwd),
    git: inspectGit(cwd),
    runtimeContext: ids,
    selectedEnvironment: {
      value: "not detectable by this probe",
      action: "Record the environment/device selected in the Letta app or CLI separately.",
    },
    interpretation: [
      "Observed tool-process facts describe where this script ran.",
      "Injected sandbox labels and the selected execution environment are separate signals.",
      "API endpoint variables are deliberately excluded because they do not identify where tools execute.",
    ],
  };
}

function printHuman(report) {
  console.log("Letta execution-environment fact packet\n");
  console.log(`Tool process: ${report.observedToolProcess.platform} ${report.observedToolProcess.architecture} (${report.observedToolProcess.hostFingerprint})`);
  console.log(`Working directory: ${report.observedToolProcess.cwd}`);
  console.log(`Letta CLI: ${report.lettaCli.found ? `${report.lettaCli.version ?? "version check failed"} at ${report.lettaCli.path}` : "not found on PATH"}`);
  console.log(`Git: ${report.git.repository ? `${report.git.branch ?? "detached"}, ${report.git.clean ? "clean" : "changes present"}` : "not a repository"}`);
  console.log(`Selected environment: ${report.selectedEnvironment.value}`);
  console.log(`Next: ${report.selectedEnvironment.action}`);
  console.log("\nUse --json for a support-ready JSON packet. Add --include-ids only when sharing IDs in a trusted support channel.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const includeIds = process.argv.includes("--include-ids");
  const report = buildReport({ includeIds });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
}
