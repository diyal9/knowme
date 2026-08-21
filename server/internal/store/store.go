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

type Plan struct {
	ID                string
	Name              string
	TrialDays         int
	DailyTokenLimit   int64
	MonthlyTokenLimit int64
	MaxDevices        int
	FeaturesJSON      string
	Enabled           bool
}

type ActivationCode struct {
	ID          int64
	Code        string
	PlanID      string
	Status      string
	ExpiresAt   *time.Time
	ActivatedAt *time.Time
	CreatedAt   time.Time
}

type ProductActivation struct {
	ID         int64
	CodeID     int64
	DeviceID   string
	PlanID     string
	Status     string
	StartedAt  time.Time
	ExpiresAt  time.Time
	LastSeenAt time.Time
}

type Model struct {
	ID            string
	Label         string
	Provider      string
	ContextWindow int
	MaxOutput     int
	SupportsTools bool
	InputPrice    float64
	OutputPrice   float64
	RequiredPlan  string
	Enabled       bool
	UpdatedAt     time.Time
}

type UsageEvent struct {
	ActivationID     int64
	Model            string
	BusinessType     string
	PromptTokens     int64
	CompletionTokens int64
	TotalTokens      int64
	Cost             float64
	Status           string
	RequestID        string
	CreatedAt        time.Time
}

type Quota struct {
	PlanID           string
	DailyLimit       int64
	MonthlyLimit     int64
	DailyUsed        int64
	MonthlyUsed      int64
	DailyRemaining   int64
	MonthlyRemaining int64
}

type Announcement struct {
	ID          int64
	Title       string
	Body        string
	Level       string
	MinVersion  string
	Published   bool
	PublishedAt *time.Time
	ExpiresAt   *time.Time
	CreatedAt   time.Time
}

type VersionPolicy struct {
	LatestVersion  string
	MinimumVersion string
	ForceUpdate    bool
	DownloadURL    string
	ReleaseNotes   string
	UpdatedAt      time.Time
}

type UsageSummary struct {
	Requests    int64
	Successes   int64
	Failures    int64
	TotalTokens int64
	TotalCost   float64
}

type Provider struct {
	ID            string
	Label         string
	BaseURL       string
	Priority      int
	Enabled       bool
	KeyConfigured bool
	UpdatedAt     time.Time
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
	ListPlans(ctx context.Context) ([]Plan, error)
	CreateActivationCodes(ctx context.Context, planID string, count int, expiresAt *time.Time) ([]ActivationCode, error)
	Activate(ctx context.Context, code, deviceID string) (ProductActivation, string, error)
	ActivationByToken(ctx context.Context, token string) (ProductActivation, error)
	ListActivations(ctx context.Context) ([]ProductActivation, error)
	ListModels(ctx context.Context, includeDisabled bool) ([]Model, error)
	UpsertModel(ctx context.Context, model Model) error
	SetModelEnabled(ctx context.Context, id string, enabled bool) error
	RecordUsage(ctx context.Context, event UsageEvent) error
	GetQuota(ctx context.Context, activationID int64) (Quota, error)
	GetUsageSummary(ctx context.Context, from, to *time.Time) (UsageSummary, error)
	ListAnnouncements(ctx context.Context, publicOnly bool) ([]Announcement, error)
	CreateAnnouncement(ctx context.Context, item Announcement) (Announcement, error)
	GetVersionPolicy(ctx context.Context) (VersionPolicy, error)
	SetVersionPolicy(ctx context.Context, policy VersionPolicy) (VersionPolicy, error)
	ListProviders(ctx context.Context) ([]Provider, error)
	UpsertProvider(ctx context.Context, provider Provider) error
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
