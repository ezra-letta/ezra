import assert from "node:assert/strict";
import test from "node:test";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  redactHome,
  readCronFile,
  readRoutingFile,
  checkConversationMismatch,
  checkSchedulerOwner,
  checkAdapterStateLimitation,
  runDiagnostics,
  getLettaDir,
  getCronFilePath,
  getChannelsRoot,
  parsePsLine,
  parseWindowsProcessEntry,
  classifyProcessRole,
  scanProcesses,
  isPidAlive,
  checkSchedulerOwnerLiveness,
} from "./doctor.mjs";

// ── Test helpers ───────────────────────────────────────────────────

/**
 * Create a temporary .letta directory with crons.json and channel routing
 * files for testing.
 *
 * Because crons honor LETTA_HOME but channels use os.homedir()/.letta/channels,
 * we use channelsRootOverride to point channels at our temp directory.
 */
function makeTempEnv(config = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "doctor-test-"));
  const lettaDir = join(tmp, ".letta");
  mkdirSync(lettaDir, { recursive: true });

  if (config.crons) {
    writeFileSync(
      join(lettaDir, "crons.json"),
      JSON.stringify(config.crons, null, 2),
    );
  }

  const channelsRoot = config.channelsRoot ?? join(lettaDir, "channels");

  if (config.channels) {
    for (const [channelId, routing] of Object.entries(config.channels)) {
      const channelDir = join(channelsRoot, channelId);
      mkdirSync(channelDir, { recursive: true });
      writeFileSync(
        join(channelDir, "routing.yaml"),
        JSON.stringify(routing, null, 2),
      );
    }
  }

  return {
    lettaDir,
    channelsRoot,
    env: { LETTA_HOME: lettaDir },
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

function makeTask(overrides = {}) {
  return {
    id: "abcd1234",
    agent_id: "agent-test123",
    conversation_id: "default",
    name: "test-task",
    description: "test description",
    cron: "0 9 * * *",
    timezone: "UTC",
    recurring: true,
    prompt: "test prompt",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    last_fired_at: null,
    fire_count: 0,
    cancel_reason: null,
    jitter_offset_ms: 0,
    last_run_at: null,
    last_run_outcome: null,
    last_run_reason: null,
    last_run_error: null,
    last_missed_at: null,
    missed_count: 0,
    failed_count: 0,
    scheduled_for: null,
    fired_at: null,
    missed_at: null,
    ...overrides,
  };
}

function makeRoute(overrides = {}) {
  return {
    chatId: "123456",
    agentId: "agent-test123",
    conversationId: "conv-abcdef",
    enabled: true,
    outboundEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Redaction tests ────────────────────────────────────────────────

test("redactHome replaces home directory with ~", () => {
  assert.equal(redactHome("/Users/test/project", "/Users/test"), "~/project");
  assert.equal(redactHome("/Users/test", "/Users/test"), "~");
  assert.equal(
    redactHome("/Users/tester/project", "/Users/test"),
    "/Users/tester/project",
  );
  assert.equal(
    redactHome("C:\\Users\\test\\project", "C:\\Users\\test"),
    "~\\project",
  );
});

// ── readCronFile tests ─────────────────────────────────────────────

test("readCronFile returns {status: 'missing'} for missing file", () => {
  const result = readCronFile("/nonexistent/path/crons.json");
  assert.equal(result.status, "missing");
  assert.equal(result.data, null);
});

test("readCronFile parses valid crons.json", () => {
  const { env, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [makeTask()],
    },
  });
  try {
    const result = readCronFile(getCronFilePath(env));
    assert.equal(result.status, "ok");
    assert.equal(result.data.version, 1);
    assert.equal(result.data.tasks.length, 1);
    assert.equal(result.data.tasks[0].name, "test-task");
  } finally {
    cleanup();
  }
});

test("readCronFile returns {status: 'unsupported-version'} for wrong version", () => {
  const { env, cleanup } = makeTempEnv({
    crons: { version: 2, scheduler_owner: null, tasks: [] },
  });
  try {
    const result = readCronFile(getCronFilePath(env));
    assert.equal(result.status, "unsupported-version");
    assert.equal(result.data, null);
  } finally {
    cleanup();
  }
});

test("readCronFile returns {status: 'invalid-json'} for unparseable JSON", () => {
  const tmp = mkdtempSync(join(tmpdir(), "doctor-test-"));
  try {
    const lettaDir = join(tmp, ".letta");
    mkdirSync(lettaDir, { recursive: true });
    writeFileSync(join(lettaDir, "crons.json"), "{ not valid json ]");
    const result = readCronFile(join(lettaDir, "crons.json"));
    assert.equal(result.status, "invalid-json");
    assert.equal(result.data, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("readCronFile returns {status: 'invalid-json'} for unreadable file", () => {
  // A directory instead of a file — readFileSync will fail
  const tmp = mkdtempSync(join(tmpdir(), "doctor-test-"));
  try {
    const result = readCronFile(tmp); // directory, not a file
    assert.equal(result.status, "invalid-json");
    assert.equal(result.data, null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ── readRoutingFile tests ──────────────────────────────────────────

test("readRoutingFile parses JSON routing.yaml", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    channels: {
      telegram: { routes: [makeRoute()] },
    },
  });
  try {
    const result = readRoutingFile("telegram", env, channelsRoot);
    assert.equal(result.status, "ok");
    assert.equal(result.data.routes.length, 1);
    assert.equal(result.data.routes[0].conversationId, "conv-abcdef");
  } finally {
    cleanup();
  }
});

test("readRoutingFile returns {status: 'missing'} for missing channel", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({});
  try {
    const result = readRoutingFile("nonexistent", env, channelsRoot);
    assert.equal(result.status, "missing");
    assert.equal(result.data, null);
  } finally {
    cleanup();
  }
});

test("readRoutingFile returns {status: 'invalid-json'} for corrupted YAML", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({});
  try {
    const channelDir = join(channelsRoot, "telegram");
    mkdirSync(channelDir, { recursive: true });
    writeFileSync(join(channelDir, "routing.yaml"), "{ not valid json ]");
    const result = readRoutingFile("telegram", env, channelsRoot);
    assert.equal(result.status, "invalid-json");
    assert.equal(result.data, null);
  } finally {
    cleanup();
  }
});

test("readRoutingFile returns {status: 'unsupported-version'} for JSON without routes key", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({});
  try {
    const channelDir = join(channelsRoot, "telegram");
    mkdirSync(channelDir, { recursive: true });
    writeFileSync(join(channelDir, "routing.yaml"), JSON.stringify({ version: 2 }));
    const result = readRoutingFile("telegram", env, channelsRoot);
    assert.equal(result.status, "unsupported-version");
    assert.equal(result.data, null);
  } finally {
    cleanup();
  }
});

// ── Check A: conversation mismatch tests ───────────────────────────

test("Check A: detects confirmed mismatch when task conversation_id has no matching route", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({
          id: "task1",
          name: "heartbeat",
          conversation_id: "conv-does-not-match",
        }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const mismatch = findings.find((f) => f.severity === "critical" && f.check === "A");
    assert.ok(mismatch, "should have a critical finding");
    assert.equal(mismatch.evidence, "confirmed");
    assert.ok(mismatch.title.includes("does not match"));
    assert.equal(mismatch.taskStatus, "CRITICAL");
  } finally {
    cleanup();
  }
});

test("Check A: emits OK when task conversation_id matches a route", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({
          id: "task1",
          name: "heartbeat",
          conversation_id: "conv-abcdef",
        }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const ok = findings.find((f) => f.severity === "ok" && f.check === "A");
    assert.ok(ok, "should have an OK finding");
    assert.equal(ok.evidence, "confirmed");
    assert.equal(ok.taskStatus, "OK");
  } finally {
    cleanup();
  }
});

test("Check A: 'default' requires an exact default route", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({ id: "task1", name: "heartbeat", conversation_id: "default" }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const finding = findings.find((f) => f.check === "A");
    assert.ok(finding, "should have a finding for 'default'");
    assert.equal(finding.evidence, "confirmed");
    assert.equal(finding.severity, "critical");
    assert.equal(finding.taskStatus, "CRITICAL");
  } finally {
    cleanup();
  }
});

test("Check A: 'default' is OK when an exact default route exists", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({ id: "task1", name: "heartbeat", conversation_id: "default" }),
      ],
    },
    channels: {
      telegram: {
        routes: [
          makeRoute({ conversationId: "default", agentId: "agent-test123" }),
        ],
      },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const finding = findings.find((f) => f.check === "A");
    assert.equal(finding.evidence, "confirmed");
    assert.equal(finding.taskStatus, "OK");
  } finally {
    cleanup();
  }
});

test("Check A: 'new' conversation_id is a limitation, cannot match preexisting route", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({ id: "task1", name: "fresh-task", conversation_id: "new" }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const info = findings.find((f) => f.severity === "info" && f.check === "A");
    assert.ok(info, "should have an info finding");
    assert.equal(info.evidence, "limitation");
    assert.ok(info.title.includes('"new"'));
    assert.ok(info.detail.includes("fresh conversation"), "should say fresh conversation");
    assert.ok(info.detail.includes("cannot match"), "should say cannot match preexisting route");
    // Must NOT include curl workaround
    const stepsStr = JSON.stringify(info.reversibleNextSteps);
    assert.ok(!stepsStr.includes("curl"), "must not include curl workaround");
  } finally {
    cleanup();
  }
});

test("Check A: detects disabled route matching task conversation_id", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({
          id: "task1",
          name: "heartbeat",
          conversation_id: "conv-abcdef",
        }),
      ],
    },
    channels: {
      telegram: {
        routes: [makeRoute({ conversationId: "conv-abcdef", enabled: false })],
      },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const critical = findings.find((f) => f.severity === "critical" && f.check === "A");
    assert.ok(critical, "should have a critical finding for disabled route");
    assert.ok(critical.title.includes("disabled"));
    assert.equal(critical.taskStatus, "CRITICAL");
  } finally {
    cleanup();
  }
});

test("Check A: outboundEnabled false is CRITICAL (MessageChannel absent, not just blocked)", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({
          id: "task1",
          name: "heartbeat",
          conversation_id: "conv-abcdef",
        }),
      ],
    },
    channels: {
      telegram: {
        routes: [
          makeRoute({ conversationId: "conv-abcdef", outboundEnabled: false }),
        ],
      },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const critical = findings.find((f) => f.severity === "critical" && f.check === "A");
    assert.ok(critical, "should have a critical finding for outboundEnabled: false");
    assert.ok(critical.title.includes("outboundEnabled: false"));
    // The detail must say ABSENT, not just "blocked"
    assert.ok(critical.detail.includes("ABSENT"), "must say MessageChannel is ABSENT, not just blocked");
    assert.equal(critical.taskStatus, "CRITICAL");
  } finally {
    cleanup();
  }
});

test("Check A: outboundEnabled false with one true route is OK", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({
          id: "task1",
          name: "heartbeat",
          conversation_id: "conv-abcdef",
        }),
      ],
    },
    channels: {
      telegram: {
        routes: [
          makeRoute({ conversationId: "conv-abcdef", outboundEnabled: false }),
          makeRoute({ conversationId: "conv-abcdef", outboundEnabled: true, chatId: "789" }),
        ],
      },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const ok = findings.find((f) => f.severity === "ok" && f.check === "A");
    assert.ok(ok, "should have an OK finding when at least one route has outbound enabled");
    assert.equal(ok.taskStatus, "OK");
  } finally {
    cleanup();
  }
});

test("Check A: only checks active tasks, not fired/missed/cancelled", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({
          id: "task1",
          name: "done-task",
          conversation_id: "conv-no-match",
          status: "fired",
        }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    assert.equal(findings.length, 0, "inactive tasks should not produce findings");
  } finally {
    cleanup();
  }
});

test("Check A: handles missing crons.json gracefully", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({});
  try {
    const findings = checkConversationMismatch(null, env, channelsRoot);
    assert.equal(findings.length, 0);
  } finally {
    cleanup();
  }
});

test("Check A: emits explicit per-task status (OK/INCONCLUSIVE/CRITICAL)", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({ id: "t1", name: "ok-task", conversation_id: "conv-abcdef" }),
        makeTask({ id: "t2", name: "default-task", conversation_id: "default" }),
        makeTask({ id: "t3", name: "new-task", conversation_id: "new" }),
        makeTask({ id: "t4", name: "bad-task", conversation_id: "conv-nope" }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    // Should have 4 findings, one per active task
    assert.equal(findings.length, 4);
    const statuses = findings.map((f) => f.taskStatus).sort();
    assert.deepEqual(statuses, ["CRITICAL", "CRITICAL", "INCONCLUSIVE", "OK"]);
  } finally {
    cleanup();
  }
});

// ── Check B: scheduler_owner liveness tests ─────────────────────────

test("Check B: reports no scheduler_owner when absent", () => {
  const cronData = {
    version: 1,
    scheduler_owner: null,
    tasks: [makeTask()],
  };
  const findings = checkSchedulerOwner(cronData);
  const info = findings.find((f) => f.severity === "info");
  assert.ok(info, "should have an info finding");
  assert.equal(info.evidence, "confirmed");
  assert.ok(info.title.includes("No scheduler_owner"));
});

test("Check B: reports dead PID when scheduler_owner PID is not running", () => {
  const cronData = {
    version: 1,
    scheduler_owner: {
      pid: 999999,
      token: "abc12345678901234567890",
      started_at: "2026-01-01T00:00:00.000Z",
      process_start_ticks: null,
      boot_id: null,
    },
    tasks: [],
  };
  const findings = checkSchedulerOwner(cronData);
  const critical = findings.find((f) => f.severity === "critical");
  assert.ok(critical, "should have a critical finding");
  assert.equal(critical.evidence, "confirmed");
  assert.ok(critical.title.includes("not running"));
  // Token must NOT be in the report
  const criticalStr = JSON.stringify(critical);
  assert.ok(!criticalStr.includes("abc12345678901234567890"), "raw token must not appear");
  assert.ok(!criticalStr.includes("token"), "token field must not appear");
  // No fingerprints
  assert.ok(!criticalStr.includes("fingerprint"), "no fingerprints");
});

test("Check B: reports ok when scheduler_owner PID is alive (current process)", () => {
  const cronData = {
    version: 1,
    scheduler_owner: {
      pid: process.pid,
      token: "xyz12345678901234567890",
      started_at: "2026-01-01T00:00:00.000Z",
      process_start_ticks: null,
      boot_id: null,
    },
    tasks: [],
  };
  const findings = checkSchedulerOwner(cronData);
  const ok = findings.find((f) => f.severity === "ok");
  assert.ok(ok, "should have an ok finding");
  assert.equal(ok.evidence, "confirmed");
  assert.ok(ok.title.includes("alive"));
  // Token must NOT be in the report
  const okStr = JSON.stringify(ok);
  assert.ok(!okStr.includes("xyz12345678901234567890"), "raw token must not appear");
  assert.ok(!okStr.includes("token"), "token field must not appear");
});

test("Check B: handles missing cronData gracefully", () => {
  const findings = checkSchedulerOwner(null);
  assert.equal(findings.length, 0);
});

test("Check B: never includes scheduler_owner.token in any finding", () => {
  const secretToken = "super-secret-token-1234567890abcdef";
  const cronData = {
    version: 1,
    scheduler_owner: {
      pid: 999999,
      token: secretToken,
      started_at: "2026-01-01T00:00:00.000Z",
      process_start_ticks: null,
      boot_id: null,
    },
    tasks: [],
  };
  const findings = checkSchedulerOwner(cronData);
  const findingsStr = JSON.stringify(findings);
  assert.ok(!findingsStr.includes(secretToken), "raw token must not appear anywhere");
  assert.ok(!findingsStr.includes("token"), "token field must not appear");
  assert.ok(!findingsStr.includes("<<redacted:"), "no redacted fingerprints");
});

// ── Process parsing/classification tests ───────────────────────────

test("parsePsLine parses Unix ps output line", () => {
  const result = parsePsLine(" 12345  67890 /usr/local/bin/letta server --channels telegram");
  assert.equal(result.pid, 12345);
  assert.equal(result.ppid, 67890);
  assert.ok(result.command.includes("letta server"));
});

test("parsePsLine returns null for empty line", () => {
  assert.equal(parsePsLine(""), null);
  assert.equal(parsePsLine("   "), null);
});

test("parsePsLine returns null for non-numeric pid", () => {
  assert.equal(parsePsLine("abc 123 some command"), null);
});

test("parseWindowsProcessEntry parses CIM entry", () => {
  const result = parseWindowsProcessEntry({
    ProcessId: 1234,
    ParentProcessId: 5678,
    CommandLine: "letta server --channels telegram",
  });
  assert.equal(result.pid, 1234);
  assert.equal(result.ppid, 5678);
  assert.ok(result.command.includes("letta"));
});

test("parseWindowsProcessEntry returns null for invalid entry", () => {
  assert.equal(parseWindowsProcessEntry(null), null);
  assert.equal(parseWindowsProcessEntry({}), null);
  assert.equal(parseWindowsProcessEntry({ ProcessId: "abc" }), null);
});

test("classifyProcessRole: --channels flag → explicit-channel-runtime", () => {
  assert.equal(
    classifyProcessRole("letta server --channels telegram"),
    "explicit-channel-runtime",
  );
  assert.equal(
    classifyProcessRole("node letta.js server --channels=telegram"),
    "explicit-channel-runtime",
  );
});

test("classifyProcessRole: letta server without --channels → remote-runtime-candidate", () => {
  assert.equal(
    classifyProcessRole("letta server"),
    "remote-runtime-candidate",
  );
  assert.equal(
    classifyProcessRole("node letta.js server --listen"),
    "remote-runtime-candidate",
  );
});

test("classifyProcessRole: letta remote --env-name → remote-runtime-candidate", () => {
  assert.equal(
    classifyProcessRole("letta remote --env-name myenv"),
    "remote-runtime-candidate",
  );
});

test("classifyProcessRole: letta-code remote → remote-runtime-candidate", () => {
  assert.equal(
    classifyProcessRole("letta-code remote --env-name prod"),
    "remote-runtime-candidate",
  );
});

test("classifyProcessRole: AppImage with letta → remote-runtime-candidate", () => {
  assert.equal(
    classifyProcessRole("/tmp/letta.AppImage server"),
    "remote-runtime-candidate",
  );
});

test("classifyProcessRole: non-Letta command → null", () => {
  assert.equal(classifyProcessRole("vim /etc/hosts"), null);
  assert.equal(classifyProcessRole("python script.py"), null);
  assert.equal(classifyProcessRole("node server.js"), null);
  assert.equal(classifyProcessRole("other-tool --channels discord"), null);
  assert.equal(classifyProcessRole(""), null);
  assert.equal(classifyProcessRole(null), null);
});

test("scanProcesses returns a status and array", () => {
  const result = scanProcesses();
  assert.ok(typeof result.status === "string");
  assert.ok(Array.isArray(result.processes));
  // On most Unix CI, ps should work
  if (result.status === "ok") {
    for (const proc of result.processes) {
      assert.ok(typeof proc.pid === "number");
      assert.ok(typeof proc.ppid === "number");
      assert.ok(typeof proc.command === "string");
      assert.ok(proc.role === "explicit-channel-runtime" || proc.role === "remote-runtime-candidate");
    }
  }
});

// ── Check D: adapter state limitation tests ────────────────────────

test("Check D: always reports the process-local limitation", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [makeTask()],
    },
    channels: {
      telegram: { routes: [makeRoute()] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkAdapterStateLimitation(cronData, env, channelsRoot);
    assert.equal(findings.length, 1);
    const limitation = findings[0];
    assert.equal(limitation.check, "D");
    assert.equal(limitation.evidence, "limitation");
    assert.equal(limitation.severity, "info");
    assert.ok(limitation.title.includes("process-local"));
    assert.equal(limitation.hasChannelRoutes, true);
    assert.equal(limitation.hasActiveCronTasks, true);
    assert.ok(limitation.channelIdsWithRoutes.includes("telegram"));
  } finally {
    cleanup();
  }
});

test("Check D: reports false for hasChannelRoutes when no channels configured", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [makeTask()],
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkAdapterStateLimitation(cronData, env, channelsRoot);
    assert.equal(findings[0].hasChannelRoutes, false);
  } finally {
    cleanup();
  }
});

// ── LETTA_HOME / channels root split tests ─────────────────────────

test("getLettaDir honors LETTA_HOME", () => {
  const env = { LETTA_HOME: "/custom/letta/home" };
  assert.equal(getLettaDir(env), "/custom/letta/home");
});

test("getLettaDir falls back to HOME when LETTA_HOME not set", () => {
  const env = { HOME: "/Users/testuser" };
  assert.equal(getLettaDir(env), "/Users/testuser/.letta");
});

test("getChannelsRoot does NOT honor LETTA_HOME (uses os.homedir)", () => {
  const env = { LETTA_HOME: "/custom/letta/home", HOME: "/Users/testuser" };
  // Channels root should NOT be inside LETTA_HOME
  const channelsRoot = getChannelsRoot(env);
  assert.ok(!channelsRoot.includes("/custom/letta/home"), "channels root must not honor LETTA_HOME");
  assert.ok(channelsRoot.includes(".letta"), "channels root should contain .letta");
  assert.ok(channelsRoot.includes("channels"), "channels root should contain channels");
});

test("getChannelsRoot honors channelsRootOverride", () => {
  const env = { LETTA_HOME: "/custom/letta/home" };
  const override = "/tmp/test-channels-root";
  assert.equal(getChannelsRoot(env, override), "/tmp/test-channels-root");
});

test("LETTA_HOME and channels root are different paths in tests", () => {
  const { lettaDir, channelsRoot, env, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [makeTask()],
    },
    channels: {
      telegram: { routes: [makeRoute()] },
    },
  });
  try {
    // crons.json is under lettaDir (which honors LETTA_HOME)
    assert.ok(existsSync(join(lettaDir, "crons.json")));
    // channels are under channelsRoot (which uses os.homedir, not LETTA_HOME)
    assert.ok(existsSync(join(channelsRoot, "telegram", "routing.yaml")));
    // The channels root should NOT be inside lettaDir
    assert.notEqual(lettaDir, channelsRoot);
  } finally {
    cleanup();
  }
});

// ── runDiagnostics integration tests ────────────────────────────────

test("runDiagnostics produces a complete report with correct checksRun", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: {
        pid: process.pid,
        token: "tok12345678901234567890",
        started_at: "2026-01-01T00:00:00.000Z",
        process_start_ticks: null,
        boot_id: null,
      },
      tasks: [
        makeTask({
          id: "task1",
          name: "mismatched-task",
          conversation_id: "conv-wrong",
        }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const report = runDiagnostics({
      env,
      channelsRootOverride: channelsRoot,
      skipProcessScan: true,
    });
    assert.ok(report.generatedAt);
    assert.equal(report.doctorVersion, "2.0.0");
    assert.ok(typeof report.lettaDir === "string");
    assert.ok(typeof report.channelsRoot === "string");
    assert.equal(report.cronFile.exists, true);
    assert.equal(report.cronFile.status, "ok");
    assert.equal(report.cronFile.taskCount, 1);
    assert.equal(report.cronFile.activeTaskCount, 1);
    assert.equal(report.channels.length, 1);
    assert.equal(report.channels[0].channelId, "telegram");
    assert.equal(report.channels[0].routingStatus, "ok");
    assert.equal(report.channels[0].routeCount, 1);
    // checksRun should be 3 when skipProcessScan is true
    assert.equal(report.summary.checksRun, 3);

    // Should have Check A critical (mismatch)
    const checkA = report.findings.filter((f) => f.check === "A");
    assert.ok(checkA.some((f) => f.severity === "critical"));

    // Should have Check B ok (alive PID)
    const checkB = report.findings.filter((f) => f.check === "B");
    assert.ok(checkB.some((f) => f.severity === "ok"));

    // Should have Check D limitation
    const checkD = report.findings.filter((f) => f.check === "D");
    assert.ok(checkD.some((f) => f.evidence === "limitation"));

    // No secrets in the report
    const reportStr = JSON.stringify(report);
    assert.ok(!reportStr.includes("tok12345678901234567890"), "raw token must not appear");
    assert.ok(!reportStr.includes("token"), "token field must not appear");
    assert.ok(!reportStr.includes("<<redacted:"), "no redacted fingerprints");
  } finally {
    cleanup();
  }
});

test("runDiagnostics handles missing crons.json", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({});
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    assert.equal(report.cronFile.exists, false);
    assert.equal(report.cronFile.status, "missing");
    assert.equal(report.cronFile.taskCount, 0);
    assert.equal(report.cronFile.activeTaskCount, 0);
    // Should still have Check D
    const checkD = report.findings.filter((f) => f.check === "D");
    assert.ok(checkD.length > 0);
  } finally {
    cleanup();
  }
});

test("runDiagnostics handles invalid crons.json", () => {
  const tmp = mkdtempSync(join(tmpdir(), "doctor-test-"));
  try {
    const lettaDir = join(tmp, ".letta");
    mkdirSync(lettaDir, { recursive: true });
    writeFileSync(join(lettaDir, "crons.json"), "{ broken json");
    const report = runDiagnostics({
      env: { LETTA_HOME: lettaDir },
      channelsRootOverride: join(lettaDir, "channels"),
      skipProcessScan: true,
    });
    assert.equal(report.cronFile.status, "invalid-json");
    assert.equal(report.cronFile.exists, true);
    assert.equal(report.cronFile.taskCount, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("runDiagnostics handles unsupported version crons.json", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: { version: 2, scheduler_owner: null, tasks: [] },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    assert.equal(report.cronFile.status, "unsupported-version");
    assert.equal(report.cronFile.taskCount, 0);
  } finally {
    cleanup();
  }
});

test("runDynamics handles missing channels directory", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [makeTask()],
    },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    assert.equal(report.channels.length, 0);
    // Check A should still run (no routes to match)
    const checkA = report.findings.filter((f) => f.check === "A");
    // Task with "default" and no routes → confirmed scope mismatch
    assert.ok(checkA.some((f) => f.taskStatus === "CRITICAL"));
  } finally {
    cleanup();
  }
});

test("runDiagnostics report never contains raw tokens", () => {
  const secretToken = "super-secret-token-1234567890abcdef";
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: {
        pid: 999999,
        token: secretToken,
        started_at: "2026-01-01T00:00:00.000Z",
        process_start_ticks: null,
        boot_id: null,
      },
      tasks: [],
    },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    const reportStr = JSON.stringify(report);
    assert.ok(!reportStr.includes(secretToken), "raw token must not appear");
    assert.ok(!reportStr.includes("token"), "token field must not appear");
    assert.ok(!reportStr.includes("<<redacted:"), "no redacted fingerprints");
  } finally {
    cleanup();
  }
});

test("runDiagnostics report never contains fingerprints", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: {
        pid: process.pid,
        token: "verylongsecrettoken1234567890abcdef",
        started_at: "2026-01-01T00:00:00.000Z",
        process_start_ticks: null,
        boot_id: null,
      },
      tasks: [makeTask()],
    },
    channels: {
      telegram: { routes: [makeRoute()] },
    },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    const reportStr = JSON.stringify(report);
    assert.ok(!reportStr.includes("fingerprint"), "no fingerprints");
    assert.ok(!reportStr.includes("<<redacted:"), "no redacted markers");
    assert.ok(!reportStr.includes("sha256"), "no hash references");
  } finally {
    cleanup();
  }
});

test("runDiagnostics is read-only — does not create or modify any files", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [makeTask()],
    },
    channels: {
      telegram: { routes: [makeRoute()] },
    },
  });
  try {
    const cronPath = getCronFilePath(env);
    const routingPath = join(channelsRoot, "telegram", "routing.yaml");

    // Snapshot file contents before
    const cronBefore = readFileSync(cronPath, "utf-8");
    const routingBefore = readFileSync(routingPath, "utf-8");

    runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });

    // Verify files are unchanged
    assert.equal(readFileSync(cronPath, "utf-8"), cronBefore);
    assert.equal(readFileSync(routingPath, "utf-8"), routingBefore);
  } finally {
    cleanup();
  }
});

test("runDiagnostics with skipProcessScan has checksRun=3", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: { version: 1, scheduler_owner: null, tasks: [] },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    assert.equal(report.summary.checksRun, 3);
  } finally {
    cleanup();
  }
});

test("runDiagnostics without skipProcessScan has checksRun=4", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: { version: 1, scheduler_owner: null, tasks: [] },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot });
    assert.equal(report.summary.checksRun, 4);
  } finally {
    cleanup();
  }
});

// ── No mutating advice tests ───────────────────────────────────────

test("Check A findings never recommend kill or hand-editing", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({ id: "t1", name: "bad", conversation_id: "conv-nope" }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkConversationMismatch(cronData, env, channelsRoot);
    const stepsStr = JSON.stringify(findings.flatMap((f) => f.reversibleNextSteps ?? []));
    assert.ok(!stepsStr.includes("kill"), "must not recommend kill");
    assert.ok(!stepsStr.includes("hand-edit"), "must not recommend hand-editing");
    assert.ok(!stepsStr.includes("curl"), "must not recommend curl");
  } finally {
    cleanup();
  }
});

test("Check B findings never recommend kill or hand-editing", () => {
  const cronData = {
    version: 1,
    scheduler_owner: {
      pid: 999999,
      token: "secret12345678901234567890",
      started_at: "2026-01-01T00:00:00.000Z",
    },
    tasks: [],
  };
  const findings = checkSchedulerOwner(cronData);
  const stepsStr = JSON.stringify(findings.flatMap((f) => f.reversibleNextSteps ?? []));
  assert.ok(!stepsStr.includes("kill"), "must not recommend kill");
  assert.ok(!stepsStr.includes("hand-edit"), "must not recommend hand-editing");
});

test("Check D findings recommend read-only commands, not kill or hand-editing", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: { version: 1, scheduler_owner: null, tasks: [makeTask()] },
    channels: { telegram: { routes: [makeRoute()] } },
  });
  try {
    const cronData = readCronFile(getCronFilePath(env)).data;
    const findings = checkAdapterStateLimitation(cronData, env, channelsRoot);
    const stepsStr = JSON.stringify(findings.flatMap((f) => f.reversibleNextSteps ?? []));
    assert.ok(!stepsStr.includes("kill"), "must not recommend kill");
    assert.ok(!stepsStr.includes("hand-edit"), "must not recommend hand-editing");
    assert.ok(!stepsStr.includes("curl"), "must not recommend curl");
    // Should prefer read-only commands
    assert.ok(stepsStr.includes("letta channels status"), "should recommend letta channels status");
  } finally {
    cleanup();
  }
});

// ── Absent token fields tests ──────────────────────────────────────

test("Check B: scheduler_owner without token field does not crash", () => {
  const cronData = {
    version: 1,
    scheduler_owner: {
      pid: process.pid,
      // no token field at all
      started_at: "2026-01-01T00:00:00.000Z",
    },
    tasks: [],
  };
  const findings = checkSchedulerOwner(cronData);
  const ok = findings.find((f) => f.severity === "ok");
  assert.ok(ok, "should still report ok for alive PID");
  // No token in output
  const findingsStr = JSON.stringify(findings);
  assert.ok(!findingsStr.includes("token"), "token field must not appear");
});

test("Check B: scheduler_owner with empty token does not crash", () => {
  const cronData = {
    version: 1,
    scheduler_owner: {
      pid: 999999,
      token: "",
      started_at: "2026-01-01T00:00:00.000Z",
    },
    tasks: [],
  };
  const findings = checkSchedulerOwner(cronData);
  const critical = findings.find((f) => f.severity === "critical");
  assert.ok(critical, "should report dead PID");
  const findingsStr = JSON.stringify(findings);
  assert.ok(!findingsStr.includes("token"), "token field must not appear");
});

// ── Invalid routing file tests in runDiagnostics ───────────────────

test("runDiagnostics reports invalid routing file status per channel", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: { version: 1, scheduler_owner: null, tasks: [] },
  });
  try {
    // Create a channel with invalid JSON routing
    const channelDir = join(channelsRoot, "telegram");
    mkdirSync(channelDir, { recursive: true });
    writeFileSync(join(channelDir, "routing.yaml"), "{ broken json");

    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    const telegram = report.channels.find((c) => c.channelId === "telegram");
    assert.ok(telegram, "telegram channel should be listed");
    assert.equal(telegram.routingStatus, "invalid-json");
    assert.equal(telegram.routeCount, 0);
  } finally {
    cleanup();
  }
});

test("runDiagnostics reports unsupported-version routing file", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: { version: 1, scheduler_owner: null, tasks: [] },
  });
  try {
    const channelDir = join(channelsRoot, "telegram");
    mkdirSync(channelDir, { recursive: true });
    writeFileSync(join(channelDir, "routing.yaml"), JSON.stringify({ version: 2 }));

    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    const telegram = report.channels.find((c) => c.channelId === "telegram");
    assert.equal(telegram.routingStatus, "unsupported-version");
  } finally {
    cleanup();
  }
});

// ── Silence is not OK tests ───────────────────────────────────────

test("runDiagnostics emits per-task findings so silence is not a clean bill of health", () => {
  const { env, channelsRoot, cleanup } = makeTempEnv({
    crons: {
      version: 1,
      scheduler_owner: null,
      tasks: [
        makeTask({ id: "t1", name: "task1", conversation_id: "conv-abcdef" }),
        makeTask({ id: "t2", name: "task2", conversation_id: "conv-abcdef" }),
        makeTask({ id: "t3", name: "task3", conversation_id: "conv-nope" }),
      ],
    },
    channels: {
      telegram: { routes: [makeRoute({ conversationId: "conv-abcdef" })] },
    },
  });
  try {
    const report = runDiagnostics({ env, channelsRootOverride: channelsRoot, skipProcessScan: true });
    const checkAFindings = report.findings.filter((f) => f.check === "A");
    // Should have one finding per active task (3)
    assert.equal(checkAFindings.length, 3);
    // Two should be OK, one CRITICAL
    const okCount = checkAFindings.filter((f) => f.taskStatus === "OK").length;
    const criticalCount = checkAFindings.filter((f) => f.taskStatus === "CRITICAL").length;
    assert.equal(okCount, 2);
    assert.equal(criticalCount, 1);
  } finally {
    cleanup();
  }
});
