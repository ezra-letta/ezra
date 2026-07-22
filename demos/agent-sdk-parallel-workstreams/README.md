# Two parallel workstreams on one Letta agent

This runnable TypeScript demo gives one persistent Letta agent two independent conversations:

- a **research** workstream
- a **writing** workstream

The turns run concurrently and stream independently. Both conversations share the same agent and its durable memory, but their active transcripts remain separate. The script saves each `conversationId` so you can resume either exact thread later.

## Run it

Create a Letta API key at [platform.letta.com/api-keys](https://platform.letta.com/api-keys), then:

```bash
git clone https://github.com/ezra-letta/ezra.git
cd ezra/demos/agent-sdk-parallel-workstreams
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

Expected terminal output includes interleaved `[research]` and `[writing]`
responses, followed by a JSON object containing one agent ID and two different
conversation IDs:

```text
Created agent: agent-...
[research] ...
[writing] ...
Saved workstream IDs to .../.workstreams.json
{
  "agentId": "agent-...",
  "researchConversationId": "conv-...",
  "writingConversationId": "conv-..."
}
```

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

## Adapt it

Replace the two prompts and state keys with workstreams from your own project,
such as implementation/review, customer research/spec writing, or incident
investigation/status updates. Keep separate conversations when each workstream
needs its own active transcript, but use the same agent when they should share
durable identity and memory.

## Security and cleanup

- Keep `LETTA_API_KEY` in your environment. Do not place it in source code or
  `.workstreams.json`.
- Run `npm audit` and assess the current Agent SDK dependency tree before using
  this code in production. Do not silence transitive native-library advisories
  with an untested package override; an incompatible `sharp` override can stop
  the bundled Letta Code runtime from starting.
- `.workstreams.json` is gitignored because it records IDs from your account.
- The demo closes both live SDK sessions after each run. Closing a session does
  not delete the persistent agent or its conversations.
- If the script created a disposable agent, remove it later from Letta's agent
  management UI if you no longer need it.

See the [Letta Agent SDK quickstart](https://docs.letta.com/letta-agent-sdk/quickstart/) for session options, permissions, local and remote backends, and additional stream event types.
