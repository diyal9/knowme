package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type bucket struct {
	count int
	reset time.Time
}

type RateLimiter struct {
	rps   int
	mu    sync.Mutex
	byKey map[string]*bucket
}

func NewRateLimiter(rps int) *RateLimiter {
	return &RateLimiter{rps: rps, byKey: make(map[string]*bucket)}
}

func (l *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()
		now := time.Now()
		l.mu.Lock()
		b, ok := l.byKey[key]
		if !ok || now.After(b.reset) {
			b = &bucket{count: 0, reset: now.Add(time.Second)}
			l.byKey[key] = b
		}
		b.count++
		allowed := b.count <= l.rps
		l.mu.Unlock()
		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"ok":    false,
				"error": "rate limit exceeded",
			})
			return
		}
		c.Next()
	}
}
