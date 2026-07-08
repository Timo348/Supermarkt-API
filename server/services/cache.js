import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ttl_minutes INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cache_created_at ON cache(created_at);
`);

const insertStmt = db.prepare(`
  INSERT INTO cache (key, value, created_at, ttl_minutes)
  VALUES (@key, @value, @createdAt, @ttlMinutes)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    created_at = excluded.created_at,
    ttl_minutes = excluded.ttl_minutes
`);

const selectStmt = db.prepare('SELECT * FROM cache WHERE key = ?');
const deleteStmt = db.prepare('DELETE FROM cache WHERE key = ?');
const cleanupStmt = db.prepare('DELETE FROM cache WHERE created_at + ttl_minutes * 60 < ?');

export function get(key) {
  const row = selectStmt.get(key);
  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = row.created_at + row.ttl_minutes * 60;
  if (now > expiresAt) {
    deleteStmt.run(key);
    return null;
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function set(key, value, ttlMinutes = config.cacheTtlMinutes) {
  insertStmt.run({
    key,
    value: JSON.stringify(value),
    createdAt: Math.floor(Date.now() / 1000),
    ttlMinutes
  });
}

export function clear(key) {
  if (key) {
    deleteStmt.run(key);
  } else {
    db.exec('DELETE FROM cache');
  }
}

export function cleanup() {
  cleanupStmt.run(Math.floor(Date.now() / 1000));
}
