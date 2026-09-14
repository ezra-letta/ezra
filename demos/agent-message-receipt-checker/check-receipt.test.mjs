import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { classifyReceipt } from "./check-receipt.mjs";

const receipt = {
  status: "queued",
  agent_id: "agent-example",
  conversation_id: "conv-example",
  client_message_id: "message-1",
  workflow_id: "workflow-1",
  super_run_id: "super-run-1",
  status_command:
    "letta messages status --agent agent-example --conversation conv-example",
  messages_command:
    "letta messages list --agent agent-example --conversation conv-example",
};

const snapshot = {
  agent_id: "agent-example",
  conversation_id: "conv-example",
  runtime_status: { state: "IDLE" },
  latest_super_run: {
    id: "super-run-1",
    status: "COM",
    completed_at: "2026-09-14T16:00:00Z",
    errored_at: null,
    cancelled_at: null,
  },
};

test("queued alone means accepted, not completed", () => {
  assert.equal(classifyReceipt(receipt).verdict, "accepted_unchecked");
});

test("matching terminal timestamps classify the accepted send", () => {
  assert.equal(classifyReceipt(receipt, snapshot).verdict, "completed");
  assert.equal(
    classifyReceipt(receipt, {
      ...snapshot,
      latest_super_run: {
        ...snapshot.latest_super_run,
        completed_at: null,
        errored_at: "2026-09-14T16:01:00Z",
      },
    }).verdict,
    "failed",
  );
  assert.equal(
    classifyReceipt(receipt, {
      ...snapshot,
      latest_super_run: {
        ...snapshot.latest_super_run,
        completed_at: null,
        cancelled_at: "2026-09-14T16:02:00Z",
      },
    }).verdict,
    "cancelled",
  );
});

test("idle with a nonterminal matching run is not completion", () => {
  const result = classifyReceipt(receipt, {
    ...snapshot,
    latest_super_run: {
      ...snapshot.latest_super_run,
      status: "RUN",
      completed_at: null,
    },
  });
  assert.equal(result.verdict, "accepted_not_terminal");
  assert.match(result.evidence, /IDLE.*not a completion receipt/);
});

test("different latest super-run makes current status inconclusive", () => {
  const result = classifyReceipt(receipt, {
    ...snapshot,
    latest_super_run: { ...snapshot.latest_super_run, id: "super-run-2" },
  });
  assert.equal(result.verdict, "different_latest_send");
  assert.match(result.next, /messages list/);
});

test("wrong snapshot destination is rejected as evidence", () => {
  const result = classifyReceipt(receipt, {
    ...snapshot,
    conversation_id: "conv-other",
  });
  assert.equal(result.verdict, "wrong_status_target");
});

test("submission failure and unknown acceptance stay distinct", () => {
  assert.equal(
    classifyReceipt({ status: "submission_failed", error: "Cloud only" })
      .verdict,
    "not_accepted",
  );
  assert.equal(
    classifyReceipt({
      ...receipt,
      status: "acceptance_unknown",
      error: "Connection closed",
    }).verdict,
    "check_before_resend",
  );
});

test("malformed receipts fail closed", () => {
  assert.throws(() => classifyReceipt({ status: "queued" }), /agent_id/);
  assert.throws(
    () =>
      classifyReceipt({
        ...receipt,
        conversation_id: "conv-example; echo unsafe",
      }),
    /not a valid conversation ID/,
  );
  assert.throws(
    () => classifyReceipt({ status: "completed" }),
    /unsupported receipt.status/,
  );
});

test("unknown acceptance never prints an unvalidated receipt command", () => {
  const result = classifyReceipt({
    status: "acceptance_unknown",
    error: "Connection closed",
    agent_id: "agent-example",
    conversation_id: "conv-example; echo unsafe",
    messages_command: "echo unsafe",
  });
  assert.equal(result.verdict, "check_before_resend");
  assert.doesNotMatch(result.next, /echo/);
});

test("published CLI fixture produces a concise human verdict", () => {
  const directory = fileURLToPath(new URL(".", import.meta.url));
  const output = execFileSync(
    process.execPath,
    [
      "check-receipt.mjs",
      "--receipt",
      "fixtures/queued.json",
      "--status",
      "fixtures/status-matching-complete.json",
    ],
    { cwd: directory, encoding: "utf8" },
  );
  assert.match(output, /^Verdict: completed/m);
  assert.match(output, /^Next: letta messages list/m);
});
