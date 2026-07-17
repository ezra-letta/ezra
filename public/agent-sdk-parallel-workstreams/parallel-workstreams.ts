import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  LettaAgentClient,
  type SDKMessage,
} from "@letta-ai/letta-agent-sdk";

const STATE_PATH = fileURLToPath(new URL("./workstreams.json", import.meta.url));

type WorkstreamName = "research" | "writing";

type State = {
  agentId: string;
  conversations?: Partial<Record<WorkstreamName, string>>;
};

const client = new LettaAgentClient({
  backend: "cloud",
  apiKey: process.env.LETTA_API_KEY,
});

async function loadState(): Promise<State | undefined> {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8")) as State;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function saveState(state: State): Promise<void> {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

async function getOrCreateAgent(): Promise<string> {
  const configuredAgentId = process.env.LETTA_AGENT_ID;
  if (configuredAgentId) return configuredAgentId;

  const saved = await loadState();
  if (saved?.agentId) return saved.agentId;

  const agentId = await client.createAgent({
    model: process.env.LETTA_MODEL ?? "letta/auto",
    persona:
      "You are a persistent project partner. You research carefully, write clearly, and preserve durable user preferences across conversations.",
    human:
      "The user prefers concise answers, explicit evidence, and concrete next steps.",
  });

  await saveState({ agentId });
  console.log(`Created agent: ${agentId}`);
  return agentId;
}

function printEvent(workstream: WorkstreamName, message: SDKMessage): void {
  if (message.type === "assistant") {
    console.log(`\n[${workstream}] ${message.content}`);
  } else if (message.type === "tool_call") {
    console.log(`[${workstream}] tool: ${message.toolName}`);
  } else if (message.type === "result" && !message.success) {
    throw new Error(
      `[${workstream}] ${message.errorDetail ?? message.error ?? "Turn failed"}`,
    );
  }
}

async function startWorkstream(
  agentId: string,
  workstream: WorkstreamName,
  prompt: string,
): Promise<string> {
  const session = client.createSession(agentId);

  try {
    await session.send(prompt);
    for await (const message of session.stream()) {
      printEvent(workstream, message);
    }

    if (!session.conversationId) {
      throw new Error(`${workstream} session did not return a conversation ID`);
    }
    return session.conversationId;
  } finally {
    session.close();
  }
}

async function startBoth(): Promise<void> {
  const agentId = await getOrCreateAgent();

  // Promise.all is what makes the two independent conversations run concurrently.
  const [researchId, writingId] = await Promise.all([
    startWorkstream(
      agentId,
      "research",
      "Investigate three options for launching a small SDK release. Cite your evidence and recommend one option.",
    ),
    startWorkstream(
      agentId,
      "writing",
      "Draft a concise project brief for a small SDK release using our established preferences. Include goals, risks, and next steps.",
    ),
  ]);

  await saveState({
    agentId,
    conversations: { research: researchId, writing: writingId },
  });

  console.log("\nSaved workstreams to workstreams.json:");
  console.log(`  research: ${researchId}`);
  console.log(`  writing:  ${writingId}`);
}

async function resumeWorkstream(
  workstream: WorkstreamName,
  prompt: string,
): Promise<void> {
  const state = await loadState();
  const conversationId = state?.conversations?.[workstream];
  if (!conversationId) {
    throw new Error(`No saved ${workstream} conversation. Run npm start first.`);
  }

  const session = client.resumeSession(conversationId);
  try {
    await session.send(prompt);
    for await (const message of session.stream()) {
      printEvent(workstream, message);
    }
  } finally {
    session.close();
  }
}

async function main(): Promise<void> {
  if (!process.env.LETTA_API_KEY) {
    throw new Error("Set LETTA_API_KEY before running this example.");
  }

  const [command, requestedWorkstream, ...promptParts] = process.argv.slice(2);
  if (command !== "resume") {
    await startBoth();
    return;
  }

  if (requestedWorkstream !== "research" && requestedWorkstream !== "writing") {
    throw new Error("Choose a workstream: research or writing");
  }

  const prompt =
    promptParts.join(" ") ||
    "Continue from where we left off and give me the next concrete step.";
  await resumeWorkstream(requestedWorkstream, prompt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
