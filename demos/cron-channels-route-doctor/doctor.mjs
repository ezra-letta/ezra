// Cron + Channels route doctor for Letta Code.
//
// Read-only diagnostic that inspects cron and channel routing configuration
// to identify silent misconfiguration that causes cron-fired sessions to
// lose MessageChannel tool scope.
//
// The doctor NEVER writes, edits, or modifies any file. It never prints
// secrets, tokens, fingerprints, or account credentials. It reads only the
// files needed for diagnosis (crons.json, routing.yaml) and reports findings
// with explicit evidence levels and per-task OK/INCONCLUSIVE status.
//
// Verified against Letta Code source at version 0.28.13+ (package.json 0.29.4).
// Source symbols cited by name, not line numbers, as they shift between versions.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

// ── Evidence levels ───────────────────────────────────────────────

/**
 * @typedef {"confirmed" | "likely" | "inconclusive" | "limitation"} EvidenceLevel
 *
 * confirmed    — direct file/process evidence proves the finding
 * likely       — strong circumstantial evidence; needs one more check to confirm
 * inconclusive— data is missing or ambiguous; cannot determine from files alone
 * limitation   — inherent design boundary; cannot be proven from files at all
 */

// ── Path helpers ──────────────────────────────────────────────────
//
// IMPORTANT: Crons and channels use DIFFERENT root resolution in the
// Letta Code runtime:
//
//   crons.json     → honors LETTA_HOME (src/cron/cron-file.ts: getLettaDir)
//                    falls back to HOME/USERPROFILE + ".letta"
//
//   channels/      → uses os.homedir() + ".letta/channels" (src/channels/config.ts:
//                    CHANNELS_ROOT = join(homedir(), ".letta", "channels"))
//                    Does NOT honor LETTA_HOME.
//
// This split is a common source of confusion. The doctor mirrors it
// exactly and exposes a channelsRootOverride for tests.

export function getLettaDir(env = process.env) {
  if (env.LETTA_HOME) return env.LETTA_HOME;
  return join(env.HOME ?? env.USERPROFILE ?? homedir(), ".letta");
}

export function getCronFilePath(env = process.env) {
  return join(getLettaDir(env), "crons.json");
}

/**
 * Get the channels root directory.
 *
 * In the Letta Code runtime (src/channels/config.ts), this is always
 * `os.homedir() + ".letta/channels"` — it does NOT honor LETTA_HOME.
 *
 * For tests, pass channelsRootOverride to point at a temp directory.
 */
export function getChannelsRoot(env = process.env, channelsRootOverride) {
  if (channelsRootOverride) return channelsRootOverride;
  return join(homedir(), ".letta", "channels");
}

export function getChannelRoutingPath(channelId, env = process.env, channelsRootOverride) {
  return join(getChannelsRoot(env, channelsRootOverride), channelId, "routing.yaml");
}

// ── Redaction ─────────────────────────────────────────────────────

export function redactHome(value, home = homedir()) {
  if (!value || !home) return value;
  if (value === home) return "~";
  const isInsideHome = ["/", "\\"].some((sep) =>
    value.startsWith(`${home}${sep}`),
  );
  return isInsideHome ? `~${value.slice(home.length)}` : value;
}

// ── File readers (safe, never throw) ──────────────────────────────

/**
 * @typedef {"ok" | "missing" | "invalid-json" | "unsupported-version"} FileReadStatus
 */

/**
 * Read and parse crons.json.
 * Mirrors the shape from src/cron/cron-file.ts CronFileData (version: 1).
 *
 * Returns { status, data } where:
 *   status: "ok"               — file exists, valid JSON, version 1
 *   status: "missing"           — file does not exist
 *   status: "invalid-json"      — file exists but JSON.parse failed
 *   status: "unsupported-version" — file exists, valid JSON, but version !== 1
 *
 * For "ok", data is { version, scheduler_owner, tasks }.
 * For all other statuses, data is null.
 */
export function readCronFile(filePath) {
  if (!filePath) filePath = getCronFilePath();
  if (!existsSync(filePath)) return { status: "missing", data: null };
  let raw;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return { status: "invalid-json", data: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid-json", data: null };
  }
  if (parsed.version !== 1) {
    return { status: "unsupported-version", data: null };
  }
  return {
    status: "ok",
    data: {
      version: 1,
      scheduler_owner: parsed.scheduler_owner ?? null,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    },
  };
}

/**
 * Read and parse routing.yaml for a channel.
 *
 * Despite the .yaml extension, Letta Code stores routing as JSON
 * (src/channels/routing.ts: loadRoutes does JSON.parse(text)).
 * The runtime does NOT fall back to YAML parsing — if JSON.parse fails,
 * it silently starts with an empty route table.
 *
 * Returns { status, data } where:
 *   status: "ok"                — file exists, valid JSON with routes array
 *   status: "missing"            — file does not exist
 *   status: "invalid-json"       — file exists but JSON.parse failed (corrupted)
 *   status: "unsupported-version"— file exists, valid JSON, but no "routes" key
 *
 * For "ok", data is { routes: ChannelRoute[] }.
 * For all other statuses, data is null.
 */
export function readRoutingFile(channelId, env = process.env, channelsRootOverride) {
  const path = getChannelRoutingPath(channelId, env, channelsRootOverride);
  if (!existsSync(path)) return { status: "missing", data: null };
  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return { status: "invalid-json", data: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid-json", data: null };
  }
  if (!parsed || !Array.isArray(parsed.routes)) {
    return { status: "unsupported-version", data: null };
  }
  return { status: "ok", data: { routes: parsed.routes } };
}

/**
 * List channel directories that have a routing.yaml file.
 */
export function listChannelIds(env = process.env, channelsRootOverride) {
  const root = getChannelsRoot(env, channelsRootOverride);
  if (!existsSync(root)) return [];
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) =>
        existsSync(join(root, name, "routing.yaml")),
      );
  } catch {
    return [];
  }
}

// ── Process liveness ──────────────────────────────────────────────

/**
 * Check if a PID is alive. Uses process.kill(pid, 0) which is cross-platform.
 */
export function isPidAlive(pid) {
  if (!pid || typeof pid !== "number") return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read /proc/<pid>/stat for Linux process identity (start ticks + boot_id).
 * Returns null on non-Linux or if unavailable.
 * Mirrors src/cron/cron-file.ts: readLinuxProcessIdentity.
 */
export function readLinuxProcessIdentity(pid) {
  if (platform() !== "linux" || !pid) return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const endCommand = stat.lastIndexOf(")");
    if (endCommand === -1) return null;
    const fields = stat.slice(endCommand + 2).trim().split(/\s+/);
    const startTicks = fields[19] ?? null;
    let bootId = null;
    try {
      bootId = readFileSync(
        "/proc/sys/kernel/random/boot_id",
        "utf8",
      ).trim() || null;
    } catch {
      // best effort
    }
    return { startTicks, bootId };
  } catch {
    return null;
  }
}

/**
 * Compare persisted scheduler_owner identity against the current live process.
 * Returns "alive" | "dead" | "drifted" | "unknown".
 * Mirrors src/cron/cron-file.ts: isProcessAlive.
 */
export function checkSchedulerOwnerLiveness(owner) {
  if (!owner || !owner.pid) return "dead";
  if (!isPidAlive(owner.pid)) return "dead";
  // On Linux, compare process identity for drift detection.
  if (platform() === "linux" && owner.process_start_ticks) {
    const identity = readLinuxProcessIdentity(owner.pid);
    if (identity) {
      if (
        owner.boot_id &&
        identity.bootId &&
        owner.boot_id !== identity.bootId
      ) {
        return "drifted";
      }
      if (
        owner.process_start_ticks &&
        identity.startTicks &&
        owner.process_start_ticks !== identity.startTicks
      ) {
        return "drifted";
      }
    }
  }
  return "alive";
}

// ── Process scan (Check C) ─────────────────────────────────────────

/**
 * Parse a single line of `ps -axo pid=,ppid=,command=` output.
 * Returns { pid, ppid, command } or null.
 */
export function parsePsLine(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();
  // ps -axo pid=,ppid=,command= format: <pid> <ppid> <command...>
  const match = trimmed.match(/^(\d+)\s+(\d+)\s+(.*)$/);
  if (!match) return null;
  return {
    pid: parseInt(match[1], 10),
    ppid: parseInt(match[2], 10),
    command: match[3].trim(),
  };
}

/**
 * Parse Windows PowerShell Get-CimInstance JSON output.
 * Each entry has ProcessId, ParentProcessId, CommandLine.
 */
export function parseWindowsProcessEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const pid = entry.ProcessId;
  const ppid = entry.ParentProcessId;
  const command = entry.CommandLine ?? entry.Name ?? "";
  if (typeof pid !== "number" || typeof ppid !== "number") return null;
  return { pid, ppid, command: String(command) };
}

/**
 * Classify a process command line as a Letta runtime role.
 *
 * Returns one of:
 *   "explicit-channel-runtime"  — command has --channels flag
 *   "remote-runtime-candidate"   — command looks like a Letta runtime but no --channels
 *   null                          — not a Letta runtime
 *
 * We match only real Letta runtime command patterns:
 *   - "letta" + "server" or "letta.js" + "server"
 *   - "letta" + "remote" + "--env-name"
 *   - "--channels" with a value
 *   - AppImage containing "letta"
 *   - "letta-code" + "remote"
 */
export function classifyProcessRole(command) {
  if (!command || typeof command !== "string") return null;

  // Match --channels followed by a value, either as
  //   --channels telegram  (space-separated)
  //   --channels=telegram  (= separated)
  const hasChannels = /--channels(?:\s+|=)\S+/i.test(command);
  const isLettaRuntime =
    /letta(?:\.js)?\s+server/i.test(command) ||
    /letta(?:\.js)?\s+remote\s+--env-name/i.test(command) ||
    /letta-code.*remote/i.test(command) ||
    /letta.*AppImage/i.test(command);

  if (!isLettaRuntime) return null;

  if (hasChannels) return "explicit-channel-runtime";
  return "remote-runtime-candidate";
}

/**
 * Scan the process table for Letta runtime processes.
 *
 * Unix: `ps -axo pid=,ppid=,command=`
 * Windows: PowerShell Get-CimInstance with JSON output
 *
 * Returns { processes, status } where:
 *   status: "ok" | "inconclusive" | "unsupported"
 *   processes: Array of { pid, ppid, command, role }
 *
 * Multiple runtimes are a RISK, never proof of a problem.
 * Parent/child relationships are NOT automatically duplicates.
 */
export function scanProcesses() {
  const p = platform();
  let output = "";
  try {
    if (p === "win32") {
      // PowerShell Get-CimInstance with JSON output
      output = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json",
        ],
        { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] },
      );
    } else {
      // Unix: ps -axo pid=,ppid=,command=
      output = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  } catch {
    return { processes: [], status: "inconclusive" };
  }

  const processes = [];

  if (p === "win32") {
    let entries;
    try {
      entries = JSON.parse(output);
      if (!Array.isArray(entries)) entries = [entries];
    } catch {
      return { processes: [], status: "inconclusive" };
    }
    for (const entry of entries) {
      const parsed = parseWindowsProcessEntry(entry);
      if (!parsed) continue;
      // Skip our own process
      if (parsed.pid === process.pid) continue;
      const role = classifyProcessRole(parsed.command);
      if (!role) continue;
      processes.push({ ...parsed, role });
    }
  } else {
    for (const line of output.split("\n")) {
      const parsed = parsePsLine(line);
      if (!parsed) continue;
      // Skip our own process
      if (parsed.pid === process.pid) continue;
      const role = classifyProcessRole(parsed.command);
      if (!role) continue;
      processes.push({ ...parsed, role });
    }
  }

  return { processes, status: "ok" };
}

// ── Diagnostic checks ──────────────────────────────────────────────

/**
 * Check A: schedule conversation_id vs routing conversationId mismatch.
 *
 * For each active cron task, compare task.conversation_id against all
 * route.conversationId values in routing.yaml files.
 *
 * Key behaviors from source:
 * - src/cron/scheduler.ts: resolveCronFireConversationId
 *   - "new" → creates a fresh conversation per fire; cannot match a
 *     preexisting route (the conversation ID doesn't exist until fire time)
 *   - "default" → resolves to undefined at fire time, then the toolset
 *     normalizes the missing ID back to the literal "default" scope
 *   - any other string → used as-is for exact string match
 *
 * - src/tools/toolset.ts: resolveConversationChannelToolScope
 *   - Filters routes where: route.agentId === agentId &&
 *     route.conversationId === conversationId && route.enabled &&
 *     route.outboundEnabled !== false
 *   - If no routes pass ALL filters, channels array is empty →
 *     MessageChannel is absent from tool scope
 *
 * - outboundEnabled: false excludes the route from tool scope entirely
 *   (not just blocking sends — the tool is never registered)
 *
 * Emits explicit OK or INCONCLUSIVE per active task so silence is not
 * a clean bill of health.
 */
export function checkConversationMismatch(cronData, env = process.env, channelsRootOverride) {
  const findings = [];
  if (!cronData) return findings;

  const activeTasks = cronData.tasks.filter((t) => t.status === "active");

  // Collect all routes across all channels
  const channelIds = listChannelIds(env, channelsRootOverride);
  const allRoutes = [];
  for (const channelId of channelIds) {
    const routing = readRoutingFile(channelId, env, channelsRootOverride);
    if (!routing || routing.status !== "ok" || !routing.data) continue;
    for (const route of routing.data.routes) {
      allRoutes.push({ ...route, channelId });
    }
  }

  for (const task of activeTasks) {
    const taskConv = task.conversation_id;

    // "new" creates a fresh conversation per fire — it cannot match a
    // preexisting route because the conversation ID doesn't exist until
    // fire time. This is by design, not a mismatch.
    if (taskConv === "new") {
      findings.push({
        check: "A",
        severity: "info",
        evidence: "limitation",
        title: `Task "${task.name}" uses conversation_id: "new"`,
        detail:
          'Each fire creates a fresh conversation. The new conversation ID cannot match any preexisting route, so MessageChannel will be absent for that fire.',
        taskId: task.id,
        taskName: task.name,
        conversationId: taskConv,
        taskStatus: "INCONCLUSIVE",
        reversibleNextSteps: [
          'If channel messaging is needed from this task, use an explicit --conversation <conv-id> instead of "new".',
        ],
      });
      continue;
    }

    // Specific IDs are used as-is. The scheduler turns "default" into
    // undefined, and prepareToolExecutionContext normalizes that back to the
    // literal "default" before resolving channel scope, so it follows this
    // same exact-match path.
    const matchingRoutes = allRoutes.filter(
      (r) =>
        r.conversationId === taskConv &&
        r.agentId === task.agent_id,
    );

    if (matchingRoutes.length === 0) {
      findings.push({
        check: "A",
        severity: "critical",
        evidence: "confirmed",
        title: `Task "${task.name}" conversation_id does not match any routing entry`,
        detail: `Task conversation_id "${taskConv}" has no matching route with the same agentId and conversationId. MessageChannel will be absent from the cron-fired session's tool scope.`,
        taskId: task.id,
        taskName: task.name,
        conversationId: taskConv,
        agentId: task.agent_id,
        taskStatus: "CRITICAL",
        availableRouteConversationIds: allRoutes
          .filter((r) => r.agentId === task.agent_id)
          .map((r) => ({
            conversationId: r.conversationId,
            channelId: r.channelId,
            enabled: r.enabled !== false,
          })),
        reversibleNextSteps: [
          'Verify the correct conversation ID with "letta channels route list".',
          'Recreate the cron with the exact conversation ID from routing.yaml: letta cron delete <id> && letta cron add ... --conversation <exact-conv-id>.',
          'Or add the intended route with the supported "letta channels route add" command or Channels UI.',
        ],
      });
    } else {
      // Check if matching routes are enabled
      const enabledRoutes = matchingRoutes.filter((r) => r.enabled !== false);
      if (enabledRoutes.length === 0) {
        findings.push({
          check: "A",
          severity: "critical",
          evidence: "confirmed",
          title: `Task "${task.name}" has a matching route but it is disabled`,
          detail: `Route(s) for conversation_id "${taskConv}" exist but have enabled: false. MessageChannel will be absent from the cron-fired session's tool scope.`,
          taskId: task.id,
          taskName: task.name,
          conversationId: taskConv,
          agentId: task.agent_id,
          taskStatus: "CRITICAL",
          disabledRoutes: matchingRoutes.map((r) => ({
            channelId: r.channelId,
            chatId: r.chatId,
            enabled: r.enabled,
          })),
          reversibleNextSteps: [
            'Enable the route using "letta channels route add" with the same parameters, or use the /channels WS command from a running listener.',
          ],
        });
      } else {
        // Check outboundEnabled — if ALL matching enabled routes have
        // outboundEnabled: false, the route is excluded from tool scope
        // entirely (src/tools/toolset.ts: resolveConversationChannelToolScope
        // filters out routes where outboundEnabled === false)
        const outboundDisabled = enabledRoutes.filter(
          (r) => r.outboundEnabled === false,
        );
        if (outboundDisabled.length > 0 && outboundDisabled.length === enabledRoutes.length) {
          findings.push({
            check: "A",
            severity: "critical",
            evidence: "confirmed",
            title: `Task "${task.name}" all matching routes have outboundEnabled: false`,
            detail: `All matching enabled routes for conversation_id "${taskConv}" have outboundEnabled: false. In src/tools/toolset.ts (resolveConversationChannelToolScope), routes with outboundEnabled === false are excluded from the tool scope entirely. MessageChannel will be ABSENT from the cron-fired session — not just blocked from sending.`,
            taskId: task.id,
            taskName: task.name,
            conversationId: taskConv,
            taskStatus: "CRITICAL",
            reversibleNextSteps: [
              'Use the Channels UI or supported "letta channels route add" command to replace the route with outbound enabled.',
            ],
          });
        } else {
          // At least one matching, enabled, outbound-enabled route → OK
          findings.push({
            check: "A",
            severity: "ok",
            evidence: "confirmed",
            title: `Task "${task.name}" has a matching enabled route with outbound enabled`,
            detail: `Task conversation_id "${taskConv}" matches at least one route with enabled: true and outboundEnabled !== false. MessageChannel should be in tool scope for this task (assuming the adapter is running in the firing process — see Check D).`,
            taskId: task.id,
            taskName: task.name,
            conversationId: taskConv,
            taskStatus: "OK",
            matchingRoutes: enabledRoutes
          .filter((r) => r.outboundEnabled !== false)
          .map((r) => ({
            channelId: r.channelId,
            chatId: r.chatId,
          })),
            reversibleNextSteps: [],
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Check B: scheduler_owner process liveness / drift.
 *
 * Reads crons.json.scheduler_owner and checks if the PID is alive.
 * On Linux, also compares process_start_ticks and boot_id for drift
 * (same PID, different process after container restart).
 *
 * Mirrors src/cron/cron-file.ts: isProcessAlive.
 *
 * NOTE: We never include scheduler_owner.token or fingerprints in the
 * report. We only report pid, started_at, and liveness status.
 */
export function checkSchedulerOwner(cronData) {
  const findings = [];
  if (!cronData) return findings;

  const owner = cronData.scheduler_owner;

  if (!owner) {
    findings.push({
      check: "B",
      severity: "info",
      evidence: "confirmed",
      title: "No scheduler_owner in crons.json",
      detail:
        "No process has claimed the scheduler lease. Cron tasks will not fire until a schedule-capable Letta Code runtime starts and claims the lease.",
      schedulerOwner: null,
      reversibleNextSteps: [
        "Start a Letta Code listener (letta server, desktop app, or remote) to claim the scheduler lease.",
      ],
    });
    return findings;
  }

  const status = checkSchedulerOwnerLiveness(owner);

  // We only expose pid and started_at — never token, never fingerprints
  const safeOwner = {
    pid: owner.pid,
    started_at: owner.started_at,
  };

  if (status === "dead") {
    findings.push({
      check: "B",
      severity: "critical",
      evidence: "confirmed",
      title: `scheduler_owner PID ${owner.pid} is not running`,
      detail: `The process that claimed the scheduler lease (PID ${owner.pid}, started ${owner.started_at}) is no longer alive. Cron tasks will not fire until a new process claims the lease.`,
      schedulerOwner: safeOwner,
      reversibleNextSteps: [
        "Preserve logs and config before restarting.",
        "Start or restart a Letta Code listener to claim the scheduler lease.",
      ],
    });
  } else if (status === "drifted") {
    findings.push({
      check: "B",
      severity: "critical",
      evidence: "confirmed",
      title: `scheduler_owner PID ${owner.pid} has drifted (same PID, different process)`,
      detail: `The PID ${owner.pid} is alive but its process identity (start ticks or boot ID) no longer matches the persisted scheduler_owner. This happens after container restarts or PID reuse. The lease is stale.`,
      schedulerOwner: safeOwner,
      reversibleNextSteps: [
        "Restart the Letta Code listener so it reclaims the scheduler lease.",
      ],
    });
  } else if (status === "alive") {
    findings.push({
      check: "B",
      severity: "ok",
      evidence: "confirmed",
      title: `scheduler_owner PID ${owner.pid} is alive`,
      detail: `The scheduler lease is held by PID ${owner.pid} (started ${owner.started_at}).`,
      schedulerOwner: safeOwner,
      reversibleNextSteps: [],
    });
  } else {
    findings.push({
      check: "B",
      severity: "info",
      evidence: "inconclusive",
      title: `scheduler_owner PID ${owner.pid} liveness is inconclusive`,
      detail:
        "Could not determine process liveness. This may happen on unsupported platforms.",
      schedulerOwner: safeOwner,
      reversibleNextSteps: [
        'Manually verify the process is running: "letta channels status" or check the desktop app / server logs.',
      ],
    });
  }

  return findings;
}

/**
 * Check C: multiple Letta runtime processes.
 *
 * Scans the process table for processes that look like Letta runtimes.
 * Uses platform-appropriate commands:
 *   Unix:     ps -axo pid=,ppid=,command=
 *   Windows:  PowerShell Get-CimInstance with JSON output
 *
 * Classification:
 *   --channels flag → role: "explicit-channel-runtime"
 *   other Letta runtime → role: "remote-runtime-candidate"
 *
 * Multiple runtimes are a RISK, never proof of a problem.
 * Parent/child is NOT automatically a duplicate — a parent shell
 * launching a child letta process is two distinct processes.
 *
 * We also correlate the scheduler_owner PID with detected runtimes
 * to determine whether the lease holder is among the detected processes.
 */
export function checkMultipleListeners(cronData) {
  const findings = [];
  const scan = scanProcesses();
  const listeners = scan.processes;

  if (scan.status === "inconclusive") {
    findings.push({
      check: "C",
      severity: "info",
      evidence: "inconclusive",
      title: "Process scan was inconclusive",
      detail:
        "The process table could not be scanned. This may happen if the ps/PowerShell command is unavailable or timed out. Cannot determine if multiple Letta runtimes are running.",
      listenerCount: null,
      scanStatus: "inconclusive",
      reversibleNextSteps: [
        'Manually check for running Letta processes. Use "letta channels status" to inspect channel state.',
      ],
    });
    return findings;
  }

  // Correlate scheduler_owner PID with detected runtimes
  const schedulerPid = cronData?.scheduler_owner?.pid ?? null;
  const schedulerPidInListeners = schedulerPid
    ? listeners.some((l) => l.pid === schedulerPid)
    : false;

  if (listeners.length === 0) {
    findings.push({
      check: "C",
      severity: "info",
      evidence: "inconclusive",
      title: "No Letta runtime processes detected",
      detail:
        'No processes matching Letta runtime command patterns were found. Either no runtime is running, or the process table is not accessible. If crons are expected to fire, start a listener. Use "letta channels status" to check channel state.',
      listenerCount: 0,
      scanStatus: "ok",
      schedulerPidInListeners: false,
      reversibleNextSteps: [
        "Start a Letta Code listener if cron tasks need to fire.",
      ],
    });
  } else if (listeners.length === 1) {
    findings.push({
      check: "C",
      severity: "ok",
      evidence: "likely",
      title: "One Letta runtime process detected",
      detail:
        "A single Letta runtime process was found. This reduces split-runtime risk, but does not prove that a channel adapter is running in that process.",
      listenerCount: 1,
      scanStatus: "ok",
      listeners: listeners.map((l) => ({
        pid: l.pid,
        ppid: l.ppid,
        role: l.role,
      })),
      schedulerPidInListeners,
      reversibleNextSteps: [],
    });
  } else {
    findings.push({
      check: "C",
      severity: "warning",
      evidence: "likely",
      title: `${listeners.length} Letta runtime processes detected — multiple runtimes are a risk`,
      detail:
        'Multiple Letta runtime processes are running. The channel adapter registry is per-process, so cron may fire in a process where the relevant adapter is not running; in that case MessageChannel is absent from tool scope. Multiple runtimes are a risk, not proof — supervised parent/child runtime trees can be valid. Use "letta channels status" and "letta channels route list" to gather evidence before taking action.',
      listenerCount: listeners.length,
      scanStatus: "ok",
      listeners: listeners.map((l) => ({
        pid: l.pid,
        ppid: l.ppid,
        role: l.role,
      })),
      schedulerPidInListeners,
      reversibleNextSteps: [
        "Preserve logs and config before making changes.",
        'Use "letta channels status" and "letta channels route list" to gather evidence.',
        "After evidence capture, consider a clean single-runtime restart if the configuration supports it.",
        "Do not kill processes without first capturing evidence.",
      ],
    });
  }

  return findings;
}

/**
 * Check D: channel adapter running state is process-local (limitation).
 *
 * This is always reported as a limitation. The doctor cannot prove from
 * files alone whether a channel adapter is running, because isRunning()
 * (src/channels/types.ts: ChannelAdapter.isRunning) is a per-process
 * in-memory check with no cross-process IPC.
 *
 * Even if routing.yaml exists and routes are enabled, the adapter may
 * not be running in the process that fires the cron task.
 */
export function checkAdapterStateLimitation(cronData, env = process.env, channelsRootOverride) {
  const findings = [];

  const channelIds = listChannelIds(env, channelsRootOverride);
  const hasRoutes = channelIds.some((id) => {
    const routing = readRoutingFile(id, env, channelsRootOverride);
    return routing && routing.status === "ok" && routing.data && routing.data.routes.length > 0;
  });

  const hasActiveTasks =
    cronData && cronData.tasks.some((t) => t.status === "active");

  findings.push({
    check: "D",
    severity: "info",
    evidence: "limitation",
    title:
      "Channel adapter running state is process-local and cannot be proven from files",
    detail:
      "The doctor can read routing.yaml and crons.json, but it cannot determine whether a channel adapter isRunning() in the process that will fire a cron task. isRunning() (src/channels/types.ts: ChannelAdapter.isRunning) is a per-process in-memory registry check with no cross-process IPC. Even if routes are enabled and conversationIds match, the adapter may not be running in the cron-firing process. This is an inherent design limitation as of Letta Code 0.28.13+.",
    hasChannelRoutes: hasRoutes,
    hasActiveCronTasks: hasActiveTasks,
    channelIdsWithRoutes: channelIds,
    reversibleNextSteps: [
      'Verify adapter state from within the listener process: use "letta channels status" or check logs for adapter startup messages.',
      "If running multiple processes, collapse to one (see Check C).",
      "If conversationIds match and only one listener is running but MessageChannel is still absent, check that the channel adapter started successfully in that process.",
    ],
  });

  return findings;
}

// ── Main diagnostic ────────────────────────────────────────────────

/**
 * Run all diagnostic checks and return a structured report.
 *
 * @param {object} [options]
 * @param {string} [options.cronFilePath] - Override path to crons.json
 * @param {object} [options.env] - Override environment (for testing)
 * @param {string} [options.channelsRootOverride] - Override channels root (for testing)
 * @param {boolean} [options.skipProcessScan] - Skip process table scan (for testing)
 */
export function runDiagnostics(options = {}) {
  const env = options.env ?? process.env;
  const cronPath = options.cronFilePath ?? getCronFilePath(env);
  const cronResult = readCronFile(cronPath);
  const cronData = cronResult.status === "ok" ? cronResult.data : null;

  const findings = [
    ...checkConversationMismatch(cronData, env, options.channelsRootOverride),
    ...checkSchedulerOwner(cronData),
    ...(options.skipProcessScan ? [] : checkMultipleListeners(cronData)),
    ...checkAdapterStateLimitation(cronData, env, options.channelsRootOverride),
  ];

  // Count checks actually run (Check C may be skipped)
  const checksRun = options.skipProcessScan ? 3 : 4;

  // Build summary
  const summary = {
    checksRun,
    totalFindings: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    ok: findings.filter((f) => f.severity === "ok").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  // Build cronFile metadata with status
  const cronFileMeta = {
    path: redactHome(cronPath),
    exists: cronResult.status !== "missing",
    status: cronResult.status,
    taskCount: cronData?.tasks.length ?? 0,
    activeTaskCount: cronData?.tasks.filter((t) => t.status === "active").length ?? 0,
  };

  // Build channels metadata with per-channel routing file status
  const channelsMeta = listChannelIds(env, options.channelsRootOverride).map((id) => {
    const routing = readRoutingFile(id, env, options.channelsRootOverride);
    return {
      channelId: id,
      routingStatus: routing.status,
      routeCount: routing.status === "ok" && routing.data ? routing.data.routes.length : 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    doctorVersion: "2.0.0",
    lettaDir: redactHome(getLettaDir(env)),
    channelsRoot: redactHome(getChannelsRoot(env, options.channelsRootOverride)),
    cronFile: cronFileMeta,
    channels: channelsMeta,
    summary,
    findings,
    interpretation: [
      "Check A (conversation mismatch) is confirmed from file comparison — direct evidence. Per-task OK/INCONCLUSIVE/CRITICAL status is emitted.",
      "Check B (scheduler_owner liveness) is confirmed from process.kill(0) — direct evidence. Token is never included.",
      'Check C (multiple runtimes) is likely from process table scan — heuristic. Multiple runtimes are a risk, not proof. Parent/child is not automatically duplicate.',
      "Check D (adapter running state) is a limitation — cannot be proven from files alone.",
      "This doctor is read-only. It never writes, edits, or modifies any file.",
      "No secrets or account credentials are included in this report.",
      "Crons honor LETTA_HOME; channels use os.homedir()/.letta/channels (does NOT honor LETTA_HOME).",
      "routing.yaml is JSON-parsed by the runtime. No YAML fallback exists. Invalid JSON is reported explicitly.",
    ],
  };
}

// ── Human-readable output ──────────────────────────────────────────

function severityIcon(severity) {
  switch (severity) {
    case "critical": return "[!]";
    case "warning": return "[~]";
    case "ok": return "[ok]";
    case "info": return "[i]";
    default: return "[?]";
  }
}

function evidenceTag(evidence) {
  switch (evidence) {
    case "confirmed": return "CONFIRMED";
    case "likely": return "LIKELY";
    case "inconclusive": return "INCONCLUSIVE";
    case "limitation": return "LIMITATION";
    default: return "?";
  }
}

export function printHuman(report) {
  console.log("Letta Cron + Channels Route Doctor v2.0.0\n");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Letta dir: ${report.lettaDir}`);
  console.log(`Channels root: ${report.channelsRoot}`);
  console.log(`Cron file: ${report.cronFile.path} (${report.cronFile.status})`);
  console.log(`  Tasks: ${report.cronFile.taskCount} total, ${report.cronFile.activeTaskCount} active`);
  console.log(`Channels: ${report.channels.length} with routing files`);
  for (const ch of report.channels) {
    console.log(`  ${ch.channelId}: ${ch.routingStatus}, ${ch.routeCount} routes`);
  }
  console.log("");
  console.log(`Summary: ${report.summary.checksRun} checks run, ${report.summary.critical} critical, ${report.summary.warnings} warnings, ${report.summary.ok} ok, ${report.summary.info} info`);
  console.log("");

  for (const f of report.findings) {
    console.log(`${severityIcon(f.severity)} Check ${f.check} [${evidenceTag(f.evidence)}]: ${f.title}`);
    console.log(`  ${f.detail}`);
    if (f.taskStatus) {
      console.log(`  Task status: ${f.taskStatus}`);
    }
    if (f.reversibleNextSteps && f.reversibleNextSteps.length > 0) {
      console.log("  Next steps:");
      for (const step of f.reversibleNextSteps) {
        console.log(`    - ${step}`);
      }
    }
    console.log("");
  }

  console.log("Interpretation:");
  for (const line of report.interpretation) {
    console.log(`  - ${line}`);
  }
  console.log("");
  console.log("Use --json for a support-ready JSON packet. This doctor is read-only and never exposes secrets.");
}

// ── CLI entry point ────────────────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runDiagnostics();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
}
