# Migrating from Letta Filesystem to Memfs + Local Files

Letta Filesystem (the document upload + indexing service backed by folders and the `open_file` / `grep_file` / `search_file` tools) has been deprecated. This guide shows you what the supported replacements are and how to move existing data over.

> **Authoritative reference:** [docs.letta.com/guides/core-concepts/filesystem](https://docs.letta.com/guides/core-concepts/filesystem/) — the deprecation notice and the canonical replacement list.

## TL;DR

- Letta Filesystem (folders + file tools) is being removed.
- Replacement: **memfs (non-system tier) + skills + progressive disclosure**, optionally combined with local disk for content that shouldn't sync.
- For PDFs, install the [`extracting-pdf-text`](https://github.com/letta-ai/skills/tree/main/tools/extracting-pdf-text) skill.
- For semantic search, install the `memfs-search` skill (works over memfs) or use `qmd` directly (works over local disk).
- If you still have data trapped in Letta Filesystem, contact the Letta team and they can temporarily re-enable access so you can export.

## Mental-model shift

Letta Filesystem was a **separate document store**: you uploaded files into folders, Letta indexed them, and the agent queried via dedicated file tools. Documents lived inside Letta's managed indexing service.

The replacement is **filesystem access + skills**, applied to two storage locations:

- **Memfs (non-system tier):** the agent's own git-backed memory repository. Files outside `system/` only have their *path* visible in the system prompt — the body is loaded on demand. Cross-machine, cross-client, version-controlled.
- **Local disk:** ordinary files on the machine running Letta Code. Read directly with `Read` / `Glob` / `Grep` / `Bash`.

The agent is the same agent, with the same general-purpose tools it always has. The "interface" to documents stops being a special folder/file API and becomes ordinary filesystem operations the agent already knows how to do.

## The progressive-disclosure pattern

The reason memfs can absorb arbitrarily many documents without blowing up the system prompt is **progressive disclosure**:

```
memory/
├── system/                    <-- ALL files here are pinned to context (recursive)
│   ├── persona.md
│   ├── policies/
│   │   └── support-rules.md
│   └── document-store.md      <-- a small policy file pointing at the store
└── reference/                 <-- non-system: only paths render in the tree
    ├── papers/
    │   ├── attention-is-all-you-need.md     <-- body NOT in prompt
    │   ├── transformer-survey-2024.md       <-- body NOT in prompt
    │   └── retrieval-augmented-2025.md
    ├── transcripts/
    │   └── 2026-q1-customer-call-23.md
    └── docs/
        └── stripe-webhook-spec.md
```

Only the *tree structure* (paths, no contents) of non-system files is in context. The agent reads any of these on demand using `Read`, `Glob`, or a search skill. This is the same mechanism Letta Filesystem provided via auto-windowing, but using ordinary filesystem ops and without a separate indexing service.

## Old → New mapping

| Old (Letta Filesystem) | New |
|---|---|
| Upload to folder via ADE/API | Drop file in memfs subdirectory and `git commit` (memfs) **or** copy to a local path (disk) |
| `open_file` tool | `Read` |
| `grep_file` tool | `Grep` |
| `search_file` (semantic) tool | `memfs-search` skill (memfs) **or** `qmd` (local) |
| Folder = named collection | Memfs directory (e.g. `reference/papers/`) |
| Folder description | Frontmatter `description:` on a small index/policy file in `system/` that points at the directory |
| Auto-chunking + embedding | Read full file on demand (small enough usually); for huge files, agent uses `Grep` first to locate region, then `Read` with offset/limit |
| Cross-org folder sharing | Not needed — each agent owns its memfs; share via repo or copy |
| `embedding_config` matching agent + folder | Not needed |

## Pick your storage path

### Path A — Memfs only (recommended default)

Best for: documents you want the agent to keep across machines, clients, and devices. Examples: reference notes, distilled research, transcripts you want the agent to recall, knowledge bases that should travel with the agent.

Properties:
- Git-tracked (commit history, rollback)
- Synced via the memfs sync mechanism
- Visible in any client the agent connects from
- Subject to memfs sync overhead, so very large binaries are a poor fit

### Path B — Local disk only

Best for: very large files (multi-GB datasets), machine-specific data, anything you don't want syncing. Examples: a local research paper archive, generated artifacts, scratch outputs, local-only datasets.

Properties:
- No sync, no git overhead
- Only readable from the machine where Letta Code is running
- Tied to the host (not portable across devices)

### Path C — Hybrid

Source files on local disk, distilled summaries / extracted text in memfs.

Example: 500 PDFs sit on disk at `~/Documents/papers/`. The agent runs the `extracting-pdf-text` skill once, writes markdown summaries into `memory/reference/papers/`, and then operates against the memfs versions for day-to-day work. The disk archive is the cold copy; memfs is the warm working set.

## Migration steps

### 1. Inventory what you have

Get the list of folders and files currently in Letta Filesystem. Use the API or the ADE to enumerate. Note for each:
- Folder name and description
- File names and types (PDF, txt, md, json, etc.)
- Approximate size
- Which agents currently have the folder attached

### 2. Choose Path A / B / C per folder

Different folders may map to different paths. A small reference folder maps cleanly to memfs (Path A). A huge transcript archive may want Path C with the originals on disk.

### 3. Export your data

If your account still has Letta Filesystem access, download your files using the API (`/v1/folders/...` and `/v1/files/...`). If access is already disabled, [contact the Letta team](https://docs.letta.com/guides/core-concepts/filesystem/) — they can temporarily re-enable it so you can pull your data out.

### 4. Set up memfs directories

Pick a directory layout outside `system/`. Common choices:

```
memory/reference/papers/
memory/reference/transcripts/
memory/reference/docs/
memory/notes/
```

The agent itself can do this: ask it to "create a `reference/papers/` directory in my memfs and git-commit the change."

> **Anti-pattern:** Do **not** put document content into `system/`. Everything in `system/` is pinned to the prompt on every turn. Even one moderately sized PDF as markdown will inflate context dramatically. Put a small *policy file* in `system/` that points at the document directory; keep the actual content out.

Example `system/document-store.md`:

```markdown
---
description: Where this agent's reference documents live and how to access them.
---

# Document store

Reference documents are stored under `reference/` (memfs, non-system).

- `reference/papers/` — research papers, extracted to markdown
- `reference/transcripts/` — interview / call transcripts
- `reference/docs/` — product / API documentation

To search across these:
- Semantic / hybrid: invoke the `memfs-search` skill (`memfs-search query "..."`)
- Structural / regex: use `Grep` directly
- Specific file by path: use `Read`

Originals (PDFs etc.) live on local disk at `~/Documents/library/` and can be re-extracted with the `extracting-pdf-text` skill if needed.
```

### 5. Convert PDFs

Install the [`extracting-pdf-text`](https://github.com/letta-ai/skills/tree/main/tools/extracting-pdf-text) skill. Easiest install:

```bash
npx skills add https://github.com/letta-ai/skills --skill extracting-pdf-text
```

Or clone the whole skills repo into your project's `.skills/`:

```bash
git clone https://github.com/letta-ai/skills.git .skills
```

Or ask your agent to run the built-in `acquiring-skills` skill: tell it "investigate the skills available at https://github.com/letta-ai/skills and install `extracting-pdf-text`."

Then have the agent extract each PDF to markdown:

- Simple text PDFs: PyMuPDF (`scripts/extract_pymupdf.py input.pdf output.md`)
- PDFs with tables: pdfplumber
- Scanned / image PDFs: Mistral OCR API (best accuracy) or local Tesseract OCR

Markdown output is what you want — it preserves headings, tables, and lists in a form LLMs handle well.

Drop the resulting `.md` files into your chosen memfs subdirectory (e.g. `reference/papers/`).

### 6. Move text-based files

For files that are already text (`.txt`, `.md`, `.json`, `.csv`, source code, etc.), no extraction is needed — copy them straight into the memfs directory.

```bash
cp ~/Downloads/letta-export/notes/*.md ~/.letta/agents/<your-agent-id>/memory/reference/notes/
cd ~/.letta/agents/<your-agent-id>/memory && git add reference/notes && git commit -m "import notes from Letta Filesystem"
```

Or have the agent itself do this — it has `Bash` and `Write` tools.

### 7. Set up search

For memfs-based semantic search, install `memfs-search`:

```bash
npx skills add https://github.com/letta-ai/skills --skill memfs-search
```

It uses `qmd` under the hood and runs entirely locally — no API keys, no cloud calls. First-run downloads ~2GB of GGUF embedding models. Provides three search modes:

- `search` — keyword (fast)
- `vsearch` — semantic / vector (slower, finds conceptually similar content)
- `query` — hybrid (combines both)

For local-disk semantic search (Path B / C), use `qmd` directly. There's an `searching-with-qmd` skill that walks through setup and indexing.

### 8. Detach the old Letta Filesystem folders

Once your data is in its new home and search works, detach the old Letta Filesystem folders from your agent. This automatically removes the `open_file` / `grep_file` / `search_file` tools, since they only existed because folders were attached.

Verify the agent is fully operating off the new store before you detach — keep the migration reversible until you're confident.

### 9. Tell the agent

Update your agent's `system/document-store.md` (or whatever you named it) so the agent knows where the new documents live and which skills to use to access them. Then run `/recompile` to make sure the change is live in the system prompt.

You're done.

## Anti-patterns to avoid

- **Don't put documents in `system/`.** Pinned content burns tokens every turn. Use non-system memfs paths and let progressive disclosure do its job.
- **Don't use `archival_memory_insert` for document content.** Archival is for compact factual passages, not document corpora. Use memfs files.
- **Don't try to recreate the folder-attachment metaphor inside memfs.** There's no equivalent of "attach folder → tools appear." The agent already has filesystem tools; folders are just directories.
- **Don't pre-load file contents into the system prompt "for the agent's reference."** Defeats the whole point of progressive disclosure. Trust the agent to read what it needs when it needs it.
- **Don't recommend any new use of Letta Filesystem.** It's deprecated and being removed. Build directly on memfs + local disk + skills.

## When local disk is preferable

Memfs is the right default. Local disk is preferable when:

- Files are very large (many MB to GB) — git-backed sync isn't designed for this
- Files are binary in a way that doesn't benefit from version control (videos, audio, large images)
- Files are machine-specific (datasets tied to a particular device)
- Files are scratch / generated output that doesn't need to be preserved across sessions

You can mix freely: a single agent can read from both memfs and local disk in the same conversation. The agent doesn't care; they're both just paths it can `Read`.

## Search-pattern cheat sheet

| Goal | Tool |
|---|---|
| Read a specific known file | `Read` |
| Find files by name pattern | `Glob` |
| Find content matching a regex | `Grep` |
| Find conceptually similar content (memfs) | `memfs-search` skill |
| Find conceptually similar content (local disk) | `qmd` (or `searching-with-qmd` skill) |
| Extract text from a PDF | `extracting-pdf-text` skill |

## Frequently encountered questions

**Q: Will memfs slow down with thousands of documents?**
The system prompt scales with the *tree* (paths + frontmatter), not the bodies. Thousands of small files contribute mostly path strings. Watch for two real costs: (1) memfs git sync time as the repo grows, and (2) the tree rendering becoming unwieldy. For very large corpora, prefer Path C (originals on disk, summaries in memfs).

**Q: Can two agents share the same documents?**
Each agent has its own memfs repo, so direct sharing isn't built in. Practical options: keep originals on shared local disk and have each agent extract on its own; or maintain a separate git repo of shared docs and have each agent symlink / clone it into its memfs.

**Q: What about embeddings? Letta Filesystem matched embedding configs between agent and folder.**
Not needed in the new model. `memfs-search` and `qmd` both run their own local embedding models. The agent doesn't need a matching `embedding_config` because no shared embedding space is required.

**Q: Can I still use the old `open_file` / `grep_file` / `search_file` tools as a transition?**
Only while you still have Letta Filesystem folders attached. Once you detach them (or once the service is fully removed), those tools go away. Don't build around them — they're going.

**Q: I have hundreds of GB of documents. Memfs feels wrong for that.**
Correct — go Path B (local disk only) or Path C (originals on disk, working summaries in memfs). The agent can handle large local archives via `qmd` + `Glob` + `Grep` perfectly well; memfs's value is portability, which you don't need for a giant local-only corpus.

## Reference

- Deprecation notice: [docs.letta.com/guides/core-concepts/filesystem](https://docs.letta.com/guides/core-concepts/filesystem/)
- Memfs documentation: [docs.letta.com/letta-code/memory](https://docs.letta.com/letta-code/memory/)
- Context Repositories blog post: [letta.com/blog/context-repositories](https://letta.com/blog/context-repositories)
- Skills repo: [github.com/letta-ai/skills](https://github.com/letta-ai/skills)
- `extracting-pdf-text` skill: [github.com/letta-ai/skills/tree/main/tools/extracting-pdf-text](https://github.com/letta-ai/skills/tree/main/tools/extracting-pdf-text)

---

If you hit edge cases or want to add to this guide, open a PR.
