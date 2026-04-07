# MemFS Anti-Patterns

Common mistakes with memfs management and how to avoid them.

## 1. Dumping everything in system/

**Problem:** Agent puts all knowledge in system/ "just in case."
**Impact:** Token cost explodes. 30 files x 300 tokens = 9,000 tokens per turn wasted.
**Fix:** Apply tier assignment rule: "Do I need this EVERY turn?" If no, move to reference/.

## 2. Orphaned reference files

**Problem:** Agent creates reference/topic.md but never adds it to system/index.md.
**Impact:** File is effectively invisible. Agent forgets it exists within a few turns.
**Fix:** Every non-system file creation MUST be followed by an index update.

## 3. Mega-files

**Problem:** One system/ file with 15 different topics, 200+ lines.
**Impact:** Wastes tokens on irrelevant content every turn. Hard to update precisely.
**Fix:** Split. 1 concept = 1 file. Max ~40 lines for system/ files.

## 4. Relying on conversation memory

**Problem:** Agent learns something important but doesn't write it to memfs. "I'll remember."
**Impact:** Compaction erases it. Next session, knowledge is gone.
**Fix:** If it's important, write it down. Memfs is the only durable storage you control.

## 5. Using Write/Edit on memfs files

**Problem:** Agent uses Write tool instead of memory() tool for memfs files.
**Impact:** Frontmatter may be corrupted. No auto-commit/push. Changes may be lost.
**Fix:** Always use memory() tool for files in the memfs directory.

## 6. Never demoting stale content

**Problem:** Resolved issues, old state, completed tasks stay in system/ forever.
**Impact:** system/ bloats over time. Token cost creeps up without anyone noticing.
**Fix:** Weekly audit. If it's resolved/stale, demote to reference/ immediately.

## 7. Flat file structure

**Problem:** All files at top level: `system/users.md`, `system/rules.md`, `system/project.md`.
**Impact:** Hard to navigate. No logical grouping. Doesn't scale.
**Fix:** Use hierarchical paths: `system/project/overview.md`, `users/cameron.md`.

## 8. Vague descriptions

**Problem:** Frontmatter description says "Notes" or "Stuff."
**Impact:** Agent can't decide when to read the file from the tree listing.
**Fix:** Description must answer "When should I reach for this file?" Be specific.

## 9. Simultaneous multi-device writes

**Problem:** Two sessions (laptop + VPS) writing to the same agent's memfs.
**Impact:** Git conflicts. Push failures. Silent data loss.
**Fix:** One active writing session at a time. Kill stale sessions before switching devices.

## 10. Deleting without archiving

**Problem:** Agent deletes a file directly when it seems unneeded.
**Impact:** Knowledge permanently lost. May be needed later.
**Fix:** Move to reference/archive/ first. Delete only from archive after confirmation.
