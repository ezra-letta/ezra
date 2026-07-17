# Two parallel workstreams on one Letta agent

This runnable TypeScript example gives one persistent Letta agent two independent conversations:

- a **research** workstream
- a **writing** workstream

The turns run concurrently and stream independently. Both conversations share the same agent and its durable memory, but their active transcripts remain separate. The script saves each `conversationId` so you can resume either exact thread later.

## Run it

Create a Letta API key at [platform.letta.com/api-keys](https://platform.letta.com/api-keys), then:

```bash
git clone https://github.com/ezra-letta/ezra.git
cd ezra/public/agent-sdk-parallel-workstreams
npm install

export LETTA_API_KEY="your-api-key"
npm start
```

By default, the script creates a new agent using `letta/auto`. To reuse an existing agent or choose another available model:

```bash
export LETTA_AGENT_ID="agent-your-id"
export LETTA_MODEL="your-model-handle"
npm start
```

After both initial turns finish, the script writes the agent and conversation IDs to `.workstreams.json`.

## Resume one exact workstream

Continue the research conversation without adding the follow-up to the writing transcript:

```bash
npm run resume -- research "Pressure-test the recommendation against a two-week deadline."
```

Or continue the writing conversation:

```bash
npm run resume -- writing "Rewrite the brief for an engineering-lead audience."
```

## What to notice

1. `createSession(agentId)` creates a new conversation on the existing agent.
2. `Promise.all(...)` runs and streams both sessions concurrently.
3. Each session receives a different `conversationId`.
4. `resumeSession(conversationId)` returns to that exact transcript.
5. The persistent agent identity and memory are shared across the conversations.

See the [Letta Agent SDK quickstart](https://docs.letta.com/letta-agent-sdk/quickstart/) for session options, permissions, local and remote backends, and additional stream event types.
