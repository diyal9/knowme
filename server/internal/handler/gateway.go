package handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"knowme/server/internal/middleware"
	"knowme/server/internal/store"
)

type chatUsage struct {
	PromptTokens     int64 `json:"prompt_tokens"`
	CompletionTokens int64 `json:"completion_tokens"`
	TotalTokens      int64 `json:"total_tokens"`
}

func (s *Server) chatCompletions(c *gin.Context) {
	aRaw, _ := c.Get("productActivation")
	activation := aRaw.(store.ProductActivation)
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "code": "invalid_json", "error": "请求格式无效"})
		return
	}
	modelID, _ := payload["model"].(string)
	modelID = strings.TrimSpace(modelID)
	if modelID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "code": "model_required", "error": "模型不能为空"})
		return
	}
	models, err := s.store.ListModels(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "模型目录不可用"})
		return
	}
	var model store.Model
	for _, item := range models {
		if item.ID == modelID {
			model = item
			break
		}
	}
	if model.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "code": "model_disabled", "error": "模型不可用"})
		return
	}
	if model.RequiredPlan != "" && model.RequiredPlan != activation.PlanID {
		c.JSON(http.StatusForbidden, gin.H{"ok": false, "code": "plan_required", "error": "当前套餐未开放此模型"})
		return
	}
	quota, err := s.store.GetQuota(c.Request.Context(), activation.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "额度状态不可用"})
		return
	}
	if (quota.DailyLimit > 0 && quota.DailyRemaining <= 0) || (quota.MonthlyLimit > 0 && quota.MonthlyRemaining <= 0) {
		c.JSON(http.StatusTooManyRequests, gin.H{"ok": false, "code": "quota_exceeded", "error": "体验额度已用完"})
		return
	}

	stream, _ := payload["stream"].(bool)
	payload["model"] = model.ID
	if stream {
		payload["stream_options"] = map[string]any{"include_usage": true}
	}
	body, _ := json.Marshal(payload)
	endpoint, key := providerEndpointAndKey(model.Provider)
	if endpoint == "" || key == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"ok": false, "code": "provider_not_configured", "error": "模型服务尚未配置"})
		return
	}
	reqCtx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "模型请求创建失败"})
		return
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream, application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"ok": false, "code": "provider_unavailable", "error": "模型服务暂时不可用"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		c.JSON(http.StatusBadGateway, gin.H{"ok": false, "code": "provider_error", "error": "模型服务返回错误", "provider_status": resp.StatusCode, "detail": sanitizeProviderDetail(data)})
		return
	}
	requestID := middleware.GetRequestID(c)
	businessType := strings.TrimSpace(c.GetHeader("X-KnowMe-Business-Type"))
	if businessType == "" {
		businessType = "chat"
	}
	if stream {
		s.writeStreamResponse(c, resp.Body, activation.ID, model, requestID, businessType)
		return
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"ok": false, "code": "provider_read_error", "error": "模型响应读取失败"})
		return
	}
	var response map[string]any
	if err := json.Unmarshal(data, &response); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"ok": false, "code": "provider_invalid_json", "error": "模型响应格式无效"})
		return
	}
	usage := parseUsage(response["usage"])
	_ = s.recordGatewayUsage(c, activation.ID, model, requestID, businessType, usage, "success")
	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}

func (s *Server) writeStreamResponse(c *gin.Context, reader io.Reader, activationID int64, model store.Model, requestID, businessType string) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Status(http.StatusOK)
	flusher, _ := c.Writer.(http.Flusher)
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 4096), 2<<20)
	usage := chatUsage{}
	for scanner.Scan() {
		line := scanner.Bytes()
		_, _ = c.Writer.Write(append(append([]byte{}, line...), '\n'))
		if flusher != nil {
			flusher.Flush()
		}
		if bytes.HasPrefix(line, []byte("data:")) {
			raw := bytes.TrimSpace(bytes.TrimPrefix(line, []byte("data:")))
			var part map[string]any
			if json.Unmarshal(raw, &part) == nil {
				if u := parseUsage(part["usage"]); u.TotalTokens > 0 {
					usage = u
				}
			}
		}
	}
	status := "success"
	if scanner.Err() != nil {
		status = "stream_error"
	}
	_ = s.recordGatewayUsage(c, activationID, model, requestID, businessType, usage, status)
}

func (s *Server) recordGatewayUsage(c *gin.Context, activationID int64, model store.Model, requestID, businessType string, usage chatUsage, status string) error {
	cost := float64(usage.PromptTokens)/1000000*model.InputPrice + float64(usage.CompletionTokens)/1000000*model.OutputPrice
	return s.store.RecordUsage(c.Request.Context(), store.UsageEvent{ActivationID: activationID, RequestID: requestID, Model: model.ID, BusinessType: businessType, PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens, Cost: cost, Status: status})
}
func parseUsage(raw any) chatUsage {
	b, _ := json.Marshal(raw)
	var u chatUsage
	_ = json.Unmarshal(b, &u)
	if u.TotalTokens == 0 {
		u.TotalTokens = u.PromptTokens + u.CompletionTokens
	}
	return u
}
func sanitizeProviderDetail(raw []byte) string {
	var body map[string]any
	if json.Unmarshal(raw, &body) == nil {
		if err, ok := body["error"].(map[string]any); ok {
			if msg, ok := err["message"].(string); ok {
				return msg
			}
		}
	}
	return "provider request failed"
}

func providerEndpointAndKey(provider string) (string, string) {
	p := strings.ToLower(strings.TrimSpace(provider))
	switch p {
	case "openai":
		return joinEndpoint(envOr("KNOWME_OPENAI_BASE_URL", "https://api.openai.com/v1"), "chat/completions"), strings.TrimSpace(os.Getenv("KNOWME_OPENAI_API_KEY"))
	case "dashscope":
		return joinEndpoint(envOr("KNOWME_DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"), "chat/completions"), strings.TrimSpace(os.Getenv("KNOWME_DASHSCOPE_API_KEY"))
	default:
		return "", ""
	}
}
func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
func joinEndpoint(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}
