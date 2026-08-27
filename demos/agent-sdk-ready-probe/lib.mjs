import { performance } from "node:perf_hooks";

export function parseArgs(argv, env = process.env) {
  let explicitAgent = false;
  let explicitConversation = false;
  const options = {
    agent: env.LETTA_CONVERSATION_ID ? undefined : env.LETTA_AGENT_ID,
    conversation: env.LETTA_CONVERSATION_ID,
    message: undefined,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (["--agent", "--conversation", "--message"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      if (arg === "--agent") {
        if (explicitConversation) {
          throw new Error("Choose --agent or --conversation, not both");
        }
        explicitAgent = true;
        options.agent = value;
        options.conversation = undefined;
      } else if (arg === "--conversation") {
        if (explicitAgent) {
          throw new Error("Choose --agent or --conversation, not both");
        }
        explicitConversation = true;
        options.conversation = value;
        options.agent = undefined;
      } else {
        options.message = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.agent && options.conversation) {
    throw new Error("Choose --agent or --conversation, not both");
  }
  if (!options.agent && !options.conversation) {
    throw new Error(
      "Pass --agent/--conversation or set LETTA_AGENT_ID/LETTA_CONVERSATION_ID",
    );
  }
  return options;
}

export function usage() {
  return `Agent SDK ready() timing probe

Usage:
  npm run probe -- --agent <agent-id>
  npm run probe -- --conversation <conversation-id>
  npm run probe -- --agent <agent-id> --message "Reply with READY"

Options:
  --agent <id>          Resume the agent's default conversation
  --conversation <id>   Resume one exact conversation
  --message <text>      Also run one model turn (omitted by default)
  --json                Emit machine-readable JSON
  -h, --help            Show this help

Environment fallbacks:
  LETTA_AGENT_ID, LETTA_CONVERSATION_ID, LETTA_API_KEY`;
}

export async function runProbe({
  client,
  targetId,
  message,
  now = () => performance.now(),
}) {
  const session = client.resumeSession(targetId);
  try {
    const readyStarted = now();
    const readiness = await Promise.all([
      session.ready(),
      session.ready(),
      session.ready(),
    ]);
    const readyWallMs = now() - readyStarted;
    const consistent = readiness.every(
      (candidate) => JSON.stringify(candidate) === JSON.stringify(readiness[0]),
    );

    const report = {
      ready: {
        wallMs: readyWallMs,
        concurrentCalls: readiness.length,
        consistent,
        ...readiness[0],
      },
      turn: null,
    };

    if (message === undefined) return report;

    const turnStarted = now();
    const submitStarted = now();
    await session.send(message);
    const submitMs = now() - submitStarted;

    let result;
    let assistant = "";
    for await (const event of session.stream()) {
      if (event.type === "assistant") assistant += event.content;
      if (event.type === "result") result = event;
    }

    report.turn = {
      wallMs: now() - turnStarted,
      submitMs,
      sdkDurationMs: result?.durationMs,
      success: result?.success,
      stopReason: result?.stopReason,
      conversationId: result?.conversationId,
      assistant,
    };
    return report;
  } finally {
    session.close();
  }
}

export function formatHuman(report) {
  const lines = [
    "Runtime ready",
    `  wall time: ${report.ready.wallMs.toFixed(1)} ms`,
    `  concurrent ready() calls: ${report.ready.concurrentCalls}`,
    `  identical results: ${report.ready.consistent ? "yes" : "NO"}`,
    `  agent: ${report.ready.agentId}`,
    `  conversation: ${report.ready.conversationId}`,
    `  model: ${report.ready.model ?? "not reported"}`,
    `  tools loaded: ${report.ready.tools?.length ?? "not reported"}`,
  ];

  if (!report.turn) {
    lines.push("", "No model turn requested.");
    return lines.join("\n");
  }

  lines.push(
    "",
    "Model turn complete",
    `  full wall time: ${report.turn.wallMs.toFixed(1)} ms`,
    `  send() submission time: ${report.turn.submitMs.toFixed(1)} ms`,
    `  SDK durationMs: ${report.turn.sdkDurationMs ?? "not reported"}`,
    `  success: ${report.turn.success ?? "not reported"}`,
    `  stop reason: ${report.turn.stopReason ?? "not reported"}`,
  );
  if (report.turn.assistant) {
    lines.push("", "Assistant output:", report.turn.assistant);
  }
  return lines.join("\n");
}
