package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"knowme/server/internal/config"
	"knowme/server/internal/middleware"
	"knowme/server/internal/store"
)

type Server struct {
	cfg   config.Config
	store store.Store
}

func New(cfg config.Config, st store.Store) *Server {
	return &Server{cfg: cfg, store: st}
}

func (s *Server) Register(r *gin.Engine) {
	r.GET("/healthz", s.healthz)
	r.GET("/v1/config/public", s.getPublicConfig)
	r.GET("/v1/app/version-policy", s.getVersionPolicy)
	r.GET("/v1/announcements", s.getAnnouncements)
	r.POST("/v1/activation/activate", s.activateProduct)
	r.GET("/v1/models", s.publicModels)
	product := r.Group("/v1", s.requireProductAuth())
	product.GET("/me", s.productMe)
	product.GET("/quota", s.productQuota)
	product.POST("/usage/events", s.recordProductUsage)
	product.POST("/chat/completions", s.chatCompletions)
	s.registerWeb(r)
	admin := r.Group("/v1/admin")
	admin.Use(s.adminWriteAuth())
	admin.PUT("/config/public", s.putPublicConfig)
	admin.GET("/plans", s.adminPlans)
	admin.GET("/activations", s.adminActivations)
	admin.POST("/activation-codes", s.adminCreateActivationCodes)
	admin.GET("/models", s.adminModels)
	admin.PUT("/models", s.adminUpsertModel)
	admin.GET("/usage/summary", s.adminUsageSummary)
	admin.GET("/announcements", s.adminAnnouncements)
	admin.POST("/announcements", s.adminCreateAnnouncement)
	admin.GET("/version-policy", s.adminVersionPolicy)
	admin.PUT("/version-policy", s.adminSetVersionPolicy)
}

func (s *Server) healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) getPublicConfig(c *gin.Context) {
	pc, err := s.store.GetPublicConfig(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "failed to load config"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"config":     pc.Config,
		"updated_at": pc.UpdatedAt.Format(time.RFC3339),
	})
}

func (s *Server) putPublicConfig(c *gin.Context) {
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	pc, err := s.store.SetPublicConfig(c.Request.Context(), body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "failed to save config"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"config":     pc.Config,
		"updated_at": pc.UpdatedAt.Format(time.RFC3339),
	})
}

func NewEngine(cfg config.Config, st store.Store) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.NewRateLimiter(cfg.RateLimitRPS).Middleware())
	r.Use(middleware.Audit(st))
	srv := New(cfg, st)
	srv.Register(r)
	return r
}
