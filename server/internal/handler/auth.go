package handler

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"knowme/server/internal/store"
)

func (s *Server) adminWriteAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if s.adminKeyOK(c) {
			c.Next()
			return
		}
		if u, ok := s.currentUser(c); ok && u.Role == store.RoleAdmin {
			c.Set("webUser", u)
			c.Next()
			return
		}
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"ok": false, "error": "unauthorized"})
	}
}

func (s *Server) adminKeyOK(c *gin.Context) bool {
	expected := s.cfg.AdminKey
	if expected == "" {
		return false
	}
	got := strings.TrimSpace(c.GetHeader("X-Admin-Key"))
	return subtle.ConstantTimeCompare([]byte(got), []byte(expected)) == 1
}
