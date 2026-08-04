package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        int64
	Username  string
	Role      string
	CreatedAt time.Time
}

const (
	RoleAdmin  = "admin"
	RoleViewer = "viewer"
)

func hashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func checkPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (s *SQLiteStore) EnsureSeedUser(ctx context.Context, username, password, role string) error {
	if username == "" || password == "" {
		return nil
	}
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM users WHERE username = ?`, username).Scan(&id)
	if err == nil {
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	if role == "" {
		role = RoleAdmin
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)`,
		username, hash, role, time.Now().UTC().Format(time.RFC3339Nano),
	)
	return err
}

func (s *SQLiteStore) AuthenticateUser(ctx context.Context, username, password string) (User, error) {
	var u User
	var hash, createdAt string
	err := s.db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&u.ID, &u.Username, &hash, &u.Role, &createdAt)
	if err != nil {
		return User{}, fmt.Errorf("invalid credentials")
	}
	if !checkPassword(hash, password) {
		return User{}, fmt.Errorf("invalid credentials")
	}
	u.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
	return u, nil
}

func (s *SQLiteStore) CreateSession(ctx context.Context, userID int64, ttl time.Duration) (string, error) {
	id := uuid.NewString()
	expires := time.Now().UTC().Add(ttl).Format(time.RFC3339Nano)
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
		id, userID, expires,
	)
	return id, err
}

func (s *SQLiteStore) UserBySession(ctx context.Context, sessionID string) (User, error) {
	var u User
	var createdAt, expiresAt string
	err := s.db.QueryRowContext(ctx, `
SELECT u.id, u.username, u.role, u.created_at, s.expires_at
FROM sessions s JOIN users u ON u.id = s.user_id
WHERE s.id = ?`, sessionID).Scan(&u.ID, &u.Username, &u.Role, &createdAt, &expiresAt)
	if err != nil {
		return User{}, err
	}
	exp, err := time.Parse(time.RFC3339Nano, expiresAt)
	if err != nil || time.Now().UTC().After(exp) {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, sessionID)
		return User{}, fmt.Errorf("session expired")
	}
	u.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
	return u, nil
}

func (s *SQLiteStore) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

func (s *SQLiteStore) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, username, role, created_at FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		var createdAt string
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &createdAt); err != nil {
			return nil, err
		}
		u.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) CreateUser(ctx context.Context, username, password, role string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	if role != RoleAdmin && role != RoleViewer {
		role = RoleViewer
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)`,
		username, hash, role, time.Now().UTC().Format(time.RFC3339Nano),
	)
	return err
}
