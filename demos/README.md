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
| [Execution-environment truth probe](execution-environment-truth-probe/) | Letta Agent / Letta Code diagnostic | Separate observed tool-host facts from injected labels and selected-device claims | 5–10 minutes |
| [Parallel Agent SDK workstreams](agent-sdk-parallel-workstreams/) | Letta Agent SDK | Two concurrent conversations on one persistent agent, plus exact-thread resume | 10–15 minutes |

## Before you run a demo

Examples may create agents, conversations, sandboxes, files, or other billable
resources. Read the individual demo's cleanup section first. Keep API keys in
environment variables, never commit generated state files, and use only model
handles available to your account.

These examples target current maintained Letta surfaces. They do not use the
legacy Docker API server, LettaBot, or deprecated `send_message` behavior.
