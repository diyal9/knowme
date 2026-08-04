package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Listen       string
	AdminKey     string
	SessionSecret string
	SeedUser     string
	SeedPassword string
	DBDriver     string
	DBDSN        string
	RateLimitRPS int
}

func Load() (Config, error) {
	cfg := Config{
		Listen:        envOr("KNOWME_ADMIN_LISTEN", ":8020"),
		AdminKey:      strings.TrimSpace(os.Getenv("KNOWME_ADMIN_KEY")),
		SessionSecret: strings.TrimSpace(os.Getenv("KNOWME_SESSION_SECRET")),
		SeedUser:      envOr("KNOWME_ADMIN_SEED_USER", "admin"),
		SeedPassword:  strings.TrimSpace(os.Getenv("KNOWME_ADMIN_SEED_PASSWORD")),
		DBDriver:      strings.ToLower(envOr("KNOWME_DB_DRIVER", "sqlite")),
		DBDSN:         envOr("KNOWME_DB_DSN", "admin.db"),
		RateLimitRPS:  envIntOr("KNOWME_RATE_LIMIT_RPS", 20),
	}
	if cfg.SessionSecret == "" {
		cfg.SessionSecret = cfg.AdminKey
	}
	if cfg.SessionSecret == "" {
		cfg.SessionSecret = "knowme-dev-session-change-me"
	}
	if cfg.RateLimitRPS < 1 {
		return cfg, fmt.Errorf("KNOWME_RATE_LIMIT_RPS must be >= 1")
	}
	if cfg.DBDriver != "sqlite" && cfg.DBDriver != "postgres" {
		return cfg, fmt.Errorf("unsupported KNOWME_DB_DRIVER: %s", cfg.DBDriver)
	}
	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envIntOr(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
