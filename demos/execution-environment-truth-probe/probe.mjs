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

export function classifyBaseUrl(raw) {
  if (!raw) {
    return { kind: "unset", origin: null, interpretation: "LETTA_BASE_URL is not set." };
  }

  try {
    const parsed = new URL(raw);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
    const isLoopback = localHosts.has(parsed.hostname);
    return {
      kind: isLoopback ? "loopback" : "remote",
      origin: parsed.origin,
      interpretation: isLoopback
        ? "This may be a Desktop/app proxy. A loopback LETTA_BASE_URL does not prove tools execute on the physical computer."
        : "This points at a non-loopback API origin. It identifies an API endpoint, not necessarily the host executing tools.",
    };
  } catch {
    return {
      kind: "invalid",
      origin: null,
      interpretation: "LETTA_BASE_URL is present but is not a valid URL. Its value was not copied into this report.",
    };
  }
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
    apiEndpoint: classifyBaseUrl(process.env.LETTA_BASE_URL),
    runtimeContext: ids,
    selectedEnvironment: {
      value: "not detectable by this probe",
      action: "Record the environment/device selected in the Letta app or CLI separately.",
    },
    interpretation: [
      "Observed tool-process facts describe where this script ran.",
      "API endpoint location, injected sandbox labels, and selected execution environment are different signals.",
      "Do not infer physical locality from LETTA_BASE_URL alone.",
    ],
  };
}

function printHuman(report) {
  console.log("Letta execution-environment fact packet\n");
  console.log(`Tool process: ${report.observedToolProcess.platform} ${report.observedToolProcess.architecture} (${report.observedToolProcess.hostFingerprint})`);
  console.log(`Working directory: ${report.observedToolProcess.cwd}`);
  console.log(`Letta CLI: ${report.lettaCli.found ? `${report.lettaCli.version ?? "version check failed"} at ${report.lettaCli.path}` : "not found on PATH"}`);
  console.log(`Git: ${report.git.repository ? `${report.git.branch ?? "detached"}, ${report.git.clean ? "clean" : "changes present"}` : "not a repository"}`);
  console.log(`API endpoint: ${report.apiEndpoint.kind}${report.apiEndpoint.origin ? ` (${report.apiEndpoint.origin})` : ""}`);
  console.log(`Meaning: ${report.apiEndpoint.interpretation}`);
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
