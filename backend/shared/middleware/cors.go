package middleware

import (
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS handles Cross-Origin Resource Sharing headers
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

		// Handle preflight OPTIONS request
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// CORSWithOrigins allows CORS with specific origins
func CORSWithOrigins(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := slices.Contains(allowedOrigins, origin)

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// CORSForMobile allows CORS for web and mobile apps
// Supports: localhost, exp://, http://, https:// origins
func CORSForMobile() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Allow if origin matches mobile or web patterns
		allowed := false
		if origin == "" {
			// Mobile apps might not send Origin header
			allowed = true
		} else if strings.HasPrefix(origin, "http://localhost") {
			// Web development
			allowed = true
		} else if strings.HasPrefix(origin, "https://") {
			// Production web or mobile
			allowed = true
		} else if strings.HasPrefix(origin, "exp://") {
			// Expo Go development
			allowed = true
		} else if strings.HasPrefix(origin, "http://") {
			// Allow HTTP for development (can restrict in production)
			allowed = true
		}

		if allowed && origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else if allowed && origin == "" {
			// For mobile apps that don't send Origin
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
