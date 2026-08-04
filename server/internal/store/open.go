package store

import (
	"fmt"

	"knowme/server/internal/config"
)

func Open(cfg config.Config) (Store, error) {
	switch cfg.DBDriver {
	case "sqlite":
		return OpenSQLite(cfg.DBDSN)
	case "postgres":
		return nil, fmt.Errorf("postgres driver not implemented in MVP; set KNOWME_DB_DRIVER=sqlite")
	default:
		return nil, fmt.Errorf("unknown db driver: %s", cfg.DBDriver)
	}
}
