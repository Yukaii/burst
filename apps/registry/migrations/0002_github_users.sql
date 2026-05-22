-- Migration number: 0002 	 2026-05-22T00:20:30.865Z
ALTER TABLE publishers ADD COLUMN github_id TEXT;
ALTER TABLE publishers ADD COLUMN github_login TEXT;
ALTER TABLE publishers ADD COLUMN avatar_url TEXT;
ALTER TABLE publishers ADD COLUMN profile_url TEXT;
ALTER TABLE publishers ADD COLUMN role TEXT NOT NULL DEFAULT 'publisher';
