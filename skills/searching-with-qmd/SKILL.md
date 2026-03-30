---
name: searching-with-qmd
description: Semantic search over local files using qmd (Query Markup Documents). Use when you need to find information across a large collection of local files (notes, docs, knowledge bases, meeting transcripts) without knowing exact keywords or file locations. Covers setup, indexing, and all search modes (keyword, semantic, hybrid). Requires qmd to be installed (`npm install -g @tobilu/qmd`).
---

# Searching with QMD

[QMD](https://github.com/tobi/qmd) is a local search engine that combines BM25 keyword search, vector semantic search, and LLM re-ranking. All processing runs on-device via GGUF models.

## Prerequisites

Check if qmd is installed:

```bash
qmd --version
```

If not installed: `npm install -g @tobilu/qmd` (requires Node.js >= 22).

First run downloads ~2GB of GGUF models to `~/.cache/qmd/models/` (embedding, reranker, query expansion).

## Setup: Index a Directory

```bash
# Add a collection (recursively indexes markdown and text files)
qmd collection add /path/to/docs --name my-docs

# Add context to help search understand the content
qmd context add qmd://my-docs "Technical documentation for the Foo project"

# Generate vector embeddings (required for semantic/hybrid search)
qmd embed
```

Multiple collections can coexist. Use `qmd collection list` to see all indexed collections.

## Search Modes

Use the lightest mode that fits the query:

| Mode | Command | Speed | When to use |
|------|---------|-------|-------------|
| Keyword | `qmd search "exact phrase"` | Fast | Known terms, exact matches, filenames |
| Semantic | `qmd vsearch "conceptual question"` | Medium | Fuzzy/conceptual queries, no exact keywords |
| Hybrid | `qmd query "complex question"` | Slow | Best quality, combines all methods + re-ranking |

### Common Options

```bash
# Limit results
qmd search "auth" -n 10

# Filter to one collection
qmd query "deployment" -c my-docs

# Set minimum relevance threshold
qmd query "API design" --min-score 0.3

# Get structured output for processing
qmd search "auth" --json
qmd query "error handling" --files    # docid,score,filepath,context

# Show full document content in results
qmd search "config" --full

# Retrieve a specific document by path or docid
qmd get "docs/readme.md"
qmd get "#abc123"

# Retrieve multiple documents by glob
qmd multi-get "docs/**/*.md" --json
```

## Typical Workflow

1. User asks a question that requires searching local files
2. Check if relevant collections exist: `qmd collection list`
3. If not indexed yet, add the collection and embed
4. Search with the appropriate mode
5. Read full documents for top results: `qmd get "path/to/file.md"`

## Maintenance

```bash
# Re-scan collections for new/changed files
qmd update

# Re-generate all embeddings (after adding new files)
qmd embed

# Force re-embed everything (after changing embedding model)
qmd embed -f

# Show index health
qmd status
```

## Troubleshooting

**"sqlite-vec is not available"**: qmd is running via Bun instead of Node. Bun's built-in SQLite doesn't support extension loading. Fix: install via `npm install -g @tobilu/qmd` and ensure `BUN_INSTALL` env var is unset when running qmd (the shell wrapper auto-detects Bun if `BUN_INSTALL` is set). Workaround: `unset BUN_INSTALL && qmd embed`.

**macOS Homebrew SQLite**: Run `brew install sqlite` for extension support. Not needed if npm-installed qmd runs via Node (better-sqlite3 handles it).

## Notes

- Default file pattern is `**/*.md`. Use `--mask "**/*.{md,txt,py}"` when adding a collection to index other file types.
- Embeddings are chunked at ~900 tokens with smart boundary detection (respects headings, code blocks, paragraphs).
- `qmd query` downloads/loads 3 GGUF models on first use -- expect a delay. Subsequent calls are faster if models stay cached.
- For code files, use `--chunk-strategy auto` with `qmd embed` for AST-aware chunking (supports TS, JS, Python, Go, Rust).
