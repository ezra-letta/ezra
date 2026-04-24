#!/usr/bin/env python3
"""
The Constellation Machine — indexing script (sketch).

Commands:
    reindex-changed   — hash-check all tracked sources, re-embed changed ones
    reindex-all       — full reindex (destructive; use sparingly)
    extract-nodes     — ask Vesper to extract semantic units from recent files
    show-stale        — list sources whose content hash has drifted

Not runnable as-is. Design scaffolding.
"""

import argparse
import hashlib
import json
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def memfs_root(agent_id: str) -> Path:
    return Path.home() / f".letta/agents/{agent_id}/memory"


def reindex_changed(conn, config: dict) -> dict:
    """
    Walk all sources in the DB. For each, compute current file hash.
    If changed, re-embed and update the content_hash.

    Returns a summary: {checked, changed, deleted, errors}.
    """
    # changed = []
    # deleted = []
    # for src in conn.execute("SELECT * FROM sources WHERE source_type = 'memfs-file'"):
    #     path = Path(src["path"])
    #     if not path.exists():
    #         deleted.append(src["id"])
    #         continue
    #     current_hash = sha256_of(path)
    #     if current_hash != src["content_hash"]:
    #         changed.append(src["id"])
    #         # Re-embed all nodes from this source
    #         for node in conn.execute(
    #             "SELECT * FROM nodes WHERE source_id = ?", (src["id"],)
    #         ):
    #             new_embedding = embed_node(node, path)
    #             update_node_vector(conn, node["id"], new_embedding)
    #         conn.execute(
    #             "UPDATE sources SET content_hash = ?, last_indexed_at = ? WHERE id = ?",
    #             (current_hash, now_iso(), src["id"])
    #         )
    # conn.commit()
    # return {"checked": ..., "changed": len(changed), "deleted": len(deleted)}
    return {}


def extract_nodes_from_file(path: Path, policy: str) -> list[dict]:
    """
    Produce node candidates from a file, per extraction policy:

    - "file":    one node per file
    - "heading": split by ## headings
    - "vesper":  punt to Vesper (prints prompt, reads stdin)
    - "hybrid":  heading-based, with Vesper able to merge/override

    Returns a list of {summary, excerpt, tags} dicts.
    """
    content = path.read_text()

    if policy == "file":
        return [{
            "summary": path.name,
            "excerpt": content[:500],
            "tags": "",
        }]

    if policy == "heading":
        # Split on lines matching /^## /
        # Node = one heading block
        # ...
        return []

    if policy == "vesper":
        # Print the file content and a prompt to stdout, wait for Vesper to
        # respond with JSON describing nodes.
        # This is the interactive case — used during maintenance heartbeats.
        print(json.dumps({
            "request": "extract_nodes",
            "file_path": str(path),
            "content": content,
            "instructions": (
                "Identify 1-5 distinct semantic units in this file worth "
                "indexing as separately retrievable nodes. Respond with "
                "JSON: [{summary, excerpt, tags}]"
            ),
        }))
        # In real usage, the calling agent writes response to a tmp file
        # or pipes it in.
        return []

    if policy == "hybrid":
        # Start with heading-based, let Vesper review/merge in a later pass
        return extract_nodes_from_file(path, "heading")

    raise ValueError(f"Unknown extraction policy: {policy}")


def extract_nodes(conn, config: dict, since_days: int) -> dict:
    """
    Walk memfs files changed in the last N days. Extract nodes per config
    policy. Add new nodes to the DB; don't auto-remove old ones.
    """
    # cutoff = datetime.now() - timedelta(days=since_days)
    # ...
    return {}


def show_stale(conn) -> list[dict]:
    """List sources whose current file hash differs from stored hash."""
    # stale = []
    # for src in conn.execute("SELECT * FROM sources WHERE source_type = 'memfs-file'"):
    #     path = Path(src["path"])
    #     if path.exists() and sha256_of(path) != src["content_hash"]:
    #         stale.append({"source_id": src["id"], "path": src["path"]})
    # return stale
    return []


# ─── CLI ─────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Constellation Machine indexer")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("reindex-changed")
    sub.add_parser("reindex-all")
    p_ext = sub.add_parser("extract-nodes")
    p_ext.add_argument("--since-days", type=int, default=1)
    sub.add_parser("show-stale")

    args = p.parse_args()

    # config = load_config(...)
    # conn = connect(...)

    if args.command == "reindex-changed":
        out = reindex_changed(None, {})
    elif args.command == "extract-nodes":
        out = extract_nodes(None, {}, args.since_days)
    elif args.command == "show-stale":
        out = show_stale(None)
    elif args.command == "reindex-all":
        print("DESTRUCTIVE. Rebuilds from scratch. Confirm [y/N]: ", end="")
        if input().strip().lower() != "y":
            return 1
        # out = reindex_all(conn, config)
        out = {}
    else:
        return 1

    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
