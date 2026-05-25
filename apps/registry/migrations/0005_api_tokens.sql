CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_handle TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY(user_handle) REFERENCES publishers(handle)
);
