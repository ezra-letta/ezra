# Durable Cloud webhook enqueue

Hand a verified webhook event to a cloud-hosted Letta conversation, receive an
HTTP 202 acceptance receipt, and let the caller exit without holding a session
or WebSocket open for the agent turn.

This demo uses `client.conversations.enqueue()`, released in
`@letta-ai/letta-agent-sdk` `0.8.0` for the Cloud backend.

## The boundary this demo preserves

```text
provider webhook
      │
      ▼
verify signature  ← your adapter must do this first
      │
      ▼
validate + bound event fields
      │
      ▼
conversations.enqueue(...)
      │
      ▼
HTTP 202 + IDs     ← durable acceptance, not completed inference
      │
      └──────────── caller may exit

Cloud queue → runtime → model/tools → persisted response
```

A normal Agent SDK session is the right surface when the application needs to
stream the response, execute client-hosted tools, or handle interactive
approvals. `enqueue()` is for short-lived callers such as serverless webhook
handlers that need to hand off work and return.

## Setup

Requirements:

- Node.js 22.19+
- Letta Agent SDK `0.8.0`
- a Letta Cloud API key
- an existing concrete Cloud conversation, or an agent ID for its virtual
  `default` conversation

```bash
cd demos/agent-sdk-webhook-enqueue
npm install
npm test
```

The tests are offline. They use a fake management client and do not contact
Letta Cloud or invoke a model.

## Adapt the framework-neutral handler

`handler.mjs` expects a client, target, and already-verified event:

```js
const result = await handleWebhook({
  client,
  conversationId: "conv-...",
  event: {
    id: providerEvent.id,
    subject: "Build finished",
    detail: "The documentation build passed.",
  },
});

return new Response(result.body, { status: result.statusCode });
```

The returned body contains:

```json
{
  "accepted": true,
  "clientMessageId": "webhook-...",
  "workflowId": "...",
  "superRunId": "..."
}
```

Store those IDs with the webhook event. They identify queue acceptance and can
support later lifecycle correlation; they are not an assistant response.

## Retry without duplicating the logical message

The SDK documentation requires callers to reuse one `clientMessageId` when
retrying the same logical input. This demo hashes the provider's stable event ID
into a deterministic value:

```js
clientMessageId = "webhook-" + sha256(providerEvent.id)
```

If the Cloud request fails, let the webhook platform retry the same event ID.
Do not generate a fresh random ID for each delivery attempt. A different
provider event receives a different ID.

## Target the virtual default conversation

A concrete `conv-...` target needs only the conversation ID. The virtual
`default` conversation is agent-scoped and therefore also requires `agentId`:

```js
await handleWebhook({
  client,
  conversationId: "default",
  agentId: "agent-...",
  event,
});
```

The demo also forwards optional `permissionMode` and `workingDirectory` values.
Use a concrete working directory available on the selected runtime; this demo
does not validate remote filesystem existence.

## Run one real enqueue

This command creates a real queued message and may incur model/provider usage:

```bash
export LETTA_API_KEY='...'
export LETTA_CONVERSATION_ID='conv-...'
export WEBHOOK_EVENT_ID='build-2026-08-31-001'
npm run example
```

For the virtual default conversation, set
`LETTA_CONVERSATION_ID=default` and `LETTA_AGENT_ID=agent-...`.

Expected immediate output shape:

```text
202 {"accepted":true,"clientMessageId":"webhook-...","workflowId":"...","superRunId":"..."}
```

Again, this means Cloud accepted the item. Inspect the conversation or your
application's later reconciliation path for the eventual turn outcome.

## Security and production notes

- Authenticate the public webhook endpoint and verify the provider signature
  before calling `handleWebhook()`.
- Keep `LETTA_API_KEY` in server-side secret storage. Do not ship it to a
  browser, mobile app, webhook payload, or repository.
- Treat webhook text as untrusted input. This demo trims and bounds fields, but
  your agent instructions and permission mode remain the actual tool-safety
  boundary.
- Return success to the provider only after `enqueue()` returns its acceptance
  receipt. If it throws, return a retryable failure according to that
  provider's webhook contract while preserving the same event ID.
- `conversations.enqueue()` is Cloud-only. Local and Remote App Server callers
  should use a session's `send()` / `stream()` path.
- Agent SDK `0.8.0` pins Letta Code `0.30.28`; installing the SDK does not
  update a separately installed Letta Code CLI.

## Verification

On August 31, 2026:

- all seven offline demo tests passed
- the demo imported and exercised the published Agent SDK `0.8.0` contract
- the five upstream enqueue tests passed with 17 expectations
- commit `efaf938` was verified as an ancestor of release tag `v0.8.0`
- no real Cloud enqueue or model turn was performed during verification

`npm audit --omit=dev` reported three high-severity inherited
`sharp`/libvips findings through the SDK's pinned Letta Code dependency, with no
fix available in the published dependency tree. This webhook example does not
process images, but adopters should review the current audit and upgrade when a
patched SDK dependency is released rather than treating this demo as a security
review.

Sources:

- [Agent SDK `v0.8.0` release](https://github.com/letta-ai/letta-agent-sdk/releases/tag/v0.8.0)
- [Released enqueue implementation](https://github.com/letta-ai/letta-agent-sdk/commit/efaf93867dca4dcd9b0aa6e659220e92c667cb0c)
- [Agent SDK documentation](https://docs.letta.com/agent-sdk/)
