-- The Constellation Machine — SQLite schema
-- Requires sqlite-vec extension loaded at connection time:
--   conn.enable_load_extension(True)
--   conn.load_extension("vec0")

-- ============================================================
-- Sources: memfs files, conversation excerpts, external refs
-- ============================================================
CREATE TABLE IF NOT EXISTS sources (
  id              TEXT PRIMARY KEY,                    -- e.g. "src-<uuid>"
  path            TEXT NOT NULL,                       -- memfs path or external URI
  source_type     TEXT NOT NULL CHECK (source_type IN (
    'memfs-file',
    'conversation-excerpt',
    'external'
  )),
  tier            TEXT NOT NULL CHECK (tier IN (
    'hot', 'cool', 'cold'
  )),
  content_hash    TEXT NOT NULL,                       -- SHA-256 of file content at index time
  last_indexed_at TEXT NOT NULL,                       -- ISO 8601
  last_seen_at    TEXT NOT NULL,                       -- ISO 8601, updated on hash check
  UNIQUE (path, source_type)
);

CREATE INDEX IF NOT EXISTS sources_tier_idx  ON sources(tier);
CREATE INDEX IF NOT EXISTS sources_type_idx  ON sources(source_type);

-- ============================================================
-- Sessions (RPG anchoring; nullable for non-RPG nodes)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                        -- e.g. "sess-<uuid>"
  campaign    TEXT NOT NULL,                           -- "main", "side-quest-1", etc.
  name        TEXT,                                    -- human-readable label
  started_at  TEXT NOT NULL,                           -- ISO 8601
  ended_at    TEXT,                                    -- null until session closes
  summary     TEXT                                     -- optional short summary
);

CREATE INDEX IF NOT EXISTS sessions_campaign_idx ON sessions(campaign);

-- ============================================================
-- Arcs (RPG narrative arcs, can span multiple sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS arcs (
  id          TEXT PRIMARY KEY,                        -- e.g. "arc-<uuid>"
  name        TEXT NOT NULL,                           -- "Trust and Betrayal", "Origin Quest"
  campaign    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN (
    'active', 'paused', 'resolved', 'abandoned'
  )),
  created_at  TEXT NOT NULL,
  resolved_at TEXT
);

-- ============================================================
-- Nodes: semantic units extracted from sources
-- ============================================================
CREATE TABLE IF NOT EXISTS nodes (
  id            TEXT PRIMARY KEY,                      -- e.g. "node-<uuid>"
  source_id     TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  session_id    TEXT REFERENCES sessions(id),          -- nullable
  arc_id        TEXT REFERENCES arcs(id),              -- nullable
  summary       TEXT NOT NULL,                         -- short description for retrieval
  excerpt       TEXT,                                  -- optional verbatim excerpt
  tags          TEXT,                                  -- comma-separated, e.g. "npc,trust-arc,act-3"
  tier          TEXT NOT NULL CHECK (tier IN (
    'hot', 'cool', 'cold'
  )),
  status        TEXT NOT NULL CHECK (status IN (
    'active', 'archived', 'superseded'
  )),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  created_by    TEXT NOT NULL CHECK (created_by IN (
    'vesper', 'heuristic', 'migration'
  ))
);

CREATE INDEX IF NOT EXISTS nodes_source_idx  ON nodes(source_id);
CREATE INDEX IF NOT EXISTS nodes_tier_idx    ON nodes(tier);
CREATE INDEX IF NOT EXISTS nodes_status_idx  ON nodes(status);
CREATE INDEX IF NOT EXISTS nodes_session_idx ON nodes(session_id);
CREATE INDEX IF NOT EXISTS nodes_arc_idx     ON nodes(arc_id);

-- ============================================================
-- Vector embeddings (sqlite-vec virtual table)
-- Dimension: 384 for all-MiniLM-L6-v2
-- ============================================================
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_vec USING vec0(
  node_rowid INTEGER PRIMARY KEY,                      -- matches nodes.rowid
  embedding FLOAT[384]
);

-- ============================================================
-- Edges: relationships between nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS edges (
  id            TEXT PRIMARY KEY,                      -- e.g. "edge-<uuid>"
  from_node     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node       TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  edge_type     TEXT NOT NULL CHECK (edge_type IN (
    'relates_to',
    'reinforces',
    'follows',
    'about'
  )),
  confidence    TEXT NOT NULL CHECK (confidence IN (
    'high', 'medium', 'low'
  )),
  status        TEXT NOT NULL CHECK (status IN (
    'accepted', 'proposed', 'rejected', 'deferred'
  )),
  proposed_by   TEXT NOT NULL,                         -- "vesper" | heuristic name
  reason        TEXT,                                  -- freeform: why this edge exists
  created_at    TEXT NOT NULL,
  reviewed_at   TEXT,
  CHECK (from_node != to_node)
);

CREATE UNIQUE INDEX IF NOT EXISTS edges_unique_idx
  ON edges(from_node, to_node, edge_type);

CREATE INDEX IF NOT EXISTS edges_from_idx      ON edges(from_node);
CREATE INDEX IF NOT EXISTS edges_to_idx        ON edges(to_node);
CREATE INDEX IF NOT EXISTS edges_status_idx    ON edges(status);
CREATE INDEX IF NOT EXISTS edges_type_idx      ON edges(edge_type);

-- ============================================================
-- Node tags (optional M:N alternative to comma-separated)
-- Kept denormalized as "tags" column on nodes for v1 simplicity.
-- Uncomment if v2 wants proper tag queries.
-- ============================================================
-- CREATE TABLE IF NOT EXISTS node_tags (
--   node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
--   tag     TEXT NOT NULL,
--   PRIMARY KEY (node_id, tag)
-- );
-- CREATE INDEX IF NOT EXISTS node_tags_tag_idx ON node_tags(tag);

-- ============================================================
-- Change log (for debugging / introspection)
-- ============================================================
CREATE TABLE IF NOT EXISTS change_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  op        TEXT NOT NULL,                             -- "reindex", "node-add", "edge-add", etc.
  entity_id TEXT,
  detail    TEXT,                                      -- JSON blob
  at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS change_log_at_idx ON change_log(at DESC);
