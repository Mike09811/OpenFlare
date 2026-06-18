// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package legacy

import (
	"github.com/Rain-kl/Wavelet/internal/apps/cap"
	"github.com/Rain-kl/Wavelet/internal/apps/openflare/compat"
	"github.com/gin-gonic/gin"
)

// legacyCapAuth verifies PoW CAPTCHA for legacy login using OpenFlare response format.
func legacyCapAuth(scope string) gin.HandlerFunc {
	mgr := cap.GetDefaultManager()
	return func(c *gin.Context) {
		if !cap.ProtectionEnabled(c.Request.Context()) {
			c.Next()
			return
		}
		token := c.GetHeader("X-Cap-Token")
		if token == "" {
			compat.Fail(c, "缺少人机验证凭证")
			c.Abort()
			return
		}
		valid, err := mgr.VerifyToken(c.Request.Context(), token, scope)
		if err != nil || !valid {
			compat.Fail(c, "人机验证凭证无效或已过期")
			c.Abort()
			return
		}
		c.Next()
	}
}

func callerRole(c *gin.Context) int {
	if role, ok := c.Get("of_role"); ok {
		if v, ok := role.(int); ok {
			return v
		}
	}
	return 0
}

func callerUserID(c *gin.Context) uint64 {
	if id, ok := c.Get("of_user_id"); ok {
		if v, ok := id.(uint64); ok {
			return v
		}
	}
	return 0
}
