CREATE TABLE IF NOT EXISTS youtube_comment_sources (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  video_title TEXT NOT NULL,
  comment_id TEXT NOT NULL UNIQUE,
  parent_comment_id TEXT,
  is_top_level INTEGER NOT NULL DEFAULT 0 CHECK (is_top_level IN (0, 1)),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  like_count INTEGER NOT NULL DEFAULT 0,
  author_display_name TEXT NOT NULL DEFAULT '',
  comment_text TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  source_updated_at TEXT,
  fetched_at TEXT NOT NULL,
  raw_text_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_record_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stall_comment_drafts (
  id TEXT PRIMARY KEY,
  normalized_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'SG',
  confidence_score REAL NOT NULL DEFAULT 0,
  support_count INTEGER NOT NULL DEFAULT 0,
  top_like_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'approved', 'rejected')),
  moderation_flags_json TEXT NOT NULL DEFAULT '[]',
  maps_urls_json TEXT NOT NULL DEFAULT '[]',
  evidence_comment_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_video_ids_json TEXT NOT NULL DEFAULT '[]',
  extraction_method TEXT NOT NULL DEFAULT 'rules' CHECK (extraction_method IN ('rules', 'llm', 'mixed')),
  extraction_notes TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TEXT,
  rejected_reason TEXT,
  approved_stall_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comment_source_stalls (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'SG',
  source_draft_id TEXT NOT NULL UNIQUE,
  confidence_score REAL NOT NULL DEFAULT 0,
  support_count INTEGER NOT NULL DEFAULT 0,
  top_like_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_draft_id) REFERENCES stall_comment_drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comment_sync_runs (
  id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'guarded')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  error_text TEXT
);

CREATE TABLE IF NOT EXISTS comment_sync_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stall_comment_evidence (
  id TEXT PRIMARY KEY,
  normalized_name TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL DEFAULT '',
  author_display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL,
  UNIQUE(normalized_name, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_youtube_comment_sources_video_id ON youtube_comment_sources(video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_comment_sources_fetched_at ON youtube_comment_sources(fetched_at);
CREATE INDEX IF NOT EXISTS idx_youtube_comment_sources_raw_expiry ON youtube_comment_sources(raw_text_expires_at);
CREATE INDEX IF NOT EXISTS idx_stall_comment_drafts_status ON stall_comment_drafts(status);
CREATE INDEX IF NOT EXISTS idx_stall_comment_drafts_confidence ON stall_comment_drafts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_comment_source_stalls_status ON comment_source_stalls(status);
CREATE INDEX IF NOT EXISTS idx_stall_comment_evidence_name ON stall_comment_evidence(normalized_name);
