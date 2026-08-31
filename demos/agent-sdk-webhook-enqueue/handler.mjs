import { createHash } from "node:crypto";

/**
 * Turn a provider webhook event ID into a stable Letta delivery ID.
 * Retrying one logical webhook event must reuse the same value.
 */
export function deliveryIdForEvent(eventId) {
  if (typeof eventId !== "string" || eventId.trim() === "") {
    throw new Error("eventId must be a non-empty string");
  }
  return `webhook-${createHash("sha256").update(eventId).digest("hex")}`;
}

function requireText(value, name, maxLength) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new Error(`${name} must be at most ${maxLength} characters`);
  }
  return text;
}

/**
 * Framework-neutral webhook core. Verify the provider's signature before
 * calling this function; this example only owns validation and Letta enqueue.
 */
export async function handleWebhook({
  client,
  event,
  conversationId,
  agentId,
  permissionMode = "standard",
  workingDirectory,
}) {
  const target = requireText(conversationId, "conversationId", 200);
  const eventId = requireText(event?.id, "event.id", 500);
  const subject = requireText(event?.subject, "event.subject", 200);
  const detail = requireText(event?.detail, "event.detail", 4_000);

  if (target === "default" && !agentId) {
    throw new Error('agentId is required when conversationId is "default"');
  }

  const clientMessageId = deliveryIdForEvent(eventId);
  const message = [
    "A verified external webhook was received.",
    `Subject: ${subject}`,
    `Detail: ${detail}`,
    `Source event: ${eventId}`,
    "Process this event according to the current conversation instructions.",
  ].join("\n");

  const receipt = await client.conversations.enqueue(target, message, {
    clientMessageId,
    permissionMode,
    ...(agentId ? { agentId } : {}),
    ...(workingDirectory !== undefined ? { workingDirectory } : {}),
  });

  // This is an acceptance receipt, not a completed agent response.
  return {
    statusCode: 202,
    body: JSON.stringify({
      accepted: true,
      clientMessageId: receipt.clientMessageId,
      workflowId: receipt.workflowId,
      superRunId: receipt.superRunId,
    }),
  };
}
