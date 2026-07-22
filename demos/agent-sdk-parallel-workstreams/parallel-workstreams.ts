import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";

type AgentSession = ReturnType<LettaAgentClient["createSession"]>;

interface WorkstreamState {
  agentId: string;
  researchConversationId: string;
  writingConversationId: string;
}

const statePath = join(process.cwd(), ".workstreams.json");

function requireApiKey(): string {
  const apiKey = process.env.LETTA_API_KEY;
  if (!apiKey) {
    throw new Error("Set LETTA_API_KEY before running this example.");
  }
  return apiKey;
}

async function streamTurn(
  session: AgentSession,
  label: string,
  prompt: string,
): Promise<void> {
  console.log(`\n[${label}] Sending: ${prompt}\n`);
  await session.send(prompt);

  for await (const message of session.stream()) {
    if (message.type === "assistant") {
      console.log(`[${label}] ${message.content}`);
    }

    if (message.type === "result" && !message.success) {
      throw new Error(
        `[${label}] ${message.errorDetail ?? message.error ?? "Turn failed"}`,
      );
    }
  }
}

async function getOrCreateAgent(client: LettaAgentClient): Promise<string> {
  if (process.env.LETTA_AGENT_ID) {
    return process.env.LETTA_AGENT_ID;
  }

  const agentId = await client.createAgent({
    model: process.env.LETTA_MODEL ?? "letta/auto",
    persona:
      "You are a persistent project partner. Keep durable preferences and project context in memory while treating each conversation as an independent workstream.",
    human:
      "The user prefers concise outputs, cited evidence, explicit assumptions, and concrete next actions.",
  });

  console.log(`Created agent: ${agentId}`);
  return agentId;
}

async function startWorkstreams(client: LettaAgentClient): Promise<void> {
  const agentId = await getOrCreateAgent(client);
  const research = client.createSession(agentId);
  const writing = client.createSession(agentId);

  try {
    await Promise.all([
      streamTurn(
        research,
        "research",
        "Investigate three viable approaches to launching a small developer SDK. Cite the evidence for each option, compare tradeoffs, and recommend one.",
      ),
      streamTurn(
        writing,
        "writing",
        "Draft a one-page SDK launch brief using our established preferences. Include audience, promise, scope, risks, and next actions.",
      ),
    ]);

    if (!research.conversationId || !writing.conversationId) {
      throw new Error("The SDK did not return both conversation IDs.");
    }

    const state: WorkstreamState = {
      agentId,
      researchConversationId: research.conversationId,
      writingConversationId: writing.conversationId,
    };

    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    console.log(`\nSaved workstream IDs to ${statePath}`);
    console.log(JSON.stringify(state, null, 2));
  } finally {
    research.close();
    writing.close();
  }
}

async function resumeWorkstream(
  client: LettaAgentClient,
  workstream: string | undefined,
  promptParts: string[],
): Promise<void> {
  if (workstream !== "research" && workstream !== "writing") {
    throw new Error(
      'Choose a workstream: npm run resume -- research "your follow-up"',
    );
  }

  const state = JSON.parse(
    await readFile(statePath, "utf8"),
  ) as WorkstreamState;
  const conversationId =
    workstream === "research"
      ? state.researchConversationId
      : state.writingConversationId;
  const prompt = promptParts.join(" ").trim();

  if (!prompt) {
    throw new Error("Provide a follow-up prompt after the workstream name.");
  }

  const session = client.resumeSession(conversationId);
  try {
    await streamTurn(session, workstream, prompt);
  } finally {
    session.close();
  }
}

async function main(): Promise<void> {
  const client = new LettaAgentClient({
    backend: "cloud",
    apiKey: requireApiKey(),
  });
  const [command = "start", workstream, ...promptParts] = process.argv.slice(2);

  if (command === "start") {
    await startWorkstreams(client);
    return;
  }

  if (command === "resume") {
    await resumeWorkstream(client, workstream, promptParts);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
