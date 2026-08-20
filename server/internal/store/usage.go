package store

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (s *SQLiteStore) RecordUsage(ctx context.Context, event UsageEvent) error {
	if event.ActivationID < 1 || strings.TrimSpace(event.RequestID) == "" || strings.TrimSpace(event.Model) == "" {
		return fmt.Errorf("activation_id, request_id and model are required")
	}
	if event.TotalTokens < 0 || event.PromptTokens < 0 || event.CompletionTokens < 0 {
		return fmt.Errorf("token counts cannot be negative")
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO usage_events (activation_id,request_id,model,business_type,prompt_tokens,completion_tokens,total_tokens,cost,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, event.ActivationID, event.RequestID, event.Model, strings.TrimSpace(event.BusinessType), event.PromptTokens, event.CompletionTokens, event.TotalTokens, event.Cost, strings.TrimSpace(event.Status), event.CreatedAt.UTC().Format(time.RFC3339Nano))
	return err
}

func (s *SQLiteStore) GetQuota(ctx context.Context, activationID int64) (Quota, error) {
	var q Quota
	if err := s.db.QueryRowContext(ctx, `SELECT a.plan_id,p.daily_token_limit,p.monthly_token_limit FROM product_activations a JOIN plans p ON p.id=a.plan_id WHERE a.id=?`, activationID).Scan(&q.PlanID, &q.DailyLimit, &q.MonthlyLimit); err != nil {
		return Quota{}, err
	}
	now := time.Now().UTC()
	dayStart := now.Format("2006-01-02")
	monthStart := now.Format("2006-01")
	_ = s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(total_tokens),0) FROM usage_events WHERE activation_id=? AND substr(created_at,1,10)=?`, activationID, dayStart).Scan(&q.DailyUsed)
	_ = s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(total_tokens),0) FROM usage_events WHERE activation_id=? AND substr(created_at,1,7)=?`, activationID, monthStart).Scan(&q.MonthlyUsed)
	q.DailyRemaining = q.DailyLimit - q.DailyUsed
	q.MonthlyRemaining = q.MonthlyLimit - q.MonthlyUsed
	if q.DailyRemaining < 0 {
		q.DailyRemaining = 0
	}
	if q.MonthlyRemaining < 0 {
		q.MonthlyRemaining = 0
	}
	return q, nil
}
