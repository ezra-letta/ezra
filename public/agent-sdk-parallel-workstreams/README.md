# Two parallel workstreams on one Letta agent

A Letta **agent** is the persistent entity with memory. Each **conversation** is
an independent thread on that agent. This example starts research and writing
conversations concurrently, streams both with labels, saves their conversation
IDs, and resumes either thread later.

## Run it

```bash
git clone https://github.com/ezra-letta/ezra.git
cd ezra/public/agent-sdk-parallel-workstreams
npm install

export LETTA_API_KEY="your-api-key"
npm start
```

The example uses Node.js 20 or newer.

If `LETTA_AGENT_ID` is unset, the script creates one agent with
`letta/auto` and saves its ID locally. To use an existing agent instead:

```bash
export LETTA_AGENT_ID="agent-..."
npm start
```

The two sessions run concurrently with `Promise.all`, but each receives its own
conversation ID. Their immediate transcripts stay separate while both retain
access to the same agent's durable memory.

## Resume one exact workstream

The first run writes the IDs to the gitignored `workstreams.json` file. Resume
either conversation by name:

```bash
npm run resume -- research "Compare the top two options in a decision table."
npm run resume -- writing "Revise the brief using the research recommendation."
```

`client.resumeSession(conversationId)` continues that exact transcript instead
of opening a new conversation.

## Configuration

- `LETTA_API_KEY` (required): your Letta API key.
- `LETTA_AGENT_ID` (optional): use an existing persistent agent.
- `LETTA_MODEL` (optional): model used only when the script creates an agent;
  defaults to `letta/auto`.

See the [Letta Agent SDK quickstart](https://docs.letta.com/letta-agent-sdk/quickstart/)
for session options, streaming event types, permissions, and other backends.
