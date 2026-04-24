#!/usr/bin/env python3
"""
The Constellation Machine — query script (sketch).

Retrieval modes:
    semantic    — embedding similarity
    thread      — traverse edge chain from starting node
    adjacency   — direct neighbors of a node
    hybrid      — semantic search + neighborhood expansion

Not runnable as-is. This is scaffolding that encodes the design.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

# Placeholder imports — actual implementation would use these
# import sqlite_vec
# from sentence_transformers import SentenceTransformer
# import yaml


def load_config(path: Path) -> dict:
    """Load YAML config. Stub — real implementation would yaml.safe_load."""
    # with open(path) as f: return yaml.safe_load(f)
    return {}


def connect(db_path: Path) -> sqlite3.Connection:
    """Open SQLite connection with sqlite-vec loaded."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # conn.enable_load_extension(True)
    # sqlite_vec.load(conn)
    return conn


def embed_text(text: str, daemon_socket: Path | None) -> list[float]:
    """
    Embed text. If daemon is configured, talk to it via socket; otherwise
    load model inline (slow, ~2-3s cold start on Pi 5).
    """
    # if daemon_socket and daemon_socket.exists():
    #     return talk_to_daemon(daemon_socket, text)
    # model = SentenceTransformer("all-MiniLM-L6-v2")
    # return model.encode(text).tolist()
    raise NotImplementedError("embed stub")


def query_semantic(conn, query_text: str, limit: int = 5) -> list[dict]:
    """
    Semantic similarity search via sqlite-vec.
    Returns nodes ranked by distance, with provenance.
    """
    # q_embed = embed_text(query_text, daemon_socket)
    # rows = conn.execute("""
    #     SELECT n.id, n.summary, n.tags, n.tier, n.source_id,
    #            s.path AS source_path,
    #            s.content_hash AS indexed_hash,
    #            v.distance
    #     FROM nodes_vec v
    #     JOIN nodes n ON n.rowid = v.node_rowid
    #     JOIN sources s ON s.id = n.source_id
    #     WHERE v.embedding MATCH ? AND k = ?
    #         AND n.status = 'active'
    #     ORDER BY v.distance
    # """, (serialize_vec(q_embed), limit)).fetchall()
    #
    # results = []
    # for row in rows:
    #     current_hash = sha256_of(row["source_path"])
    #     results.append({
    #         "node_id": row["id"],
    #         "summary": row["summary"],
    #         "source_path": row["source_path"],
    #         "tier": row["tier"],
    #         "distance": row["distance"],
    #         "stale": current_hash != row["indexed_hash"],
    #     })
    # return results
    return []


def query_thread(
    conn, start_node: str, edge_types: list[str], max_depth: int
) -> list[dict]:
    """
    Traverse edges from start_node in order, following allowed edge types.
    Returns the chain in order.

    Design note: breadth-first or depth-first? For narrative threads,
    depth-first along the 'follows' edge type feels right — returns the
    temporal chain, not the neighborhood.
    """
    # visited = set()
    # chain = []
    # stack = [(start_node, 0)]
    # while stack:
    #     node_id, depth = stack.pop()
    #     if node_id in visited or depth > max_depth:
    #         continue
    #     visited.add(node_id)
    #     chain.append(load_node(conn, node_id))
    #     next_edges = conn.execute("""
    #         SELECT to_node FROM edges
    #         WHERE from_node = ?
    #             AND edge_type IN (?)
    #             AND status = 'accepted'
    #         ORDER BY created_at
    #     """, (node_id, ",".join(edge_types))).fetchall()
    #     for e in next_edges:
    #         stack.append((e["to_node"], depth + 1))
    # return chain
    return []


def query_adjacency(conn, node_id: str) -> dict:
    """
    Return direct neighbors of node_id, grouped by edge type.
    """
    # rows = conn.execute("""
    #     SELECT e.edge_type, e.confidence, e.reason,
    #            n.id AS neighbor_id, n.summary
    #     FROM edges e
    #     JOIN nodes n ON n.id = e.to_node
    #     WHERE e.from_node = ? AND e.status = 'accepted'
    # """, (node_id,)).fetchall()
    #
    # by_type = {}
    # for row in rows:
    #     by_type.setdefault(row["edge_type"], []).append({
    #         "neighbor_id": row["neighbor_id"],
    #         "summary": row["summary"],
    #         "confidence": row["confidence"],
    #         "reason": row["reason"],
    #     })
    # return by_type
    return {}


def query_hybrid(
    conn, query_text: str, expand_hops: int, limit: int
) -> list[dict]:
    """
    Semantic search + neighborhood expansion.
    Useful when you want semantic grounding + structural context.
    """
    seeds = query_semantic(conn, query_text, limit=limit)
    # expanded = []
    # for seed in seeds:
    #     expanded.append(seed)
    #     neighbors = query_adjacency(conn, seed["node_id"])
    #     seed["neighbors"] = neighbors
    # return expanded
    return seeds


# ─── CLI ─────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Constellation Machine query")
    sub = p.add_subparsers(dest="mode", required=True)

    p_sem = sub.add_parser("semantic")
    p_sem.add_argument("--text", required=True)
    p_sem.add_argument("--limit", type=int, default=5)

    p_thr = sub.add_parser("thread")
    p_thr.add_argument("--from-node", required=True)
    p_thr.add_argument("--edge-types", default="follows,reinforces")
    p_thr.add_argument("--max-depth", type=int, default=10)

    p_adj = sub.add_parser("adjacency")
    p_adj.add_argument("--node", required=True)

    p_hyb = sub.add_parser("hybrid")
    p_hyb.add_argument("--text", required=True)
    p_hyb.add_argument("--expand-hops", type=int, default=1)
    p_hyb.add_argument("--limit", type=int, default=5)

    args = p.parse_args()

    config = load_config(
        Path.home() / ".letta/skills/constellation/config.yaml"
    )
    db_path = Path(config.get("db_path", "memory.sqlite")).expanduser()
    conn = connect(db_path)

    if args.mode == "semantic":
        out = query_semantic(conn, args.text, args.limit)
    elif args.mode == "thread":
        out = query_thread(
            conn, args.from_node, args.edge_types.split(","), args.max_depth
        )
    elif args.mode == "adjacency":
        out = query_adjacency(conn, args.node)
    elif args.mode == "hybrid":
        out = query_hybrid(conn, args.text, args.expand_hops, args.limit)
    else:
        print(f"Unknown mode: {args.mode}", file=sys.stderr)
        return 1

    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
