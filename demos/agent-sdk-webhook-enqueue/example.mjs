#!/usr/bin/env node

import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";
import { handleWebhook } from "./handler.mjs";

if (!process.env.LETTA_API_KEY) {
  throw new Error("LETTA_API_KEY is required");
}
if (!process.env.LETTA_CONVERSATION_ID) {
  throw new Error("LETTA_CONVERSATION_ID is required");
}

const client = new LettaAgentClient({ backend: "cloud" });
const result = await handleWebhook({
  client,
  conversationId: process.env.LETTA_CONVERSATION_ID,
  agentId: process.env.LETTA_AGENT_ID,
  event: {
    id: process.env.WEBHOOK_EVENT_ID ?? "example-event-001",
    subject: "Build finished",
    detail: "The documentation build completed successfully.",
  },
});

console.log(result.statusCode, result.body);
