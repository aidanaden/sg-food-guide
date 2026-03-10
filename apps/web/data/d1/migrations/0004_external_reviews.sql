-- External Review Sources Schema
-- Supports importing reviews from Google Maps, Yelp, TripAdvisor, etc.

CREATE TABLE IF NOT EXISTS external_review_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('google_maps', 'yelp', 'tripadvisor', 'facebook', 'burpple', 'other')),
  source_name TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_fetched_at TEXT,
  fetch_config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_place_mappings (
  id TEXT PRIMARY KEY,
  stall_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  external_place_id TEXT NOT NULL,
  external_place_name TEXT NOT NULL,
  external_place_url TEXT NOT NULL DEFAULT '',
  is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES external_review_sources(id) ON DELETE CASCADE,
  UNIQUE(stall_id, source_id)
);

CREATE TABLE IF NOT EXISTS external_reviews (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  stall_id TEXT NOT NULL,
  external_review_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_url TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment_text TEXT NOT NULL DEFAULT '',
  review_url TEXT NOT NULL DEFAULT '',
  review_date TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  is_highlighted INTEGER NOT NULL DEFAULT 0 CHECK (is_highlighted IN (0, 1)),
  fetched_at TEXT NOT NULL,
  raw_data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES external_review_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE,
  UNIQUE(source_id, external_review_id)
);

CREATE TABLE IF NOT EXISTS external_review_stats (
  id TEXT PRIMARY KEY,
  stall_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  average_rating REAL,
  last_review_date TEXT,
  computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES external_review_sources(id) ON DELETE CASCADE,
  UNIQUE(stall_id, source_id)
);

CREATE TABLE IF NOT EXISTS external_review_sync_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'guarded')),
  reviews_fetched INTEGER NOT NULL DEFAULT 0,
  reviews_imported INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  error_text TEXT,
  FOREIGN KEY (source_id) REFERENCES external_review_sources(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_external_review_sources_type ON external_review_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_external_place_mappings_stall ON external_place_mappings(stall_id);
CREATE INDEX IF NOT EXISTS idx_external_place_mappings_source ON external_place_mappings(source_id);
CREATE INDEX IF NOT EXISTS idx_external_reviews_stall ON external_reviews(stall_id);
CREATE INDEX IF NOT EXISTS idx_external_reviews_source ON external_reviews(source_id);
CREATE INDEX IF NOT EXISTS idx_external_reviews_fetched ON external_reviews(fetched_at);
CREATE INDEX IF NOT EXISTS idx_external_review_stats_stall ON external_review_stats(stall_id);
CREATE INDEX IF NOT EXISTS idx_external_review_stats_source ON external_review_stats(source_id);
