package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func OpenSQLite(dsn string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &SQLiteStore{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *SQLiteStore) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS public_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO public_config (id, payload, updated_at) VALUES (1, '{}', datetime('now'));
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`)
	return err
}

func (s *SQLiteStore) GetPublicConfig(ctx context.Context) (PublicConfig, error) {
	var payload string
	var updatedAt string
	err := s.db.QueryRowContext(ctx, `SELECT payload, updated_at FROM public_config WHERE id = 1`).Scan(&payload, &updatedAt)
	if err != nil {
		return PublicConfig{}, err
	}
	var cfg map[string]any
	if err := json.Unmarshal([]byte(payload), &cfg); err != nil {
		return PublicConfig{}, err
	}
	t, err := time.Parse(time.RFC3339Nano, updatedAt)
	if err != nil {
		t, err = time.Parse("2006-01-02 15:04:05", updatedAt)
		if err != nil {
			t = time.Now().UTC()
		}
	}
	return PublicConfig{Config: normalizeConfigObject(cfg), UpdatedAt: t.UTC()}, nil
}

func (s *SQLiteStore) SetPublicConfig(ctx context.Context, config map[string]any) (PublicConfig, error) {
	config = normalizeConfigObject(config)
	payload, err := json.Marshal(config)
	if err != nil {
		return PublicConfig{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := s.db.ExecContext(ctx, `UPDATE public_config SET payload = ?, updated_at = ? WHERE id = 1`, string(payload), now)
	if err != nil {
		return PublicConfig{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return PublicConfig{}, fmt.Errorf("public_config row missing")
	}
	t, _ := time.Parse(time.RFC3339Nano, now)
	return PublicConfig{Config: cloneConfig(config), UpdatedAt: t}, nil
}

func (s *SQLiteStore) InsertAudit(ctx context.Context, entry AuditEntry) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO audit_logs (request_id, method, path, status, created_at) VALUES (?, ?, ?, ?, ?)`,
		entry.RequestID, entry.Method, entry.Path, entry.Status, time.Now().UTC().Format(time.RFC3339Nano),
	)
	return err
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
