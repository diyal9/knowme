package middleware

import (
	"context"

	"github.com/gin-gonic/gin"

	"knowme/server/internal/store"
)

type AuditWriter interface {
	InsertAudit(ctx context.Context, entry store.AuditEntry) error
}

func Audit(st AuditWriter) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if st == nil {
			return
		}
		_ = st.InsertAudit(c.Request.Context(), store.AuditEntry{
			RequestID: GetRequestID(c),
			Method:    c.Request.Method,
			Path:      c.Request.URL.Path,
			Status:    c.Writer.Status(),
		})
	}
}
