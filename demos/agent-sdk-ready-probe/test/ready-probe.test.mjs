import assert from "node:assert/strict";
import test from "node:test";
import { formatHuman, parseArgs, runProbe } from "../lib.mjs";

function fakeClient(events = []) {
  const calls = { ready: 0, send: [], close: 0, targetId: null };
  const info = {
    agentId: "agent-test",
    conversationId: "conv-test",
    model: "provider/model",
    tools: ["Read", "Bash"],
  };
  return {
    calls,
    resumeSession(targetId) {
      calls.targetId = targetId;
      return {
        async ready() {
          calls.ready += 1;
          return info;
        },
        async send(message) {
          calls.send.push(message);
        },
        async *stream() {
          for (const event of events) yield event;
        },
        close() {
          calls.close += 1;
        },
      };
    },
  };
}

test("parseArgs selects exactly one target", () => {
  assert.equal(parseArgs(["--agent", "agent-1"], {}).agent, "agent-1");
  assert.equal(
    parseArgs(["--agent", "agent-1"], {
      LETTA_CONVERSATION_ID: "conv-from-session",
    }).conversation,
    undefined,
  );
  assert.equal(
    parseArgs([], { LETTA_CONVERSATION_ID: "conv-1" }).conversation,
    "conv-1",
  );
  assert.throws(
    () => parseArgs(["--agent", "a", "--conversation", "c"], {}),
    /not both/,
  );
  assert.throws(() => parseArgs([], {}), /Pass --agent/);
});

test("readiness-only mode calls ready concurrently and never sends", async () => {
  const client = fakeClient();
  const ticks = [10, 42];
  const report = await runProbe({
    client,
    targetId: "conv-test",
    now: () => ticks.shift(),
  });

  assert.equal(client.calls.targetId, "conv-test");
  assert.equal(client.calls.ready, 3);
  assert.deepEqual(client.calls.send, []);
  assert.equal(client.calls.close, 1);
  assert.equal(report.ready.wallMs, 32);
  assert.equal(report.ready.consistent, true);
  assert.equal(report.turn, null);
});

test("optional model turn separates wall, submit, and SDK durations", async () => {
  const client = fakeClient([
    { type: "assistant", content: "READY" },
    {
      type: "result",
      success: true,
      durationMs: 125,
      stopReason: "end_turn",
      conversationId: "conv-test",
    },
  ]);
  const ticks = [0, 50, 60, 75, 90, 260];
  const report = await runProbe({
    client,
    targetId: "agent-test",
    message: "Reply with READY",
    now: () => ticks.shift(),
  });

  assert.deepEqual(client.calls.send, ["Reply with READY"]);
  assert.equal(report.turn.wallMs, 200);
  assert.equal(report.turn.submitMs, 15);
  assert.equal(report.turn.sdkDurationMs, 125);
  assert.equal(report.turn.assistant, "READY");
  assert.match(formatHuman(report), /full wall time: 200\.0 ms/);
  assert.match(formatHuman(report), /SDK durationMs: 125/);
});

test("session closes when ready fails", async () => {
  let closed = false;
  const client = {
    resumeSession() {
      return {
        ready: async () => {
          throw new Error("offline");
        },
        close: () => {
          closed = true;
        },
      };
    },
  };
  await assert.rejects(
    runProbe({ client, targetId: "agent-test" }),
    /offline/,
  );
  assert.equal(closed, true);
});
