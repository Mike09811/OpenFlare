package middleware

import (
	"net/http"
	"openflare/common"
	"openflare/model"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-gonic/gin"
)

const OpenFlareTokenHeader = "OpenFlare-Token"

func authHelper(c *gin.Context, minRole int) {
	tokenStr := c.GetHeader(OpenFlareTokenHeader)
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，未登录或 token 无效",
		})
		c.Abort()
		return
	}

	token, err := JWTMiddleware.ParseTokenString(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，token 无效: " + err.Error(),
		})
		c.Abort()
		return
	}

	claims := jwt.ExtractClaimsFromToken(token)
	id, ok := claims["id"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，token 格式错误",
		})
		c.Abort()
		return
	}

	dbUser := &model.User{}
	dbErr := model.DB.Select([]string{"id", "username", "display_name", "role", "status", "token"}).
		First(dbUser, "id = ?", int(id)).Error
	if dbErr != nil || dbUser.Username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，用户不存在",
		})
		c.Abort()
		return
	}

	if dbUser.Token != tokenStr {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "无权进行此操作，token 已失效或已登出",
		})
		c.Abort()
		return
	}

	if dbUser.Status == common.UserStatusDisabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户已被封禁",
		})
		c.Abort()
		return
	}

	if int(dbUser.Role) < minRole {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无权进行此操作，权限不足",
		})
		c.Abort()
		return
	}

	c.Set("username", dbUser.Username)
	c.Set("role", dbUser.Role)
	c.Set("id", dbUser.Id)
	c.Set("authByToken", true)
	c.Next()
}

func UserAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleCommonUser)
	}
}

func AdminAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleAdminUser)
	}
}

func RootAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		authHelper(c, common.RoleRootUser)
	}
}

// NoTokenAuth is kept as a compatibility no-op because admin APIs now always use OPENFLARE_TOKEN.
func NoTokenAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Next()
	}
}

// TokenOnlyAuth is kept as a compatibility no-op because admin APIs now always use OPENFLARE_TOKEN.
func TokenOnlyAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Next()
	}
}
