package store

import (
	"context"
	"encoding/json"
	"time"
)

type PublicConfig struct {
	Config    map[string]any
	UpdatedAt time.Time
}

type AuditEntry struct {
	RequestID string
	Method    string
	Path      string
	Status    int
}

type Store interface {
	GetPublicConfig(ctx context.Context) (PublicConfig, error)
	SetPublicConfig(ctx context.Context, config map[string]any) (PublicConfig, error)
	InsertAudit(ctx context.Context, entry AuditEntry) error
	EnsureSeedUser(ctx context.Context, username, password, role string) error
	AuthenticateUser(ctx context.Context, username, password string) (User, error)
	CreateSession(ctx context.Context, userID int64, ttl time.Duration) (string, error)
	UserBySession(ctx context.Context, sessionID string) (User, error)
	DeleteSession(ctx context.Context, sessionID string) error
	ListUsers(ctx context.Context) ([]User, error)
	CreateUser(ctx context.Context, username, password, role string) error
	Close() error
}

func normalizeConfigObject(raw map[string]any) map[string]any {
	if raw == nil {
		return map[string]any{}
	}
	return raw
}

func cloneConfig(src map[string]any) map[string]any {
	if src == nil {
		return map[string]any{}
	}
	b, _ := json.Marshal(src)
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	if out == nil {
		return map[string]any{}
	}
	return out
}
