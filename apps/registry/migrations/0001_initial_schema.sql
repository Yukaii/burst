-- Migration number: 0001 	 2026-05-22T00:20:30.865Z
CREATE TABLE IF NOT EXISTS publishers (
  handle TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_initials TEXT NOT NULL,
  verified INTEGER NOT NULL,
  verified_sources TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  bio TEXT
);

CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT NOT NULL,
  match_patterns TEXT NOT NULL,
  publisher_handle TEXT NOT NULL,
  trust_level TEXT NOT NULL,
  risk TEXT NOT NULL,
  permissions TEXT NOT NULL,
  source_url TEXT NOT NULL,
  installs INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5.0,
  icon TEXT NOT NULL,
  code TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  FOREIGN KEY(publisher_handle) REFERENCES publishers(handle)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_handle TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_handle) REFERENCES publishers(handle)
);
