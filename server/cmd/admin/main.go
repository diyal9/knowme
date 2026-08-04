package main

import (
	"context"
	"log"
	"os"

	"knowme/server/internal/config"
	"knowme/server/internal/handler"
	"knowme/server/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	st, err := store.Open(cfg)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer func() { _ = st.Close() }()

	ctx := context.Background()
	if cfg.SeedPassword != "" {
		if err := st.EnsureSeedUser(ctx, cfg.SeedUser, cfg.SeedPassword, store.RoleAdmin); err != nil {
			log.Fatalf("seed admin: %v", err)
		}
		log.Printf("seed admin ensured for user %q", cfg.SeedUser)
	}

	engine := handler.NewEngine(cfg, st)
	log.Printf("knowme admin listening on %s (driver=%s)", cfg.Listen, cfg.DBDriver)
	if err := engine.Run(cfg.Listen); err != nil {
		log.Printf("server stopped: %v", err)
		os.Exit(1)
	}
}
