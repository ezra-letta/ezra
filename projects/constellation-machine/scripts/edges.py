#!/usr/bin/env python3
"""
The Constellation Machine — edge management (sketch).

Commands:
    add       — Vesper adds an edge during reasoning (confidence: high, auto-accepted)
    propose   — Heuristic pass proposes new edges (confidence: low, status: proposed)
    review    — Interactive review of proposed edges
    accept    — Mark proposed edge as accepted
    reject    — Mark proposed edge as rejected
    list      — Show edges (filterable)

Not runnable as-is. Design scaffolding.
"""

import argparse
import json
import sys
import uuid
from datetime import datetime


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def edge_id() -> str:
    return f"edge-{uuid.uuid4().hex[:12]}"


# ─── Vesper-authored edges ────────────────────────────────────────

def add_edge(
    conn,
    from_node: str,
    to_node: str,
    edge_type: str,
    reason: str,
    proposed_by: str = "vesper",
) -> dict:
    """
    Vesper-authored edge. Committed immediately with confidence=high.
    """
    # Idempotency: if edge already exists, return existing
    # existing = conn.execute("""
    #     SELECT * FROM edges
    #     WHERE from_node = ? AND to_node = ? AND edge_type = ?
    # """, (from_node, to_node, edge_type)).fetchone()
    # if existing:
    #     return {"already_exists": True, "edge": dict(existing)}

    # new = {
    #     "id": edge_id(),
    #     "from_node": from_node,
    #     "to_node": to_node,
    #     "edge_type": edge_type,
    #     "confidence": "high",
    #     "status": "accepted",
    #     "proposed_by": proposed_by,
    #     "reason": reason,
    #     "created_at": now_iso(),
    #     "reviewed_at": now_iso(),
    # }
    # conn.execute("INSERT INTO edges VALUES (...)", new.values())
    # conn.commit()
    # return {"created": True, "edge": new}
    return {}


# ─── Heuristic proposal pass ─────────────────────────────────────

def propose_edges(conn, config: dict) -> dict:
    """
    Run enabled heuristics and propose new edges.

    Heuristics (order matters, first match wins):
        1. shared_tags — two nodes share >= N tags, no existing edge
        2. entity_mention — node summary references an entity from another node
        3. session_continuity — consecutive sessions in same arc

    NOT enabled by default: pure similarity. It produces too much noise.
    """
    max_proposals = config.get("edge_proposals", {}).get("max_per_run", 10)
    proposals = []

    # Heuristic 1: shared tags
    # triggers = config.get("edge_proposals", {}).get("triggers", {})
    # if "shared_tags" in triggers:
    #     min_shared = triggers["shared_tags"]["min_shared"]
    #     # For each pair of nodes with shared_tags >= min_shared and no existing
    #     # edge, propose a relates_to edge with confidence=low
    #     ...

    # Heuristic 2: entity mention
    # ...

    # Heuristic 3: session continuity
    # ...

    # Cap to max_proposals
    proposals = proposals[:max_proposals]

    # Insert as status=proposed, confidence=low
    # for p in proposals:
    #     conn.execute("INSERT INTO edges VALUES (...)", ...)
    # conn.commit()

    return {"proposed": len(proposals), "edges": proposals}


# ─── Interactive review ───────────────────────────────────────────

def review_edges(conn) -> dict:
    """
    Interactive review loop for proposed edges.

    For each proposed edge:
        - Print both node summaries + the proposal's reason/heuristic
        - Prompt: [a]ccept / [r]eject / [d]efer / [q]uit
        - Update edge status accordingly
    """
    # pending = conn.execute("""
    #     SELECT * FROM edges WHERE status = 'proposed' ORDER BY created_at
    # """).fetchall()
    #
    # if not pending:
    #     return {"reviewed": 0, "message": "No proposals to review."}
    #
    # stats = {"accepted": 0, "rejected": 0, "deferred": 0, "skipped": 0}
    # for edge in pending:
    #     from_node = load_node(conn, edge["from_node"])
    #     to_node = load_node(conn, edge["to_node"])
    #     print(f"\nEdge: {edge['edge_type']} ({edge['proposed_by']})")
    #     print(f"  FROM: {from_node['summary']}")
    #     print(f"  TO:   {to_node['summary']}")
    #     print(f"  REASON: {edge['reason']}")
    #     choice = input("  [a]ccept / [r]eject / [d]efer / [q]uit: ").strip().lower()
    #     if choice == "a":
    #         conn.execute("UPDATE edges SET status='accepted', confidence='medium', reviewed_at=? WHERE id=?", (now_iso(), edge["id"]))
    #         stats["accepted"] += 1
    #     elif choice == "r":
    #         conn.execute("UPDATE edges SET status='rejected', reviewed_at=? WHERE id=?", (now_iso(), edge["id"]))
    #         stats["rejected"] += 1
    #     elif choice == "d":
    #         stats["deferred"] += 1
    #     elif choice == "q":
    #         stats["skipped"] = len(pending) - sum(stats.values())
    #         break
    # conn.commit()
    # return stats
    return {}


# ─── Listing / status ─────────────────────────────────────────────

def list_edges(
    conn,
    status: str | None = None,
    edge_type: str | None = None,
    from_node: str | None = None,
) -> list[dict]:
    """List edges with optional filters."""
    # where = []
    # params = []
    # if status:
    #     where.append("status = ?"); params.append(status)
    # if edge_type:
    #     where.append("edge_type = ?"); params.append(edge_type)
    # if from_node:
    #     where.append("from_node = ?"); params.append(from_node)
    # q = "SELECT * FROM edges" + (f" WHERE {' AND '.join(where)}" if where else "")
    # return [dict(r) for r in conn.execute(q, params).fetchall()]
    return []


# ─── Auto-archive old proposals ───────────────────────────────────

def archive_stale_proposals(conn, days: int) -> int:
    """
    Proposals that sit un-reviewed > `days` get status='rejected' with a marker.
    Clean-up pressure so review debt doesn't accumulate forever.
    """
    # cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    # result = conn.execute("""
    #     UPDATE edges SET status = 'rejected', reviewed_at = ?
    #     WHERE status = 'proposed' AND created_at < ?
    # """, (now_iso(), cutoff))
    # conn.commit()
    # return result.rowcount
    return 0


# ─── CLI ─────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Constellation Machine edges")
    sub = p.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("--from-node", required=True)
    p_add.add_argument("--to-node", required=True)
    p_add.add_argument("--type", required=True,
                       choices=["relates_to", "reinforces", "follows", "about"])
    p_add.add_argument("--reason", required=True)

    sub.add_parser("propose")
    sub.add_parser("review")

    p_list = sub.add_parser("list")
    p_list.add_argument("--status", choices=["accepted", "proposed", "rejected", "deferred"])
    p_list.add_argument("--type")
    p_list.add_argument("--from-node")

    args = p.parse_args()

    # conn = connect(...)
    # config = load_config(...)

    if args.command == "add":
        out = add_edge(None, args.from_node, args.to_node, args.type, args.reason)
    elif args.command == "propose":
        out = propose_edges(None, {})
    elif args.command == "review":
        out = review_edges(None)
    elif args.command == "list":
        out = list_edges(None, args.status, args.type, args.from_node)
    else:
        return 1

    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
