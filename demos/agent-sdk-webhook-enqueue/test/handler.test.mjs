import assert from "node:assert/strict";
import test from "node:test";
import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";
import { deliveryIdForEvent, handleWebhook } from "../handler.mjs";

function fakeClient() {
  const calls = [];
  return {
    calls,
    conversations: {
      async enqueue(conversationId, message, options) {
        calls.push({ conversationId, message, options });
        return {
          clientMessageId: options.clientMessageId,
          workflowId: `conversation-queue:${conversationId}`,
          superRunId: "super-run-test",
        };
      },
    },
  };
}

test("returns the Cloud acceptance receipt without opening a session", async () => {
  const client = fakeClient();
  const result = await handleWebhook({
    client,
    conversationId: "conv-test",
    event: {
      id: "provider-event-42",
      subject: "Build finished",
      detail: "Tests passed.",
    },
  });

  assert.equal(result.statusCode, 202);
  assert.deepEqual(JSON.parse(result.body), {
    accepted: true,
    clientMessageId: deliveryIdForEvent("provider-event-42"),
    workflowId: "conversation-queue:conv-test",
    superRunId: "super-run-test",
  });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].conversationId, "conv-test");
  assert.match(client.calls[0].message, /Tests passed\./);
  assert.equal(client.calls[0].options.permissionMode, "standard");
  assert.equal("agentId" in client.calls[0].options, false);
});

test("exercises the published Agent SDK 0.8.0 Cloud request contract", async () => {
  const requests = [];
  const client = new LettaAgentClient({
    backend: "cloud",
    apiBaseUrl: "https://api.test",
    apiKey: "test-key",
    fetch: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      const body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          client_message_id: body.client_message_id,
          workflow_id: "conversation-queue:conv-sdk-test",
          super_run_id: "super-run-sdk-test",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const result = await handleWebhook({
    client,
    conversationId: "conv-sdk-test",
    event: { id: "sdk-event", subject: "Build", detail: "Passed." },
  });

  assert.equal(result.statusCode, 202);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url.pathname,
    "/v1/conversations/conv-sdk-test/messages/enqueue",
  );
  const requestBody = JSON.parse(String(requests[0].init.body));
  assert.equal(
    requestBody.client_message_id,
    deliveryIdForEvent("sdk-event"),
  );
  assert.equal(requestBody.messages[0].role, "user");
});

test("retries of one provider event reuse one delivery ID", async () => {
  const client = fakeClient();
  const input = {
    client,
    conversationId: "conv-test",
    event: { id: "evt-retry", subject: "Alert", detail: "Disk is full." },
  };

  await handleWebhook(input);
  await handleWebhook(input);

  assert.equal(client.calls.length, 2);
  assert.equal(
    client.calls[0].options.clientMessageId,
    client.calls[1].options.clientMessageId,
  );
});

test("different provider events receive different delivery IDs", () => {
  assert.notEqual(deliveryIdForEvent("event-a"), deliveryIdForEvent("event-b"));
  assert.match(deliveryIdForEvent("event-a"), /^webhook-[a-f0-9]{64}$/);
});

test("default conversation requires agent scope and forwards runtime settings", async () => {
  const client = fakeClient();
  const event = { id: "event-1", subject: "Deploy", detail: "Ready." };

  await assert.rejects(
    handleWebhook({ client, conversationId: "default", event }),
    /agentId is required/,
  );

  await handleWebhook({
    client,
    conversationId: "default",
    agentId: "agent-test",
    permissionMode: "strict",
    workingDirectory: "/workspace/project",
    event,
  });
  assert.deepEqual(client.calls[0].options, {
    clientMessageId: deliveryIdForEvent("event-1"),
    permissionMode: "strict",
    agentId: "agent-test",
    workingDirectory: "/workspace/project",
  });
});

test("rejects missing and oversized external fields before enqueue", async () => {
  const client = fakeClient();
  await assert.rejects(
    handleWebhook({
      client,
      conversationId: "conv-test",
      event: { id: "", subject: "Alert", detail: "Something happened." },
    }),
    /event\.id must be a non-empty string/,
  );
  await assert.rejects(
    handleWebhook({
      client,
      conversationId: "conv-test",
      event: { id: "event-1", subject: "x".repeat(201), detail: "detail" },
    }),
    /event\.subject must be at most 200 characters/,
  );
  assert.equal(client.calls.length, 0);
});

test("propagates enqueue rejection so the webhook platform can retry", async () => {
  const client = {
    conversations: {
      async enqueue() {
        throw new Error("Cloud enqueue failed");
      },
    },
  };
  await assert.rejects(
    handleWebhook({
      client,
      conversationId: "conv-test",
      event: { id: "event-1", subject: "Alert", detail: "Retry me." },
    }),
    /Cloud enqueue failed/,
  );
});
