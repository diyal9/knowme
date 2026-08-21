package store

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

func (s *SQLiteStore) ListProviders(ctx context.Context) ([]Provider, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,label,base_url,priority,enabled,updated_at FROM providers ORDER BY priority,id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Provider
	for rows.Next() {
		var p Provider
		var enabled int
		var updated string
		if err := rows.Scan(&p.ID, &p.Label, &p.BaseURL, &p.Priority, &enabled, &updated); err != nil {
			return nil, err
		}
		p.Enabled = enabled == 1
		p.UpdatedAt = parseTime(updated)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) UpsertProvider(ctx context.Context, provider Provider) error {
	provider.ID = strings.TrimSpace(provider.ID)
	provider.Label = strings.TrimSpace(provider.Label)
	provider.BaseURL = strings.TrimSpace(provider.BaseURL)
	if provider.ID == "" || provider.Label == "" {
		return sql.ErrNoRows
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO providers (id,label,base_url,priority,enabled,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,base_url=excluded.base_url,priority=excluded.priority,enabled=excluded.enabled,updated_at=excluded.updated_at`, provider.ID, provider.Label, provider.BaseURL, provider.Priority, boolInt(provider.Enabled), time.Now().UTC().Format(time.RFC3339Nano))
	return err
}
