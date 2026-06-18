// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package legacy

import (
	"github.com/Rain-kl/Wavelet/internal/apps/openflare/compat"
	"github.com/gin-gonic/gin"
)

func registerAuthRoutes(apiGroup *gin.RouterGroup) {
	// /status, /notice, /about are registered by T-OPTION (option.RegisterRoutes).
	apiGroup.GET("/verification", SendEmailVerification)
	apiGroup.GET("/reset_password", SendPasswordResetEmail)
	apiGroup.POST("/user/reset", ResetPassword)

	oauthGroup := apiGroup.Group("/oauth")
	{
		oauthGroup.GET("/github", GitHubOAuth)
		oauthGroup.GET("/wechat", WeChatOAuth)
		oauthGroup.GET("/wechat/bind", compat.BridgeOpenFlareToken(), compat.UserAuth(), WeChatBind)
		oauthGroup.GET("/email/bind", compat.BridgeOpenFlareToken(), compat.UserAuth(), EmailBind)
		oauthGroup.GET("/:source/authorize", OAuthAuthorize)
		oauthGroup.GET("/:source/callback", OAuthCallback)
		oauthGroup.POST("/link-existing", LinkExistingOAuthAccount)

		externalAccounts := oauthGroup.Group("/external-accounts")
		externalAccounts.Use(compat.UserAuth())
		{
			externalAccounts.GET("/", ListExternalAccounts)
			externalAccounts.POST("/:id/delete", DeleteExternalAccount)
		}
	}

	capGroup := apiGroup.Group("/cap")
	{
		capGroup.POST("/:scope/challenge", GetCapChallenge)
		capGroup.POST("/:scope/redeem", RedeemCapChallenge)
	}

	userGroup := apiGroup.Group("/user")
	{
		userGroup.POST("/register", Register)
		userGroup.POST("/login", legacyCapAuth("login"), Login)
		userGroup.GET("/logout", Logout)

		selfGroup := userGroup.Group("/")
		selfGroup.Use(compat.UserAuth())
		{
			selfGroup.GET("/self", GetSelf)
			selfGroup.POST("/self/update", UpdateSelf)
			selfGroup.POST("/self/delete", DeleteSelf)
			selfGroup.GET("/token", GenerateToken)
		}

		adminGroup := userGroup.Group("/")
		adminGroup.Use(compat.AdminAuth())
		{
			adminGroup.GET("/", GetAllUsers)
			adminGroup.GET("/search", SearchUsers)
			adminGroup.GET("/:id", GetUser)
			adminGroup.POST("/", CreateUser)
			adminGroup.POST("/manage", ManageUser)
			adminGroup.POST("/update", UpdateUser)
			adminGroup.POST("/:id/delete", DeleteUser)
		}
	}

	authSourceGroup := apiGroup.Group("/auth-sources")
	authSourceGroup.Use(compat.RootAuth())
	{
		authSourceGroup.GET("/", ListAuthSources)
		authSourceGroup.POST("/", CreateAuthSource)
		authSourceGroup.POST("/:id/update", UpdateAuthSource)
		authSourceGroup.POST("/:id/delete", DeleteAuthSource)
		authSourceGroup.POST("/:id/toggle", ToggleAuthSource)
	}
}
