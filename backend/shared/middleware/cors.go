package middleware

import (
	"os"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// defaultAllowedOrigins is the list of origins allowed in development.
var defaultAllowedOrigins = []string{
	"http://localhost:3000",
	"http://localhost:3002",
}

// CORS handles Cross-Origin Resource Sharing headers.
// Dynamically checks the Origin header against an allowed list
// and reflects the specific origin instead of using a wildcard,
// so Access-Control-Allow-Credentials can be safely set to true.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if slices.Contains(defaultAllowedOrigins, origin) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Vary", "Origin")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID, X-CSRF-Token")
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
		if slices.Contains(allowedOrigins, origin) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Vary", "Origin")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID, X-CSRF-Token")
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

// productionAllowedOrigins is the list of origins allowed in production for mobile CORS.
// Add your production domain(s) here.
var productionAllowedOrigins = []string{
	// "https://mydreamcampus.com",
}

// CORSForMobile allows CORS for web and mobile apps.
// In production (APP_ENV=production), only known origins are allowed.
// In development, localhost and Expo origins are also permitted.
func CORSForMobile() gin.HandlerFunc {
	isProduction := os.Getenv("APP_ENV") == "production"

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin == "" {
			// Mobile apps (native HTTP clients) don't send an Origin header.
			// No Access-Control-Allow-Origin is needed; the browser isn't involved.
			// Just set common headers and continue.
			setCORSCommonHeaders(c)
			if c.Request.Method == "OPTIONS" {
				c.AbortWithStatus(204)
				return
			}
			c.Next()
			return
		}

		allowed := false
		if isProduction {
			// In production, only allow explicitly listed origins
			allowed = slices.Contains(productionAllowedOrigins, origin)
		} else {
			// In development, allow localhost, exp:// (Expo Go)
			allowed = strings.HasPrefix(origin, "http://localhost") ||
				strings.HasPrefix(origin, "exp://") ||
				slices.Contains(productionAllowedOrigins, origin)
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Vary", "Origin")
		}

		setCORSCommonHeaders(c)

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// setCORSCommonHeaders writes the shared CORS headers that don't depend on origin validation.
func setCORSCommonHeaders(c *gin.Context) {
	c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID, X-CSRF-Token")
	c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
	c.Writer.Header().Set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After")
	c.Writer.Header().Set("Access-Control-Max-Age", "86400")
}
