// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package legacy

import (
	ofauth "github.com/Rain-kl/Wavelet/internal/apps/openflare/auth"
	"github.com/Rain-kl/Wavelet/internal/apps/openflare/compat"
	"github.com/gin-gonic/gin"
)

// GitHubOAuth handles GET /oauth/github for legacy GitHub login or bind.
func GitHubOAuth(c *gin.Context) {
	user, err := ofauth.GitHubOAuth(c.Request.Context(), c, c.Query("code"))
	if err != nil {
		compat.Fail(c, err.Error())
		return
	}
	if user.ID == 0 {
		compat.OKMessage(c, "bind")
		return
	}
	compat.OK(c, user)
}

// WeChatOAuth handles GET /oauth/wechat for legacy WeChat login.
func WeChatOAuth(c *gin.Context) {
	user, err := ofauth.WeChatOAuth(c.Request.Context(), c, c.Query("code"))
	if err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OK(c, user)
}

// WeChatBind handles GET /oauth/wechat/bind for legacy WeChat account binding.
func WeChatBind(c *gin.Context) {
	if err := ofauth.WeChatBind(c.Request.Context(), callerUserID(c), c.Query("code")); err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OKMessage(c, "")
}

// EmailBind handles GET /oauth/email/bind for legacy email binding.
func EmailBind(c *gin.Context) {
	if err := ofauth.EmailBind(c.Request.Context(), callerUserID(c), c.Query("email"), c.Query("code")); err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OKMessage(c, "")
}
