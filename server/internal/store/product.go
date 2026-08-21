package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

func hashProductSecret(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func (s *SQLiteStore) ListPlans(ctx context.Context) ([]Plan, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,name,trial_days,daily_token_limit,monthly_token_limit,max_devices,features_json,enabled FROM plans WHERE enabled = 1 ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Plan
	for rows.Next() {
		var p Plan
		var enabled int
		if err := rows.Scan(&p.ID, &p.Name, &p.TrialDays, &p.DailyTokenLimit, &p.MonthlyTokenLimit, &p.MaxDevices, &p.FeaturesJSON, &enabled); err != nil {
			return nil, err
		}
		p.Enabled = enabled == 1
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) UpsertPlan(ctx context.Context, plan Plan) error {
	plan.ID = strings.TrimSpace(plan.ID)
	plan.Name = strings.TrimSpace(plan.Name)
	if plan.ID == "" || plan.Name == "" || plan.TrialDays < 0 || plan.MaxDevices < 1 || plan.DailyTokenLimit < 0 || plan.MonthlyTokenLimit < 0 {
		return fmt.Errorf("invalid plan")
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO plans (id,name,trial_days,daily_token_limit,monthly_token_limit,max_devices,features_json,enabled) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,trial_days=excluded.trial_days,daily_token_limit=excluded.daily_token_limit,monthly_token_limit=excluded.monthly_token_limit,max_devices=excluded.max_devices,features_json=excluded.features_json,enabled=excluded.enabled`, plan.ID, plan.Name, plan.TrialDays, plan.DailyTokenLimit, plan.MonthlyTokenLimit, plan.MaxDevices, plan.FeaturesJSON, boolInt(plan.Enabled))
	return err
}

func (s *SQLiteStore) CreateActivationCodes(ctx context.Context, planID string, count int, expiresAt *time.Time) ([]ActivationCode, error) {
	if count < 1 || count > 1000 {
		return nil, fmt.Errorf("count must be between 1 and 1000")
	}
	var exists int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM plans WHERE id = ? AND enabled = 1`, planID).Scan(&exists); err != nil {
		return nil, err
	}
	if exists == 0 {
		return nil, fmt.Errorf("unknown plan")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	out := make([]ActivationCode, 0, count)
	for i := 0; i < count; i++ {
		plain := "KM-" + strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", ""))
		now := time.Now().UTC()
		res, err := tx.ExecContext(ctx, `INSERT INTO activation_codes (code_hash,code_prefix,plan_id,expires_at,created_at) VALUES (?,?,?,?,?)`, hashProductSecret(plain), plain[:7], planID, nullableTime(expiresAt), now.Format(time.RFC3339Nano))
		if err != nil {
			return nil, err
		}
		id, _ := res.LastInsertId()
		out = append(out, ActivationCode{ID: id, Code: plain, PlanID: planID, Status: "unused", ExpiresAt: expiresAt, CreatedAt: now})
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return out, nil
}

func nullableTime(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func (s *SQLiteStore) Activate(ctx context.Context, code, deviceID string) (ProductActivation, string, error) {
	code = strings.TrimSpace(code)
	deviceID = strings.TrimSpace(deviceID)
	if code == "" || deviceID == "" {
		return ProductActivation{}, "", fmt.Errorf("code and device_id are required")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ProductActivation{}, "", err
	}
	defer tx.Rollback()
	var codeID int64
	var planID, status, expiresRaw string
	var codeExpires sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT id,plan_id,status,expires_at FROM activation_codes WHERE code_hash = ?`, hashProductSecret(code)).Scan(&codeID, &planID, &status, &codeExpires)
	if err == sql.ErrNoRows {
		return ProductActivation{}, "", fmt.Errorf("activation code is invalid")
	}
	if err != nil {
		return ProductActivation{}, "", err
	}
	if status == "revoked" || status == "frozen" {
		return ProductActivation{}, "", fmt.Errorf("activation code is unavailable")
	}
	if codeExpires.Valid {
		expiresRaw = codeExpires.String
		if t, e := time.Parse(time.RFC3339Nano, expiresRaw); e == nil && time.Now().UTC().After(t) {
			return ProductActivation{}, "", fmt.Errorf("activation code is expired")
		}
	}
	var trialDays, maxDevices int
	if err := tx.QueryRowContext(ctx, `SELECT trial_days,max_devices FROM plans WHERE id = ? AND enabled = 1`, planID).Scan(&trialDays, &maxDevices); err != nil {
		return ProductActivation{}, "", fmt.Errorf("plan is unavailable")
	}
	var existing ProductActivation
	var startRaw, endRaw, seenRaw string
	err = tx.QueryRowContext(ctx, `SELECT id,code_id,device_id,plan_id,status,started_at,expires_at,last_seen_at FROM product_activations WHERE code_id = ? AND device_id = ?`, codeID, deviceID).Scan(&existing.ID, &existing.CodeID, &existing.DeviceID, &existing.PlanID, &existing.Status, &startRaw, &endRaw, &seenRaw)
	now := time.Now().UTC()
	if err == nil {
		expires, _ := time.Parse(time.RFC3339Nano, endRaw)
		existing.StartedAt, _ = time.Parse(time.RFC3339Nano, startRaw)
		existing.ExpiresAt = expires
		existing.LastSeenAt = now
		_, err = tx.ExecContext(ctx, `UPDATE product_activations SET last_seen_at = ?, status = 'active' WHERE id = ?`, now.Format(time.RFC3339Nano), existing.ID)
	} else if err == sql.ErrNoRows {
		var deviceCount int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM product_activations WHERE code_id = ?`, codeID).Scan(&deviceCount); err != nil {
			return ProductActivation{}, "", err
		}
		if deviceCount >= maxDevices {
			return ProductActivation{}, "", fmt.Errorf("device limit reached")
		}
		end := now.Add(time.Duration(trialDays) * 24 * time.Hour)
		if trialDays == 0 {
			end = now.Add(3650 * 24 * time.Hour)
		}
		res, e := tx.ExecContext(ctx, `INSERT INTO product_activations (code_id,device_id,plan_id,status,started_at,expires_at,last_seen_at) VALUES (?,?,?,'active',?,?,?)`, codeID, deviceID, planID, now.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano))
		if e != nil {
			return ProductActivation{}, "", e
		}
		existing = ProductActivation{CodeID: codeID, DeviceID: deviceID, PlanID: planID, Status: "active", StartedAt: now, ExpiresAt: end, LastSeenAt: now}
		existing.ID, _ = res.LastInsertId()
		_, _ = tx.ExecContext(ctx, `UPDATE activation_codes SET status = 'activated', activated_at = ? WHERE id = ?`, now.Format(time.RFC3339Nano), codeID)
		err = nil
	} else {
		return ProductActivation{}, "", err
	}
	if err != nil {
		return ProductActivation{}, "", err
	}
	token := uuid.NewString() + uuid.NewString()
	_, err = tx.ExecContext(ctx, `INSERT INTO product_tokens (token_hash,activation_id,expires_at,created_at) VALUES (?,?,?,?)`, hashProductSecret(token), existing.ID, now.Add(30*24*time.Hour).Format(time.RFC3339Nano), now.Format(time.RFC3339Nano))
	if err != nil {
		return ProductActivation{}, "", err
	}
	if err := tx.Commit(); err != nil {
		return ProductActivation{}, "", err
	}
	return existing, token, nil
}

func (s *SQLiteStore) ActivationByToken(ctx context.Context, token string) (ProductActivation, error) {
	var a ProductActivation
	var startRaw, endRaw, seenRaw string
	err := s.db.QueryRowContext(ctx, `SELECT a.id,a.code_id,a.device_id,a.plan_id,a.status,a.started_at,a.expires_at,a.last_seen_at FROM product_tokens t JOIN product_activations a ON a.id=t.activation_id WHERE t.token_hash = ? AND t.expires_at > ?`, hashProductSecret(strings.TrimSpace(token)), time.Now().UTC().Format(time.RFC3339Nano)).Scan(&a.ID, &a.CodeID, &a.DeviceID, &a.PlanID, &a.Status, &startRaw, &endRaw, &seenRaw)
	if err != nil {
		return ProductActivation{}, fmt.Errorf("product authorization required")
	}
	a.StartedAt, _ = time.Parse(time.RFC3339Nano, startRaw)
	a.ExpiresAt, _ = time.Parse(time.RFC3339Nano, endRaw)
	a.LastSeenAt, _ = time.Parse(time.RFC3339Nano, seenRaw)
	if a.Status != "active" || time.Now().UTC().After(a.ExpiresAt) {
		return ProductActivation{}, fmt.Errorf("product authorization expired")
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE product_activations SET last_seen_at = ? WHERE id = ?`, time.Now().UTC().Format(time.RFC3339Nano), a.ID)
	return a, nil
}

func (s *SQLiteStore) ListActivations(ctx context.Context) ([]ProductActivation, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,code_id,device_id,plan_id,status,started_at,expires_at,last_seen_at FROM product_activations ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProductActivation
	for rows.Next() {
		var a ProductActivation
		var st, en, seen string
		if err := rows.Scan(&a.ID, &a.CodeID, &a.DeviceID, &a.PlanID, &a.Status, &st, &en, &seen); err != nil {
			return nil, err
		}
		a.StartedAt, _ = time.Parse(time.RFC3339Nano, st)
		a.ExpiresAt, _ = time.Parse(time.RFC3339Nano, en)
		a.LastSeenAt, _ = time.Parse(time.RFC3339Nano, seen)
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) SetActivationStatus(ctx context.Context, id int64, status string) error {
	status = strings.ToLower(strings.TrimSpace(status))
	if status != "active" && status != "frozen" && status != "revoked" {
		return fmt.Errorf("invalid activation status")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE product_activations SET status = ?, last_seen_at = ? WHERE id = ?`, status, time.Now().UTC().Format(time.RFC3339Nano), id)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *SQLiteStore) ExtendActivation(ctx context.Context, id int64, days int) error {
	if days < 1 || days > 3650 {
		return fmt.Errorf("days must be between 1 and 3650")
	}
	var raw string
	if err := s.db.QueryRowContext(ctx, `SELECT expires_at FROM product_activations WHERE id = ?`, id).Scan(&raw); err != nil {
		return err
	}
	now := time.Now().UTC()
	expires := parseTime(raw)
	if expires.Before(now) {
		expires = now
	}
	expires = expires.Add(time.Duration(days) * 24 * time.Hour)
	result, err := s.db.ExecContext(ctx, `UPDATE product_activations SET expires_at = ?, status = 'active', last_seen_at = ? WHERE id = ?`, expires.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano), id)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *SQLiteStore) ListModels(ctx context.Context, includeDisabled bool) ([]Model, error) {
	query := `SELECT id,label,provider,context_window,max_output,supports_tools,input_price,output_price,required_plan,enabled,updated_at FROM models`
	if !includeDisabled {
		query += ` WHERE enabled = 1`
	}
	query += ` ORDER BY provider,id`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Model
	for rows.Next() {
		var m Model
		var tools, enabled int
		var updated string
		if err := rows.Scan(&m.ID, &m.Label, &m.Provider, &m.ContextWindow, &m.MaxOutput, &tools, &m.InputPrice, &m.OutputPrice, &m.RequiredPlan, &enabled, &updated); err != nil {
			return nil, err
		}
		m.SupportsTools = tools == 1
		m.Enabled = enabled == 1
		m.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *SQLiteStore) UpsertModel(ctx context.Context, model Model) error {
	if strings.TrimSpace(model.ID) == "" || strings.TrimSpace(model.Provider) == "" {
		return fmt.Errorf("model id and provider are required")
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := s.db.ExecContext(ctx, `INSERT INTO models (id,label,provider,context_window,max_output,supports_tools,input_price,output_price,required_plan,enabled,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,provider=excluded.provider,context_window=excluded.context_window,max_output=excluded.max_output,supports_tools=excluded.supports_tools,input_price=excluded.input_price,output_price=excluded.output_price,required_plan=excluded.required_plan,enabled=excluded.enabled,updated_at=excluded.updated_at`, model.ID, model.Label, model.Provider, model.ContextWindow, model.MaxOutput, boolInt(model.SupportsTools), model.InputPrice, model.OutputPrice, model.RequiredPlan, boolInt(model.Enabled), now)
	return err
}

func (s *SQLiteStore) SetModelEnabled(ctx context.Context, id string, enabled bool) error {
	_, err := s.db.ExecContext(ctx, `UPDATE models SET enabled = ?, updated_at = ? WHERE id = ?`, boolInt(enabled), time.Now().UTC().Format(time.RFC3339Nano), strings.TrimSpace(id))
	return err
}
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
