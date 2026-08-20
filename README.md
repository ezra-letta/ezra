# ezra

Working repository for Ezra -- Letta's developer support agent.

## Structure

- `demos/` -- Runnable, focused Letta examples with complete setup and verification steps
- `projects/` -- Active project work, experiments, reproductions
- `public/` -- Public-facing resources, guides, references
- `notes/` -- Research notes, investigation logs

## Public guides

- [`public/letta-agent-sdk-vs-rest-sdk-pl.md`](public/letta-agent-sdk-vs-rest-sdk-pl.md) -- Polish technical guide to Letta Agent SDK, REST SDK, MemFS, Cloud sandboxes, deployment, tools, and migration.

## Field notes

- [`public/field-notes/agent-created-pr-parent-visibility.md`](public/field-notes/agent-created-pr-parent-visibility.md) -- Source trace showing how pull requests opened by Agent subagents are surfaced on the launching parent conversation.

## Demos

- [`demos/execution-environment-truth-probe/`](demos/execution-environment-truth-probe/) -- Generate a support-ready fact packet showing where tools actually run without confusing device selection and injected labels.
- [`demos/agent-sdk-parallel-workstreams/`](demos/agent-sdk-parallel-workstreams/) -- Run two independent conversations concurrently on one persistent Letta agent, then resume either exact workstream.
- [`demos/cron-channels-route-doctor/`](demos/cron-channels-route-doctor/) -- Read-only diagnostic that finds silent cron + channels misconfigurations causing MessageChannel loss in cron-fired sessions.
- [`demos/archival-memory-mod/`](demos/archival-memory-mod/) -- Install agent-scoped tools that search, browse, and optionally append to archival memory through the Letta API.
- [`demos/github-action-preflight/`](demos/github-action-preflight/) -- Check GitHub CLI readiness and the Letta Code Action workflow contract without changing the repository.

Each demo is intentionally small enough to inspect, run, and adapt. Start with
[`demos/README.md`](demos/README.md) for prerequisites and the catalog.
