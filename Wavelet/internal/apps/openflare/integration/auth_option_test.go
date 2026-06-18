// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/Rain-kl/Wavelet/internal/apps/oauth"
	"github.com/Rain-kl/Wavelet/internal/apps/openflare/compat"
	oflegacy "github.com/Rain-kl/Wavelet/internal/apps/openflare/legacy"
	"github.com/Rain-kl/Wavelet/internal/apps/openflare/option"
	"github.com/Rain-kl/Wavelet/internal/config"
	"github.com/Rain-kl/Wavelet/internal/db/idgen"
	"github.com/Rain-kl/Wavelet/internal/model"
	"github.com/Rain-kl/Wavelet/internal/testhelper"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type statusPayload struct {
	SystemName string `json:"system_name"`
}

type legacyUserPayload struct {
	Username string `json:"username"`
	Token    string `json:"token"`
}

func setupAuthOptionIntegration(t *testing.T) (*gorm.DB, *gin.Engine) {
	t.Helper()

	dbConn, _, cleanup := testhelper.SetupTestEnvironment(t)
	t.Cleanup(cleanup)

	require.NoError(t, dbConn.AutoMigrate(&model.OpenFlareOption{}))
	option.ResetInitializationForTest()
	t.Cleanup(option.ResetInitializationForTest)

	oldCookieName := config.Config.App.SessionCookieName
	oldSecret := config.Config.App.SessionSecret
	oldDomain := config.Config.App.SessionDomain
	oldSecure := config.Config.App.SessionSecure
	oldHTTPOnly := config.Config.App.SessionHTTPOnly
	t.Cleanup(func() {
		config.Config.App.SessionCookieName = oldCookieName
		config.Config.App.SessionSecret = oldSecret
		config.Config.App.SessionDomain = oldDomain
		config.Config.App.SessionSecure = oldSecure
		config.Config.App.SessionHTTPOnly = oldHTTPOnly
	})

	config.Config.App.SessionCookieName = "test_openflare_session"
	config.Config.App.SessionSecret = "test_openflare_session_secret"
	config.Config.App.SessionDomain = ""
	config.Config.App.SessionSecure = false
	config.Config.App.SessionHTTPOnly = true

	store := cookie.NewStore([]byte(config.Config.App.SessionSecret))
	store.Options(oauth.GetSessionOptions(3600))
	r := testhelper.NewTestGinEngine(sessions.Sessions(config.Config.App.SessionCookieName, store))

	api := r.Group("/api")
	oflegacy.RegisterRoutes(api)

	return dbConn, r
}

func seedUser(t *testing.T, dbConn *gorm.DB, username, password string, isAdmin bool) *model.User {
	t.Helper()

	user := &model.User{
		ID:       idgen.NextUint64ID(),
		Username: username,
		Nickname: username,
		Email:    username + "@openflare.test",
		IsActive: true,
		IsAdmin:  isAdmin,
	}
	require.NoError(t, user.SetEncryptedPassword(password))
	require.NoError(t, dbConn.Create(user).Error)
	return user
}

func TestGETStatusReturnsSuccessEnvelope(t *testing.T) {
	_, r := setupAuthOptionIntegration(t)

	w := performJSONRequest(t, r, http.MethodGet, "/api/status", nil, nil)

	assert.Equal(t, http.StatusOK, w.Code)
	env := decodeEnvelope(t, w)
	assert.True(t, env.Success, "message=%s", env.Message)

	var status statusPayload
	unmarshalEnvelopeData(t, env.Data, &status)
	assert.NotEmpty(t, status.SystemName)
}

func TestPOSTUserLoginWithSeededUser(t *testing.T) {
	dbConn, r := setupAuthOptionIntegration(t)
	seedUser(t, dbConn, "testuser", "password123", false)

	w := performJSONRequest(t, r, http.MethodPost, "/api/user/login", map[string]string{
		"username": "testuser",
		"password": "password123",
	}, nil)

	assert.Equal(t, http.StatusOK, w.Code)
	env := decodeEnvelope(t, w)
	assert.True(t, env.Success, "message=%s", env.Message)

	var user legacyUserPayload
	unmarshalEnvelopeData(t, env.Data, &user)
	assert.Equal(t, "testuser", user.Username)
	assert.NotEmpty(t, user.Token)
}

func TestGETUserSelfWithToken(t *testing.T) {
	dbConn, r := setupAuthOptionIntegration(t)
	seedUser(t, dbConn, "selfuser", "password123", false)

	loginResp := performJSONRequest(t, r, http.MethodPost, "/api/user/login", map[string]string{
		"username": "selfuser",
		"password": "password123",
	}, nil)
	loginEnv := decodeEnvelope(t, loginResp)
	require.True(t, loginEnv.Success, "login failed: %s", loginEnv.Message)

	var loginUser legacyUserPayload
	unmarshalEnvelopeData(t, loginEnv.Data, &loginUser)
	require.NotEmpty(t, loginUser.Token)

	w := performJSONRequest(t, r, http.MethodGet, "/api/user/self", nil, map[string]string{
		compat.OpenFlareTokenHeader(): loginUser.Token,
	})

	assert.Equal(t, http.StatusOK, w.Code)
	env := decodeEnvelope(t, w)
	assert.True(t, env.Success, "message=%s", env.Message)

	var self legacyUserPayload
	unmarshalEnvelopeData(t, env.Data, &self)
	assert.Equal(t, "selfuser", self.Username)
}

func TestGETOptionRequiresRootAuth(t *testing.T) {
	dbConn, r := setupAuthOptionIntegration(t)
	seedUser(t, dbConn, "commonuser", "password123", false)
	seedUser(t, dbConn, "rootuser", "password123", true)

	commonToken := loginAndGetToken(t, r, "commonuser", "password123")
	rootToken := loginAndGetToken(t, r, "rootuser", "password123")

	t.Run("unauthenticated", func(t *testing.T) {
		w := performJSONRequest(t, r, http.MethodGet, "/api/option/", nil, nil)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
		env := decodeEnvelope(t, w)
		assert.False(t, env.Success)
	})

	t.Run("common user forbidden", func(t *testing.T) {
		w := performJSONRequest(t, r, http.MethodGet, "/api/option/", nil, map[string]string{
			compat.OpenFlareTokenHeader(): commonToken,
		})
		assert.Equal(t, http.StatusOK, w.Code)
		env := decodeEnvelope(t, w)
		assert.False(t, env.Success)
		assert.Contains(t, env.Message, "权限不足")
	})

	t.Run("root user allowed", func(t *testing.T) {
		w := performJSONRequest(t, r, http.MethodGet, "/api/option/", nil, map[string]string{
			compat.OpenFlareTokenHeader(): rootToken,
		})
		assert.Equal(t, http.StatusOK, w.Code)
		env := decodeEnvelope(t, w)
		assert.True(t, env.Success, "message=%s", env.Message)
	})
}

func TestGETNodesWithOpenFlareToken(t *testing.T) {
	dbConn, r := setupAuthOptionIntegration(t)
	require.NoError(t, dbConn.AutoMigrate(&model.OpenFlareNode{}))
	seedUser(t, dbConn, "admin", "password123", true)
	rootToken := loginAndGetToken(t, r, "admin", "password123")

	w := performJSONRequest(t, r, http.MethodGet, "/api/nodes/", nil, map[string]string{
		compat.OpenFlareTokenHeader(): rootToken,
	})

	assert.Equal(t, http.StatusOK, w.Code)
	env := decodeEnvelope(t, w)
	assert.True(t, env.Success, "message=%s", env.Message)
}

func TestOptionHotReloadAfterUpdate(t *testing.T) {
	dbConn, r := setupAuthOptionIntegration(t)
	seedUser(t, dbConn, "admin", "password123", true)
	rootToken := loginAndGetToken(t, r, "admin", "password123")

	statusBefore := getStatusSystemName(t, r, nil)
	assert.NotEmpty(t, statusBefore)

	updateResp := performJSONRequest(t, r, http.MethodPost, "/api/option/update", map[string]string{
		"key":   "SystemName",
		"value": "HotReloadIntegration",
	}, map[string]string{
		compat.OpenFlareTokenHeader(): rootToken,
	})
	assert.Equal(t, http.StatusOK, updateResp.Code)
	updateEnv := decodeEnvelope(t, updateResp)
	assert.True(t, updateEnv.Success, "message=%s", updateEnv.Message)

	statusAfter := getStatusSystemName(t, r, nil)
	assert.Equal(t, "HotReloadIntegration", statusAfter)
	assert.Equal(t, "HotReloadIntegration", model.SystemName)

	ctx := context.Background()
	require.NoError(t, option.EnsureInitialized(ctx))
	assert.Equal(t, "HotReloadIntegration", model.OptionValue("SystemName"))
}

func loginAndGetToken(t *testing.T, r http.Handler, username, password string) string {
	t.Helper()

	w := performJSONRequest(t, r, http.MethodPost, "/api/user/login", map[string]string{
		"username": username,
		"password": password,
	}, nil)
	env := decodeEnvelope(t, w)
	require.True(t, env.Success, "login failed: %s", env.Message)

	var user legacyUserPayload
	unmarshalEnvelopeData(t, env.Data, &user)
	require.NotEmpty(t, user.Token)
	return user.Token
}

func getStatusSystemName(t *testing.T, r http.Handler, headers map[string]string) string {
	t.Helper()

	w := performJSONRequest(t, r, http.MethodGet, "/api/status", nil, headers)
	require.Equal(t, http.StatusOK, w.Code)
	env := decodeEnvelope(t, w)
	require.True(t, env.Success, "message=%s", env.Message)

	var status statusPayload
	unmarshalEnvelopeData(t, env.Data, &status)
	return status.SystemName
}
