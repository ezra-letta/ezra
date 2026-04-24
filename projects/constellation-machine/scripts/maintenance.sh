#!/usr/bin/env bash
# The Constellation Machine — daily maintenance runner
#
# Run via cron during quiet hours, e.g. 2:30am:
#   letta cron add --name constellation-maintenance \
#     --description "Reindex changed files, propose edges, archive stale proposals" \
#     --prompt "Run bash ~/.letta/skills/constellation/scripts/maintenance.sh and summarize the results in your journal." \
#     --cron "30 2 * * *" \
#     --agent $LETTA_AGENT_ID
#
# Exit codes:
#   0 — success
#   1 — reindex failed
#   2 — edge propose failed

set -e

SKILL_DIR="${SKILL_DIR:-$HOME/.letta/skills/constellation}"
PYTHON="${PYTHON:-python3}"

echo "=== Constellation Machine maintenance: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# 1. Reindex changed files (hash-check + re-embed)
echo ""
echo "--- Reindex changed ---"
$PYTHON "$SKILL_DIR/scripts/index.py" reindex-changed || exit 1

# 2. Extract nodes from recently-changed files (since last maintenance)
echo ""
echo "--- Extract new nodes ---"
$PYTHON "$SKILL_DIR/scripts/index.py" extract-nodes --since-days 1 || exit 1

# 3. Run heuristic edge proposals
echo ""
echo "--- Propose edges ---"
$PYTHON "$SKILL_DIR/scripts/edges.py" propose || exit 2

# 4. Archive stale un-reviewed proposals (> 30 days old)
echo ""
echo "--- Archive stale proposals ---"
$PYTHON "$SKILL_DIR/scripts/edges.py" archive-stale --days 30 || true

echo ""
echo "=== Maintenance complete ==="

# NOTE: Review of proposed edges is NOT done here.
# That's an interactive activity — Vesper runs `edges.py review`
# during reflection when she has attention to give it.
