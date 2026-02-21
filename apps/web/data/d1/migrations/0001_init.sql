PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stalls (
  id TEXT PRIMARY KEY,
  source_stall_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  cuisine_label TEXT NOT NULL,
  country TEXT NOT NULL,
  primary_address TEXT NOT NULL,
  primary_lat REAL,
  primary_lng REAL,
  episode_number REAL,
  dish_name TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  rating_original REAL,
  rating_moderated REAL,
  opening_times TEXT NOT NULL DEFAULT '',
  time_categories_json TEXT NOT NULL DEFAULT '[]',
  hits_json TEXT NOT NULL DEFAULT '[]',
  misses_json TEXT NOT NULL DEFAULT '[]',
  youtube_title TEXT NOT NULL DEFAULT '',
  youtube_video_url TEXT,
  youtube_video_id TEXT,
  google_maps_name TEXT NOT NULL DEFAULT '',
  awards_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  source_rank INTEGER NOT NULL DEFAULT 0,
  source_sheet_hash TEXT,
  source_youtube_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stall_locations (
  id TEXT PRIMARY KEY,
  stall_id TEXT NOT NULL,
  address TEXT NOT NULL,
  lat REAL,
  lng REAL,
  youtube_video_url TEXT,
  maps_query TEXT NOT NULL DEFAULT '',
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stall_id, address),
  FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stall_sync_runs (
  id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'apply')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'guarded')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  error_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_stalls_status ON stalls(status);
CREATE INDEX IF NOT EXISTS idx_stalls_cuisine ON stalls(cuisine);
CREATE INDEX IF NOT EXISTS idx_stalls_country ON stalls(country);
CREATE INDEX IF NOT EXISTS idx_stalls_last_synced_at ON stalls(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_stall_locations_stall_id ON stall_locations(stall_id);
CREATE INDEX IF NOT EXISTS idx_stall_locations_primary ON stall_locations(stall_id, is_primary, is_active);
