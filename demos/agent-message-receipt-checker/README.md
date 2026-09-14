# Agent message receipt checker

A queued Cloud agent message is a handoff receipt, not a completion receipt.
This zero-dependency demo reconciles the JSON returned by Letta Code
`--no-wait` or `SendAgentMessage` with a later
`letta messages status` snapshot without making that mistake.

It answers three deliberately narrow questions:

1. Did Cloud confirm acceptance, reject submission, or leave acceptance unknown?
2. Does the status snapshot describe the same agent and conversation?
3. Does `latest_super_run.id` match the receipt's `super_run_id`, and if so,
   does the matching object contain a terminal timestamp?

It does **not** execute receipt-provided commands, contact Letta Cloud, infer
completion from `runtime_status.state: "IDLE"`, or claim that a different latest
super-run describes the original send.

## Requirements

- Node.js 20.17 or newer (verified here with Node.js 24.14)
- No package install and no API key

## Run the included examples

```bash
cd demos/agent-message-receipt-checker

node check-receipt.mjs \
  --receipt fixtures/queued.json

node check-receipt.mjs \
  --receipt fixtures/queued.json \
  --status fixtures/status-matching-complete.json

node check-receipt.mjs \
  --receipt fixtures/queued.json \
  --status fixtures/status-different-latest.json \
  --json
```

Expected human-readable result for the matching fixture:

```text
Verdict: completed
Evidence: Matching super-run super-run-1 completed at 2026-09-14T16:00:00Z.
Next: letta messages list --agent agent-example --conversation conv-example
```

The different-latest fixture returns `different_latest_send`, because the
conversation's newest run belongs to another send. The current runtime being
idle does not repair that evidence gap.

## Use it with a real receipt

Letta Code `0.32.4+` can submit non-blocking input to another Cloud
conversation. Preserve the JSON output instead of scraping the TUI:

```bash
letta -p "Please inspect the build and record the result in this conversation." \
  --from-agent agent-sender \
  --conversation conv-recipient \
  --no-wait \
  --output-format json \
  > receipt.json
```

Replace the synthetic agent and conversation IDs with your own Cloud IDs.

The queued receipt includes ready-made status and message-list commands. Run
the status command yourself and save its JSON:

```bash
letta messages status \
  --agent agent-recipient \
  --conversation conv-recipient \
  > status.json

node check-receipt.mjs --receipt receipt.json --status status.json
```

Use the exact resolved agent/conversation IDs from the receipt; an agent-only
send may create a new destination conversation. The checker compares both IDs
before accepting the snapshot as evidence.

The agent-scoped virtual `default` conversation currently has no
`latest_super_run` comparison in `letta messages status`; use the message list
for that destination. Letta Code `0.32.8+` also rejects sending back into the
current conversation. Another conversation of the same agent remains valid.

For an `acceptance_unknown` result, inspect messages **before** resending. The
original input may already have been accepted. For a queued receipt, remember
that acceptance is not execution or completion. For a completed matching
super-run, inspect the destination messages for the actual assistant reply.

`SendAgentMessage` returns ordinary tool-result JSON with the same correlation
fields, but its compact Letta Code `0.32.6+` TUI card intentionally displays a
human status rather than the full raw receipt. This checker is for captured
JSON evidence, logs, and automation—not for parsing terminal presentation.

## Tests

```bash
npm test
```

The tests cover queued-only, completed, failed, cancelled, matching but
nonterminal, different-latest, wrong-destination, unknown-acceptance,
submission-failure, malformed receipt, and CLI fixture behavior.

## Security and cleanup

- The included IDs and timestamps are synthetic.
- The checker only reads local JSON files and prints text or JSON.
- It never executes or repeats `status_command` or `messages_command` from
  untrusted JSON; suggested commands are reconstructed from validated IDs.
- Real receipts expose agent/conversation IDs but should still be reviewed
  before publishing because adjacent errors or messages may contain sensitive
  content.
- Remove local `receipt.json` and `status.json` when finished if they contain
  operational metadata you do not want to retain.

## Version boundary and sources

- Cloud non-blocking agent messaging and `SendAgentMessage` were released in
  [Letta Code `v0.32.4`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.4).
- Compact readable TUI receipt cards were released in
  [Letta Code `v0.32.6`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.6).
- The checker follows the current released status evidence contract through
  [Letta Code `v0.32.8`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.8): compare the receipt's super-run ID, do not equate idle with completion,
  and inspect messages when another send is latest.
- [Letta conversations](https://docs.letta.com/concepts/conversations/)

The demo does not send a live agent message or make a model call.
