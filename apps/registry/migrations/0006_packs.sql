CREATE TABLE IF NOT EXISTS packs (
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
  version TEXT NOT NULL DEFAULT '1.0.0',
  FOREIGN KEY(publisher_handle) REFERENCES publishers(handle)
);

CREATE TABLE IF NOT EXISTS pack_commands (
  pack_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  PRIMARY KEY(pack_id, command_id),
  FOREIGN KEY(pack_id) REFERENCES packs(id) ON DELETE CASCADE,
  FOREIGN KEY(command_id) REFERENCES commands(id) ON DELETE CASCADE
);
