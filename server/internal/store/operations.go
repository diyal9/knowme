package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func (s *SQLiteStore) GetUsageSummary(ctx context.Context, from, to *time.Time) (UsageSummary, error) {
	var out UsageSummary
	query := `SELECT COUNT(*), COALESCE(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),0), COALESCE(SUM(CASE WHEN status<>'success' THEN 1 ELSE 0 END),0), COALESCE(SUM(total_tokens),0), COALESCE(SUM(cost),0) FROM usage_events WHERE 1=1`
	args := []any{}
	if from != nil {
		query += ` AND created_at >= ?`
		args = append(args, from.UTC().Format(time.RFC3339Nano))
	}
	if to != nil {
		query += ` AND created_at < ?`
		args = append(args, to.UTC().Format(time.RFC3339Nano))
	}
	if err := s.db.QueryRowContext(ctx, query, args...).Scan(&out.Requests, &out.Successes, &out.Failures, &out.TotalTokens, &out.TotalCost); err != nil {
		return UsageSummary{}, err
	}
	return out, nil
}

func (s *SQLiteStore) ListAnnouncements(ctx context.Context, publicOnly bool) ([]Announcement, error) {
	query := `SELECT id,title,body,level,min_version,published,published_at,expires_at,created_at FROM announcements`
	if publicOnly {
		query += ` WHERE published=1 AND (expires_at IS NULL OR expires_at > ?)`
	}
	query += ` ORDER BY id DESC`
	args := []any{}
	if publicOnly {
		args = append(args, time.Now().UTC().Format(time.RFC3339Nano))
	}
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Announcement
	for rows.Next() {
		var item Announcement
		var published int
		var pub, exp, created sql.NullString
		if err := rows.Scan(&item.ID, &item.Title, &item.Body, &item.Level, &item.MinVersion, &published, &pub, &exp, &created); err != nil {
			return nil, err
		}
		item.Published = published == 1
		item.PublishedAt = parseNullableTime(pub)
		item.ExpiresAt = parseNullableTime(exp)
		item.CreatedAt = parseTime(created.String)
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) CreateAnnouncement(ctx context.Context, item Announcement) (Announcement, error) {
	item.Title = strings.TrimSpace(item.Title)
	item.Body = strings.TrimSpace(item.Body)
	if item.Title == "" || item.Body == "" {
		return Announcement{}, fmt.Errorf("title and body are required")
	}
	if item.Level == "" {
		item.Level = "info"
	}
	now := time.Now().UTC()
	var publishedAt any
	if item.Published {
		publishedAt = now.Format(time.RFC3339Nano)
	}
	res, err := s.db.ExecContext(ctx, `INSERT INTO announcements (title,body,level,min_version,published,published_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`, item.Title, item.Body, item.Level, item.MinVersion, boolInt(item.Published), publishedAt, nullableTime(item.ExpiresAt), now.Format(time.RFC3339Nano))
	if err != nil {
		return Announcement{}, err
	}
	item.ID, _ = res.LastInsertId()
	item.CreatedAt = now
	if item.Published {
		item.PublishedAt = &now
	}
	return item, nil
}

func (s *SQLiteStore) GetVersionPolicy(ctx context.Context) (VersionPolicy, error) {
	var p VersionPolicy
	var force int
	var updated string
	err := s.db.QueryRowContext(ctx, `SELECT latest_version,minimum_version,force_update,download_url,release_notes,updated_at FROM version_policy WHERE id=1`).Scan(&p.LatestVersion, &p.MinimumVersion, &force, &p.DownloadURL, &p.ReleaseNotes, &updated)
	p.ForceUpdate = force == 1
	p.UpdatedAt = parseTime(updated)
	return p, err
}
func (s *SQLiteStore) SetVersionPolicy(ctx context.Context, p VersionPolicy) (VersionPolicy, error) {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `UPDATE version_policy SET latest_version=?,minimum_version=?,force_update=?,download_url=?,release_notes=?,updated_at=? WHERE id=1`, strings.TrimSpace(p.LatestVersion), strings.TrimSpace(p.MinimumVersion), boolInt(p.ForceUpdate), strings.TrimSpace(p.DownloadURL), p.ReleaseNotes, now.Format(time.RFC3339Nano))
	if err != nil {
		return VersionPolicy{}, err
	}
	p.UpdatedAt = now
	return p, nil
}

func parseNullableTime(v sql.NullString) *time.Time {
	if !v.Valid || v.String == "" {
		return nil
	}
	t := parseTime(v.String)
	return &t
}
func parseTime(raw string) time.Time {
	t, _ := time.Parse(time.RFC3339Nano, raw)
	if t.IsZero() {
		t, _ = time.Parse("2006-01-02 15:04:05", raw)
	}
	return t.UTC()
}
