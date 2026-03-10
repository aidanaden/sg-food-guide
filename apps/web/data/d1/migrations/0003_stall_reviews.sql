CREATE TABLE IF NOT EXISTS stall_reviews (
  id TEXT PRIMARY KEY,
  stall_id TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderation_note TEXT NOT NULL DEFAULT '',
  moderated_by TEXT,
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stall_id) REFERENCES stalls(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stall_reviews_stall_id ON stall_reviews(stall_id);
CREATE INDEX IF NOT EXISTS idx_stall_reviews_status ON stall_reviews(status);
CREATE INDEX IF NOT EXISTS idx_stall_reviews_created_at ON stall_reviews(created_at);
