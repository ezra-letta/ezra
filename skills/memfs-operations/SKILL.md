---
name: memfs-operations
description: Operational guide for managing memfs (memory filesystem) in Letta Code agents. Load when you need to understand how to organize, maintain, and use your git-backed memory. Covers tier assignment, indexing, lifecycle, sync mechanics, and production patterns. Zero philosophy -- pure mechanics.
---

# MemFS Operations Guide

You have a git-backed memory filesystem (memfs). This document tells you exactly how to use it.

## I. Architecture

Your memory is a directory of markdown files at `~/.letta/agents/<agent-id>/memory/`.

**Two tiers:**
- `system/` -- pinned to your system prompt every turn. You always see this content. It costs tokens every turn.
- Non-system (`reference/`, `history/`, custom dirs) -- visible in file tree (path + description only). Full content requires a Read tool call.

**Every file has YAML frontmatter:**
```yaml
---
description: "One sentence: when should I reach for this file?"
limit: 5000
---
```

**What you always see (without reading):**
- Full content of every `system/` file
- File tree: paths + descriptions of ALL files (system and non-system)

**What you must explicitly read:**
- Content of non-system files (use Read tool or memory tool)

## II. Description Field

The `description` field is the single most important attribute on non-system files. It is the ONLY information you see about a file without reading it.

**Rules:**
- Description must answer: "When should I reach for this file?"
- Bad: `"Environment variables"` (too vague)
- Good: `"Verified environment variables and their actual behavior in Letta server config"` (tells you what's inside AND when it's useful)
- Update description when file scope changes
- Treat description as a search index entry for yourself

## III. Tier Assignment

**Decision rule:** Does the agent need this content EVERY turn?

**system/ (always in context):**
- Identity and persona
- Active rules and constraints
- Current state (what you're working on now)
- Index files (pointers to non-system content)
- Frequently referenced knowledge

**reference/ (on-demand):**
- Knowledge base entries
- API documentation, SDK signatures
- Historical data, resolved issues
- Large content that doesn't fit in system/
- Per-user or per-entity detail files

**history/ (audit trail):**
- Session logs
- Decision records
- Changelogs

**Size discipline:**
- system/ files: aim for ~40 lines max. Split if larger.
- Non-system files: no hard limit, but keep focused (1 topic = 1 file)
- Total system/ files: 15-20 is practical. 25+ means review what's pinned.

## IV. Context Budget Awareness

Every token in `system/` costs you on every turn. Estimate impact:
- ~4 characters per token (rough average for English)
- A 40-line system/ file ~ 200-400 tokens per turn
- 15 system/ files at ~300 tokens each = ~4,500 tokens per turn just for memory
- On a 128k context window this is small; on 32k it's significant

**Rule:** Before adding to system/, ask: "Is the token cost worth having this every turn, or can I Read it when needed?"

## V. Indexing Protocol

**Mandatory:** Maintain `system/index.md` with pointers to ALL non-system files.

**Format:**
```markdown
## Reference Files
- `reference/api-endpoints.md` -- REST API endpoint signatures and params
- `reference/pricing.md` -- Plan tiers, quotas, BYOK details
- `reference/env-vars.md` -- Verified environment variables for server config

## History
- `history/decisions.md` -- Key architectural decisions with rationale

## Users
- `users/cameron.md` -- Preferences, role, communication style
```

**Update triggers:**
- When you create a non-system file: add to index
- When you delete a non-system file: remove from index
- When a file's scope changes: update its index description

## VI. File Lifecycle

**Creation:**
```
memory(command="create", path="reference/new-topic.md",
       description="What this file is for", file_text="Initial content")
```
Then immediately add to `system/index.md`.

**Editing:**
- Always Read the file first (prevents overwrite conflicts)
- Use `str_replace` for precise changes
- Use `insert` for appending

**Promotion (reference/ -> system/):**
- When content becomes critical for every turn
- `memory(command="rename", old_path="reference/rules.md", new_path="system/rules.md")`
- Remove from index (now it's auto-visible)

**Demotion (system/ -> reference/):**
- When content goes stale or is no longer needed every turn
- `memory(command="rename", old_path="system/old-state.md", new_path="reference/old-state.md")`
- Add to index

**Archival:**
- Before deleting: move to `reference/archive/`
- `memory(command="rename", old_path="reference/topic.md", new_path="reference/archive/topic.md")`
- Never delete directly from system/

**Deletion:**
- Only from archive, only when certain it's not needed
- `memory(command="delete", path="reference/archive/obsolete.md")`
- Remove from index

## VII. Naming & Structure

- Hierarchical paths: `system/project/overview.md` not `system/project-overview.md`
- 1 concept = 1 file
- Split at ~40 lines for system/ files
- Descriptive names readable without context
- Group related files in directories: `users/`, `reference/`, `troubleshooting/`
- No spaces in filenames -- use hyphens
- Use `/` nesting for subcategories: `reference/api/endpoints.md`

## VIII. Tool Selection

| Operation | Tool | Auto-sync? |
|-----------|------|------------|
| Create/edit memfs file | `memory()` | Yes (auto-commit + push) |
| Read memfs file | `Read` or `memory()` | N/A |
| Edit project file (not memfs) | `Write` / `Edit` | No (manual git) |

**Rules:**
- For memfs files: ALWAYS use `memory()` tool. It handles frontmatter, commits, and pushes.
- For non-memfs files: use `Write`/`Edit` as normal.
- Never use `Write` on memfs files (bypasses frontmatter validation and auto-sync).
- Always `Read` before `str_replace` (prevents overwriting concurrent changes).

## IX. Git Sync Mechanics

**Automatic (via memory tool):**
- Every `memory()` call commits and pushes to Letta Cloud git server
- Changes visible to server on next system prompt recompilation

**Manual (if you used Write/Edit on memfs files):**
```bash
cd ~/.letta/agents/<agent-id>/memory/
git add -A && git commit -m "update" && git push
```

**Session start:** memfs repo auto-pulls latest from server.

**Multi-device warning:** Two active sessions writing to the same memfs repo can cause git conflicts. Avoid simultaneous writes. One active session at a time is safe. Kill stale sessions before starting new ones on different devices.

**Conflict resolution:** Requires interactive Letta Code session. Headless mode exits with error on conflicts.

## X. Compaction Survival

**Survives compaction:**
- system/ files (part of system prompt -- always present)
- Archival memory / passages (server-side, searchable)

**Does NOT survive compaction:**
- Conversation history (compressed or evicted)
- Reasoning from previous turns

**Rule:** If information is operationally critical, it MUST be in memfs or archival. Never rely on "I'll remember from the conversation." You won't -- compaction will erase it.

## XI. Hygiene & Maintenance

**Periodic audit (weekly or on /doctor):**
1. Review every system/ file: is this still needed every turn?
2. Move stale content to reference/
3. Check system/index.md: are all pointers valid? Any missing files?
4. Review file sizes: any system/ file over 60 lines? Split it.
5. Check total system/ count: over 20? Demote lowest-value files.

**Corrections log:**
- Maintain `reference/corrections.md` for mistakes you've made
- Read periodically to avoid repeating errors
- Don't put in system/ (grows too large over time)

**Per-entity pattern:**
- 1 user = 1 file in `users/`
- 1 project = 1 directory in `reference/projects/`
- Read on demand, not pinned

## XII. Limit Field Reality

The `limit` field in frontmatter sets a character cap on file content.

**Current state (as of Mar 2026):**
- Agents can self-edit the limit in frontmatter (it's just a YAML field)
- Git-enabled write path does NOT enforce limits server-side (known bug, GitHub #3241)
- `limit` is useful as a SIGNAL to yourself: "this file should stay under N chars"
- Do not rely on it as a hard enforcement mechanism

## XIII. Multi-Agent Considerations

**Shared blocks:**
- Multiple agents can attach to the same memory block
- Changes visible to other agents on next context compilation
- Good for: shared policies, cross-agent state

**Memfs repos are per-agent:**
- Each agent has its own isolated git repo
- No native cross-agent memfs sharing
- Workaround: symlinks (local only, won't survive git sync)

**Agent-to-agent knowledge transfer:**
- Export: Read files from source agent's memfs path
- Import: Write to target agent's memfs + git push
- Or use shared blocks for real-time synchronization

## XIV. Production Patterns

**Knowledge bot via pure API (no Letta Code running):**
- Put all critical knowledge in `system/`
- Put searchable knowledge in archival memory (passages)
- Agent accessible via `POST /v1/agents/{id}/messages`
- No client-side tools needed

**Knowledge bot via CLI headless:**
- Full memfs access including reference/ files (Read tool available)
- `letta --agent <id> -p "question" --yolo --output-format json`
- ~5-10s startup overhead per call

**Always-on via remote environment:**
- `letta server` on VPS, connect from chat.letta.com
- Full tool access, full memfs
- Best of both worlds: API accessibility + client-side tools

## XV. Recovery

**Git conflicts:**
- Start interactive session: `letta --agent <id>`
- Resolve conflicts manually in `~/.letta/agents/<id>/memory/`
- `git add . && git commit && git push`

**Stale system prompt (agent doesn't see recent changes):**
- Trigger recompile: `POST /v1/agents/{id}/recompile`
- Or start new conversation (gets fresh compilation)

**Missing files after device switch:**
- Check: `git -C ~/.letta/agents/<id>/memory/ status`
- Pull: `git -C ~/.letta/agents/<id>/memory/ pull`
- Force push if local is authoritative: `git push --force` (use with caution)

**Memfs not initialized:**
- Enable: `/memfs enable` in Letta Code
- Or manual clone: `git clone https://api.letta.com/v1/git/<agent-id>/state.git ~/.letta/agents/<agent-id>/memory/`
- Credentials: username=`letta`, password=your API key
