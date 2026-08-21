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
	RequestID string    `json:"request_id"`
	Method    string    `json:"method"`
	Path      string    `json:"path"`
	Status    int       `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Plan struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	TrialDays         int    `json:"trial_days"`
	DailyTokenLimit   int64  `json:"daily_token_limit"`
	MonthlyTokenLimit int64  `json:"monthly_token_limit"`
	MaxDevices        int    `json:"max_devices"`
	FeaturesJSON      string `json:"features_json"`
	Enabled           bool   `json:"enabled"`
}

type ActivationCode struct {
	ID          int64      `json:"id"`
	Code        string     `json:"code,omitempty"`
	CodePrefix  string     `json:"code_prefix"`
	PlanID      string     `json:"plan_id"`
	Status      string     `json:"status"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	ActivatedAt *time.Time `json:"activated_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type ProductActivation struct {
	ID         int64     `json:"id"`
	CodeID     int64     `json:"code_id"`
	DeviceID   string    `json:"device_id"`
	PlanID     string    `json:"plan_id"`
	Status     string    `json:"status"`
	StartedAt  time.Time `json:"started_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	LastSeenAt time.Time `json:"last_seen_at"`
}

type Model struct {
	ID            string    `json:"id"`
	Label         string    `json:"label"`
	Provider      string    `json:"provider"`
	ContextWindow int       `json:"context_window"`
	MaxOutput     int       `json:"max_output"`
	SupportsTools bool      `json:"supports_tools"`
	InputPrice    float64   `json:"input_price"`
	OutputPrice   float64   `json:"output_price"`
	RequiredPlan  string    `json:"required_plan"`
	Enabled       bool      `json:"enabled"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type UsageEvent struct {
	ActivationID     int64     `json:"activation_id"`
	Model            string    `json:"model"`
	BusinessType     string    `json:"business_type"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
	Cost             float64   `json:"cost"`
	Status           string    `json:"status"`
	RequestID        string    `json:"request_id"`
	CreatedAt        time.Time `json:"created_at"`
}

type Quota struct {
	PlanID           string `json:"plan_id"`
	DailyLimit       int64  `json:"daily_limit"`
	MonthlyLimit     int64  `json:"monthly_limit"`
	DailyUsed        int64  `json:"daily_used"`
	MonthlyUsed      int64  `json:"monthly_used"`
	DailyRemaining   int64  `json:"daily_remaining"`
	MonthlyRemaining int64  `json:"monthly_remaining"`
}

type Announcement struct {
	ID          int64      `json:"id"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Level       string     `json:"level"`
	MinVersion  string     `json:"min_version"`
	Published   bool       `json:"published"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type VersionPolicy struct {
	LatestVersion  string    `json:"latest_version"`
	MinimumVersion string    `json:"minimum_version"`
	ForceUpdate    bool      `json:"force_update"`
	DownloadURL    string    `json:"download_url"`
	ReleaseNotes   string    `json:"release_notes"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type UsageSummary struct {
	Requests    int64   `json:"requests"`
	Successes   int64   `json:"successes"`
	Failures    int64   `json:"failures"`
	TotalTokens int64   `json:"total_tokens"`
	TotalCost   float64 `json:"total_cost"`
}

type Provider struct {
	ID            string    `json:"id"`
	Label         string    `json:"label"`
	BaseURL       string    `json:"base_url"`
	Priority      int       `json:"priority"`
	Enabled       bool      `json:"enabled"`
	KeyConfigured bool      `json:"key_configured"`
	UpdatedAt     time.Time `json:"updated_at"`
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
	UpsertPlan(ctx context.Context, plan Plan) error
	CreateActivationCodes(ctx context.Context, planID string, count int, expiresAt *time.Time) ([]ActivationCode, error)
	ListActivationCodes(ctx context.Context) ([]ActivationCode, error)
	Activate(ctx context.Context, code, deviceID string) (ProductActivation, string, error)
	ActivationByToken(ctx context.Context, token string) (ProductActivation, error)
	ListActivations(ctx context.Context) ([]ProductActivation, error)
	SetActivationStatus(ctx context.Context, id int64, status string) error
	ExtendActivation(ctx context.Context, id int64, days int) error
	ListModels(ctx context.Context, includeDisabled bool) ([]Model, error)
	UpsertModel(ctx context.Context, model Model) error
	SetModelEnabled(ctx context.Context, id string, enabled bool) error
	RecordUsage(ctx context.Context, event UsageEvent) error
	GetQuota(ctx context.Context, activationID int64) (Quota, error)
	GetUsageSummary(ctx context.Context, from, to *time.Time) (UsageSummary, error)
	ListAudit(ctx context.Context, limit int) ([]AuditEntry, error)
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
