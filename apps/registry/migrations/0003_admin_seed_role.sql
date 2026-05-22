-- Migration number: 0003 	 2026-05-22T00:40:00.000Z
UPDATE publishers
SET role = 'admin'
WHERE handle = '@burst-examples';
