package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"knowme/server/internal/store"
)

func (s *Server) productAuth(c *gin.Context) (store.ProductActivation, bool) {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(header), "bearer ") {
		header = strings.TrimSpace(header[7:])
	}
	if header == "" {
		header = strings.TrimSpace(c.GetHeader("X-KnowMe-Token"))
	}
	if header == "" {
		return store.ProductActivation{}, false
	}
	a, err := s.store.ActivationByToken(c.Request.Context(), header)
	if err != nil {
		return store.ProductActivation{}, false
	}
	return a, true
}

func (s *Server) requireProductAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		a, ok := s.productAuth(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"ok": false, "code": "auth_required", "error": "产品授权已失效，请重新激活"})
			return
		}
		c.Set("productActivation", a)
		c.Next()
	}
}

func (s *Server) activateProduct(c *gin.Context) {
	var body struct {
		Code     string `json:"code"`
		DeviceID string `json:"device_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "code": "invalid_json", "error": "请求格式无效"})
		return
	}
	a, token, err := s.store.Activate(c.Request.Context(), body.Code, body.DeviceID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"ok": false, "code": "activation_failed", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "access_token": token, "activation": productActivationDTO(a)})
}

func (s *Server) productMe(c *gin.Context) {
	a, _ := c.Get("productActivation")
	activation, _ := a.(store.ProductActivation)
	c.JSON(http.StatusOK, gin.H{"ok": true, "activation": productActivationDTO(activation)})
}

func (s *Server) productQuota(c *gin.Context) {
	a, _ := c.Get("productActivation")
	activation := a.(store.ProductActivation)
	quota, err := s.store.GetQuota(c.Request.Context(), activation.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "failed to load quota"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "quota": quota})
}

func (s *Server) recordProductUsage(c *gin.Context) {
	a, _ := c.Get("productActivation")
	activation := a.(store.ProductActivation)
	var body struct {
		RequestID        string  `json:"request_id"`
		Model            string  `json:"model"`
		BusinessType     string  `json:"business_type"`
		PromptTokens     int64   `json:"prompt_tokens"`
		CompletionTokens int64   `json:"completion_tokens"`
		TotalTokens      int64   `json:"total_tokens"`
		Cost             float64 `json:"cost"`
		Status           string  `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "code": "invalid_json", "error": "请求格式无效"})
		return
	}
	if body.RequestID == "" {
		body.RequestID = uuid.NewString()
	}
	if body.BusinessType == "" {
		body.BusinessType = "chat"
	}
	if body.Status == "" {
		body.Status = "success"
	}
	if body.TotalTokens == 0 {
		body.TotalTokens = body.PromptTokens + body.CompletionTokens
	}
	err := s.store.RecordUsage(c.Request.Context(), store.UsageEvent{ActivationID: activation.ID, RequestID: body.RequestID, Model: body.Model, BusinessType: body.BusinessType, PromptTokens: body.PromptTokens, CompletionTokens: body.CompletionTokens, TotalTokens: body.TotalTokens, Cost: body.Cost, Status: body.Status})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "request_id": body.RequestID})
}

func (s *Server) publicModels(c *gin.Context) {
	models, err := s.store.ListModels(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "failed to load models"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "models": models})
}

func (s *Server) adminCreateActivationCodes(c *gin.Context) {
	var body struct {
		PlanID    string     `json:"plan_id"`
		Count     int        `json:"count"`
		ExpiresAt *time.Time `json:"expires_at"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	if body.Count == 0 {
		body.Count = 1
	}
	items, err := s.store.CreateActivationCodes(c.Request.Context(), strings.TrimSpace(body.PlanID), body.Count, body.ExpiresAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "items": items})
}

func (s *Server) adminPlans(c *gin.Context) {
	plans, err := s.store.ListPlans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "plans": plans})
}

func (s *Server) adminUpsertPlan(c *gin.Context) {
	var plan store.Plan
	if err := c.ShouldBindJSON(&plan); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	plan.ID = strings.TrimSpace(c.Param("id"))
	if err := s.store.UpsertPlan(c.Request.Context(), plan); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
func (s *Server) adminActivations(c *gin.Context) {
	items, err := s.store.ListActivations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "items": items})
}

func (s *Server) adminActivationCodes(c *gin.Context) {
	items, err := s.store.ListActivationCodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "items": items})
}

func (s *Server) adminSetActivationStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid activation id"})
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	if err := s.store.SetActivationStatus(c.Request.Context(), id, body.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) adminExtendActivation(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid activation id"})
		return
	}
	var body struct {
		Days int `json:"days"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	if err := s.store.ExtendActivation(c.Request.Context(), id, body.Days); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) adminModels(c *gin.Context) {
	items, err := s.store.ListModels(c.Request.Context(), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "models": items})
}
func (s *Server) adminUpsertModel(c *gin.Context) {
	var model store.Model
	if err := c.ShouldBindJSON(&model); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	if err := s.store.UpsertModel(c.Request.Context(), model); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func productActivationDTO(a store.ProductActivation) gin.H {
	remaining := int(time.Until(a.ExpiresAt).Hours() / 24)
	if remaining < 0 {
		remaining = 0
	}
	return gin.H{"id": a.ID, "device_id": a.DeviceID, "plan_id": a.PlanID, "status": a.Status, "started_at": a.StartedAt.Format(time.RFC3339), "expires_at": a.ExpiresAt.Format(time.RFC3339), "remaining_days": remaining}
}
