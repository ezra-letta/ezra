# Production gotchas for Letta Code memory

Use this as a diagnostic checklist, not as a permanent source of current issue status. Re-verify live docs/source for version-sensitive claims.

## `system/` is recursively pinned

Every markdown file under `system/`, including subdirectories, is pinned into context. Moving a file from `system/foo.md` to `system/archive/foo.md` does not unpin it. To make content on-demand, move it outside `system/`.

## Dynamic data should not be pinned

Live state, queues, weather, infra snapshots, file listings, and logs should live outside `system/`. Tell the agent where to read them when relevant. This preserves prompt stability and improves cache behavior.

## Non-system descriptions are not enough for discoverability

Non-`system/` files may be present in the tree, but do not rely on their frontmatter descriptions being rendered as usable summaries. Important on-demand files should be linked from pinned index files using `[[path]]` links.

## Git sync matters

Local edits are not durable across devices until committed and pushed. Before major edits:

```bash
git -C "$MEMORY_DIR" status --short
git -C "$MEMORY_DIR" pull --ff-only || true
```

After meaningful edits:

```bash
git -C "$MEMORY_DIR" add <specific-files>
git -C "$MEMORY_DIR" commit -m "Update memory layout"
git -C "$MEMORY_DIR" push origin main
```

Use specific paths when possible to avoid committing unrelated files.

## Multiple clients can confuse memory state

If the same agent is open in multiple runtimes/devices, git state can diverge or pushes can race. Prefer one active editor for memory surgery. If behavior looks stale, check git status, recent commits, and whether the conversation/system prompt needs recompile or compaction.

## Block/file size limits are not a complete safety net

Do not rely on configured block limits to prevent memory bloat. Audit `system/` size manually and keep pinned files focused.

## Model and context behavior is version-sensitive

Context window handling, compaction behavior, and app/CLI behavior change over time. Store durable diagnostic principles in memory, not stale ticket status. Verify exact API fields and current docs before giving user-facing instructions.
