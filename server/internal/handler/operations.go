package handler

import (
	"github.com/gin-gonic/gin"
	"knowme/server/internal/store"
	"net/http"
	"time"
)

func (s *Server) getVersionPolicy(c *gin.Context) {
	p, err := s.store.GetVersionPolicy(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "failed to load version policy"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "policy": p})
}
func (s *Server) getAnnouncements(c *gin.Context) {
	items, err := s.store.ListAnnouncements(c.Request.Context(), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": "failed to load announcements"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "items": items})
}
func (s *Server) adminUsageSummary(c *gin.Context) {
	var from, to *time.Time
	summary, err := s.store.GetUsageSummary(c.Request.Context(), from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "summary": summary})
}
func (s *Server) adminAnnouncements(c *gin.Context) {
	items, err := s.store.ListAnnouncements(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "items": items})
}
func (s *Server) adminCreateAnnouncement(c *gin.Context) {
	var item store.Announcement
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	saved, err := s.store.CreateAnnouncement(c.Request.Context(), item)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "announcement": saved})
}
func (s *Server) adminVersionPolicy(c *gin.Context) {
	p, err := s.store.GetVersionPolicy(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "policy": p})
}
func (s *Server) adminSetVersionPolicy(c *gin.Context) {
	var p store.VersionPolicy
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	saved, err := s.store.SetVersionPolicy(c.Request.Context(), p)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "policy": saved})
}

func (s *Server) adminProviders(c *gin.Context) {
	items, err := s.store.ListProviders(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"ok": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "providers": items})
}
func (s *Server) adminUpsertProvider(c *gin.Context) {
	var p store.Provider
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid JSON body"})
		return
	}
	if err := s.store.UpsertProvider(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "provider is invalid"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
