# Pointer map for Letta memory work

Use this as a starting map. Verify live docs for version-sensitive details.

## Official docs and references

| Need | Source |
|---|---|
| Letta Code overview | https://docs.letta.com/letta-code |
| Letta Code memory / context repositories | https://docs.letta.com/letta-code/memory |
| Letta Code skills | https://docs.letta.com/letta-code/skills |
| Letta Code subagents | https://docs.letta.com/letta-code/subagents |
| Letta Code remote environments | https://docs.letta.com/letta-code/remote |
| Full docs for LLMs | https://docs.letta.com/llms.txt |
| Context Constitution | https://www.letta.com/blog/context-constitution |
| Context repositories blog | https://www.letta.com/blog/context-repositories |

## Useful built-in skills / mechanisms

| Need | Mechanism |
|---|---|
| Initialize memory | `/init` or `initializing-memory` |
| Audit/defrag memory | `/doctor` or `memory` subagent |
| Git sync / conflicts | `syncing-memory-filesystem` |
| Create new skills | `creating-skills` |
| Acquire external skills | `acquiring-skills` |
| Semantic search over local files | `memfs-search` / QMD skill, if installed |
| Recall conversation history | `recall` subagent |

## Verification habit

For anything version-sensitive, check current docs or source before writing it into durable memory. Good candidates for re-verification:

- model handles and tiers,
- CLI flags,
- app behavior,
- issue status,
- API request/response bodies,
- self-hosted memfs setup.
