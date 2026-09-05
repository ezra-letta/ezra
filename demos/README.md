# Letta demos

Runnable examples for building with Letta. Each folder includes:

- a focused outcome you can verify
- copyable setup and run commands
- complete source files
- an explanation of the Letta pattern being demonstrated
- cleanup and security notes where relevant

## Catalog

| Demo | Surface | What it demonstrates | Time |
| --- | --- | --- | --- |
| [Agent SDK `ready()` timing probe](agent-sdk-ready-probe/) | Letta Agent SDK | Pre-initialize runtime and transport, then separate startup timing from optional model-turn timing | 5–10 minutes |
| [Durable Cloud webhook enqueue](agent-sdk-webhook-enqueue/) | Letta Agent SDK / Cloud | Hand off a verified event with a stable delivery ID, then return after queue acceptance rather than completed inference | 5–10 minutes |
| [Computer-command linter](computer-command-linter/) | Letta Code CLI / remote computers | Find hidden compatibility aliases in scripts and docs, then report canonical `v0.31.12+` computer spellings without rewriting files | 2–5 minutes |
| [Execution-environment truth probe](execution-environment-truth-probe/) | Letta Agent / Letta Code diagnostic | Separate observed tool-host facts from injected labels and selected-device claims | 5–10 minutes |
| [Parallel Agent SDK workstreams](agent-sdk-parallel-workstreams/) | Letta Agent SDK | Two concurrent conversations on one persistent agent, plus exact-thread resume | 10–15 minutes |
| [Cron + Channels route doctor](cron-channels-route-doctor/) | Letta Code diagnostic | Read-only inspection of crons.json + routing.yaml for conversation mismatch, scheduler liveness, multi-listener, and adapter-state-limitation | 2–5 minutes |
| [Archival-memory API mod](archival-memory-mod/) | Letta Agent / Letta Code mod | Agent-scoped tools for searching, listing, and optionally appending to an agent's archive through the API | 5–10 minutes |
| [GitHub Action preflight](github-action-preflight/) | Letta Code / GitHub Action | Read-only check of GitHub CLI auth, token scopes, and the generated Letta workflow contract | 2–5 minutes |

## Before you run a demo

Examples may create agents, conversations, sandboxes, files, or other billable
resources. Read the individual demo's cleanup section first. Keep API keys in
environment variables, never commit generated state files, and use only model
handles available to your account.

These examples target current maintained Letta surfaces. They do not use the
legacy Docker API server, LettaBot, or deprecated `send_message` behavior.
