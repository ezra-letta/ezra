#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function string(value, field, required = true) {
  if (typeof value === "string" && value.length > 0) return value;
  if (!required && (value === null || value === undefined)) return null;
  throw new Error(`${field} must be a non-empty string`);
}

function address(value, field, kind) {
  const result = string(value, field);
  const pattern =
    kind === "agent"
      ? /^agent-[a-zA-Z0-9-]+$/
      : /^(?:default|conv-[a-zA-Z0-9-]+)$/;
  if (!pattern.test(result)) throw new Error(`${field} is not a valid ${kind} ID`);
  return result;
}

function inspectCommand(receipt) {
  try {
    const agentId = address(receipt.agent_id, "receipt.agent_id", "agent");
    const conversationId = address(
      receipt.conversation_id,
      "receipt.conversation_id",
      "conversation",
    );
    return `letta messages list --agent ${agentId} --conversation ${conversationId}`;
  } catch {
    return null;
  }
}

/**
 * Reconcile one SendAgentMessage/headless --no-wait receipt with a later
 * `letta messages status` snapshot. This never executes commands from either
 * input and never treats runtime IDLE as proof of delivery.
 */
export function classifyReceipt(receipt, snapshot = null) {
  if (!isRecord(receipt)) throw new Error("receipt must be a JSON object");
  const receiptStatus = string(receipt.status, "receipt.status");
  const command = inspectCommand(receipt);

  if (receiptStatus === "submission_failed") {
    return {
      verdict: "not_accepted",
      evidence: "Cloud reported that submission failed.",
      next:
        typeof receipt.error === "string"
          ? receipt.error
          : "Fix the submission error before trying again.",
    };
  }

  if (receiptStatus === "acceptance_unknown") {
    return {
      verdict: "check_before_resend",
      evidence:
        "Submission was attempted, but the client could not confirm acceptance.",
      next:
        command ??
        "Inspect the destination conversation before resending; it may already contain the input.",
    };
  }

  if (receiptStatus !== "queued") {
    throw new Error(`unsupported receipt.status: ${receiptStatus}`);
  }

  const agentId = address(receipt.agent_id, "receipt.agent_id", "agent");
  const conversationId = address(
    receipt.conversation_id,
    "receipt.conversation_id",
    "conversation",
  );
  const superRunId = string(receipt.super_run_id, "receipt.super_run_id");
  string(receipt.client_message_id, "receipt.client_message_id");

  if (snapshot === null || snapshot === undefined) {
    return {
      verdict: "accepted_unchecked",
      evidence:
        "The queued receipt proves Cloud acceptance, not recipient completion.",
      next:
        `letta messages status --agent ${agentId} --conversation ${conversationId}`,
    };
  }
  if (!isRecord(snapshot)) throw new Error("status snapshot must be a JSON object");

  if (
    snapshot.agent_id !== agentId ||
    snapshot.conversation_id !== conversationId
  ) {
    return {
      verdict: "wrong_status_target",
      evidence: `Receipt targets ${agentId} / ${conversationId}, but the snapshot targets ${String(snapshot.agent_id)} / ${String(snapshot.conversation_id)}.`,
      next: `letta messages status --agent ${agentId} --conversation ${conversationId}`,
    };
  }

  const latest = snapshot.latest_super_run;
  if (latest === null || latest === undefined) {
    return {
      verdict: "accepted_no_run_visible",
      evidence:
        "Cloud accepted the input, but this snapshot exposes no latest super-run for comparison.",
      next: command ?? "Inspect the destination conversation messages.",
    };
  }
  if (!isRecord(latest))
    throw new Error("status.latest_super_run must be an object or null");
  const latestId = string(latest.id, "status.latest_super_run.id");

  if (latestId !== superRunId) {
    return {
      verdict: "different_latest_send",
      evidence: `Receipt super-run ${superRunId} does not match latest super-run ${latestId}. Runtime state cannot prove this receipt completed.`,
      next: command ?? "Inspect the destination conversation messages.",
    };
  }

  if (typeof latest.errored_at === "string" && latest.errored_at.length > 0) {
    return {
      verdict: "failed",
      evidence: `Matching super-run ${superRunId} errored at ${latest.errored_at}.`,
      next: command ?? "Inspect failed-step messages for the destination.",
    };
  }
  if (
    typeof latest.cancelled_at === "string" &&
    latest.cancelled_at.length > 0
  ) {
    return {
      verdict: "cancelled",
      evidence: `Matching super-run ${superRunId} was cancelled at ${latest.cancelled_at}.`,
      next: command ?? "Inspect the destination before deciding whether to resend.",
    };
  }
  if (
    typeof latest.completed_at === "string" &&
    latest.completed_at.length > 0
  ) {
    return {
      verdict: "completed",
      evidence: `Matching super-run ${superRunId} completed at ${latest.completed_at}.`,
      next: command ?? "Inspect the destination messages for the assistant reply.",
    };
  }

  return {
    verdict: "accepted_not_terminal",
    evidence: `The latest super-run matches ${superRunId}, but it has no completed, errored, or cancelled timestamp. Runtime state ${String(snapshot.runtime_status?.state ?? "unknown")} is context, not a completion receipt.`,
    next: `letta messages status --agent ${agentId} --conversation ${conversationId}`,
  };
}

function render(result) {
  return [
    `Verdict: ${result.verdict}`,
    `Evidence: ${result.evidence}`,
    `Next: ${result.next}`,
  ].join("\n");
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label} JSON at ${path}: ${error.message}`);
  }
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      receipt: { type: "string", short: "r" },
      status: { type: "string", short: "s" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  if (values.help || !values.receipt) {
    console.log(
      "Usage: node check-receipt.mjs --receipt <receipt.json> [--status <status.json>] [--json]",
    );
    return values.help ? 0 : 2;
  }
  const receipt = await readJson(values.receipt, "receipt");
  const snapshot = values.status
    ? await readJson(values.status, "status")
    : null;
  const result = classifyReceipt(receipt, snapshot);
  console.log(values.json ? JSON.stringify(result, null, 2) : render(result));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Error: ${error.message}`);
      process.exitCode = 2;
    });
}
