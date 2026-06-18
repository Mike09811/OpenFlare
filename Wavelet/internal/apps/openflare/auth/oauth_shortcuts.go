// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Rain-kl/Wavelet/internal/db"
	"github.com/Rain-kl/Wavelet/internal/listener"
	"github.com/Rain-kl/Wavelet/internal/model"
	"github.com/Rain-kl/Wavelet/pkg/logger"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	errGitHubOAuthDisabled = "管理员未开启通过 GitHub 登录以及注册"
	errWeChatOAuthDisabled = "管理员未开启通过微信登录以及注册"
	errRegistrationClosed  = "管理员关闭了新用户注册"
	errGitHubAlreadyBound  = "该 GitHub 账户已被绑定"
	errWeChatAlreadyBound  = "该微信账号已被绑定"
)

type githubOAuthResponse struct {
	AccessToken string `json:"access_token"`
}

type githubUser struct {
	Login string `json:"login"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type wechatLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

// GitHubOAuth handles the legacy GET /oauth/github shortcut.
func GitHubOAuth(ctx context.Context, c *gin.Context, code string) (LegacyUser, error) {
	if current := currentUserFromLegacyToken(ctx, c); current != nil {
		if err := GitHubBind(ctx, c, current, code); err != nil {
			return LegacyUser{}, err
		}
		return LegacyUser{}, nil
	}

	if !model.GitHubOAuthEnabled {
		return LegacyUser{}, errors.New(errGitHubOAuthDisabled)
	}

	githubUser, err := getGitHubUserInfoByCode(code)
	if err != nil {
		return LegacyUser{}, err
	}

	user, err := findUserByShortcutBinding(ctx, githubUser.Login, "github", "GitHub")
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return LegacyUser{}, errors.New(errRegistrationClosed)
		}
		return LegacyUser{}, err
	}
	if !user.IsActive {
		return LegacyUser{}, errors.New(errBannedAccount)
	}
	return finishLegacyLogin(ctx, c, user)
}

// GitHubBind binds a GitHub account to the current user.
func GitHubBind(ctx context.Context, c *gin.Context, current *model.User, code string) error {
	if current == nil {
		return errors.New(errUnauthorized)
	}
	if !model.GitHubOAuthEnabled {
		return errors.New(errGitHubOAuthDisabled)
	}

	githubUser, err := getGitHubUserInfoByCode(code)
	if err != nil {
		return err
	}
	if _, err := findUserByShortcutBinding(ctx, githubUser.Login, "github", "GitHub"); err == nil {
		return errors.New(errGitHubAlreadyBound)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	return bindShortcutExternalAccount(ctx, current.ID, githubUser.Login, githubUser.Login, githubUser.Email, "github", "GitHub")
}

// WeChatOAuth handles the legacy GET /oauth/wechat shortcut.
func WeChatOAuth(ctx context.Context, c *gin.Context, code string) (LegacyUser, error) {
	if !model.WeChatAuthEnabled {
		return LegacyUser{}, errors.New(errWeChatOAuthDisabled)
	}

	wechatID, err := getWeChatIDByCode(code)
	if err != nil {
		return LegacyUser{}, err
	}

	user, err := findUserByShortcutBinding(ctx, wechatID, "wechat", "WeChat")
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return LegacyUser{}, errors.New(errRegistrationClosed)
		}
		return LegacyUser{}, err
	}
	if !user.IsActive {
		return LegacyUser{}, errors.New(errBannedAccount)
	}
	return finishLegacyLogin(ctx, c, user)
}

// WeChatBind binds a WeChat account to the current user.
func WeChatBind(ctx context.Context, userID uint64, code string) error {
	if userID == 0 {
		return errors.New(errUnauthorized)
	}
	if !model.WeChatAuthEnabled {
		return errors.New(errWeChatOAuthDisabled)
	}

	wechatID, err := getWeChatIDByCode(code)
	if err != nil {
		return err
	}
	if _, err := findUserByShortcutBinding(ctx, wechatID, "wechat", "WeChat"); err == nil {
		return errors.New(errWeChatAlreadyBound)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	return bindShortcutExternalAccount(ctx, userID, wechatID, wechatID, "", "wechat", "WeChat")
}

// EmailBind binds a verified email address to the current user.
func EmailBind(ctx context.Context, userID uint64, email, code string) error {
	email = strings.TrimSpace(email)
	code = strings.TrimSpace(code)
	if userID == 0 {
		return errors.New(errUnauthorized)
	}
	if email == "" || code == "" {
		return errors.New(errInvalidParams)
	}
	if !verifyEmailCode(ctx, email, "register", code) {
		return errors.New(errEmailCodeInvalid)
	}

	var user model.User
	if err := db.DB(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		return errors.New(errUserNotFound)
	}
	user.Email = email
	return db.DB(ctx).Model(&user).Update("email", email).Error
}

func finishLegacyLogin(ctx context.Context, c *gin.Context, user *model.User) (LegacyUser, error) {
	if user == nil {
		return LegacyUser{}, errors.New(errUserNotFound)
	}
	user.LastLoginAt = time.Now()
	if err := db.DB(ctx).Model(user).Update("last_login_at", user.LastLoginAt).Error; err != nil {
		return LegacyUser{}, err
	}
	if err := setLoginSession(ctx, c, user); err != nil {
		return LegacyUser{}, errors.New(errSaveSessionFailed)
	}
	token, err := issueLegacyAccessToken(ctx, user)
	if err != nil {
		return LegacyUser{}, err
	}
	logger.InfoF(ctx, "[LoginAudit] successful legacy shortcut login for user: %s, ID: %d, IP: %s", user.Username, user.ID, c.ClientIP())
	listener.EmitAdminLoggedIn(ctx, user, c.ClientIP())
	return ToLegacyUser(user, token), nil
}

func getGitHubUserInfoByCode(code string) (*githubUser, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errors.New(errInvalidParams)
	}
	values := map[string]string{
		"client_id":     model.GitHubClientId,
		"client_secret": model.GitHubClientSecret,
		"code":          code,
	}
	jsonData, err := json.Marshal(values)
	if err != nil {
		return nil, err
	}

	client := http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest(http.MethodPost, "https://github.com/login/oauth/access_token", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	res, err := client.Do(req)
	if err != nil {
		slog.Error("github oauth access token request failed", "error", err)
		return nil, errors.New("无法连接至 GitHub 服务器，请稍后重试！")
	}
	defer res.Body.Close()

	var oauthResponse githubOAuthResponse
	if err := json.NewDecoder(res.Body).Decode(&oauthResponse); err != nil {
		return nil, err
	}
	if strings.TrimSpace(oauthResponse.AccessToken) == "" {
		return nil, errors.New("无法连接至 GitHub 服务器，请稍后重试！")
	}

	req, err = http.NewRequest(http.MethodGet, "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", oauthResponse.AccessToken))

	res2, err := client.Do(req)
	if err != nil {
		slog.Error("github user info request failed", "error", err)
		return nil, errors.New("无法连接至 GitHub 服务器，请稍后重试！")
	}
	defer res2.Body.Close()

	var ghUser githubUser
	if err := json.NewDecoder(res2.Body).Decode(&ghUser); err != nil {
		return nil, err
	}
	if strings.TrimSpace(ghUser.Login) == "" {
		return nil, errors.New("返回值非法，用户字段为空，请稍后重试！")
	}
	return &ghUser, nil
}

func getWeChatIDByCode(code string) (string, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return "", errors.New(errInvalidParams)
	}
	serverAddress := strings.TrimRight(strings.TrimSpace(model.WeChatServerAddress), "/")
	if serverAddress == "" {
		return "", errors.New(errWeChatOAuthDisabled)
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/wechat/user?code=%s", serverAddress, code), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", model.WeChatServerToken)

	client := http.Client{Timeout: 5 * time.Second}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func(body io.ReadCloser) {
		if closeErr := body.Close(); closeErr != nil {
			slog.Error("failed to close wechat response body", "error", closeErr)
		}
	}(httpResponse.Body)

	var res wechatLoginResponse
	if err := json.NewDecoder(httpResponse.Body).Decode(&res); err != nil {
		return "", err
	}
	if !res.Success {
		if strings.TrimSpace(res.Message) == "" {
			return "", errors.New(errInvalidParams)
		}
		return "", errors.New(res.Message)
	}
	if strings.TrimSpace(res.Data) == "" {
		return "", errors.New(errEmailCodeInvalid)
	}
	return strings.TrimSpace(res.Data), nil
}

func findUserByShortcutBinding(ctx context.Context, externalID string, sourceNames ...string) (*model.User, error) {
	externalID = strings.TrimSpace(externalID)
	if externalID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	query := db.DB(ctx).
		Table("w_external_accounts AS ea").
		Select("u.*").
		Joins("JOIN w_users u ON u.id = ea.user_id").
		Where("ea.external_id = ?", externalID)
	if len(sourceNames) > 0 {
		lowered := make([]string, 0, len(sourceNames))
		for _, name := range sourceNames {
			trimmed := strings.ToLower(strings.TrimSpace(name))
			if trimmed != "" {
				lowered = append(lowered, trimmed)
			}
		}
		if len(lowered) > 0 {
			query = query.
				Joins("JOIN w_auth_sources s ON s.id = ea.auth_source_id").
				Where("LOWER(s.name) IN ?", lowered)
		}
	}

	var user model.User
	if err := query.First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func bindShortcutExternalAccount(ctx context.Context, userID uint64, externalID, externalUsername, email string, sourceNames ...string) error {
	source, err := resolveShortcutAuthSource(ctx, sourceNames...)
	if err != nil {
		return err
	}
	return model.BindExternalAccount(ctx, &model.ExternalAccount{
		AuthSourceID:     source.ID,
		UserID:           userID,
		ExternalID:       strings.TrimSpace(externalID),
		ExternalUsername: strings.TrimSpace(externalUsername),
		Email:            strings.TrimSpace(email),
	})
}

func resolveShortcutAuthSource(ctx context.Context, sourceNames ...string) (*model.AuthSource, error) {
	for _, name := range sourceNames {
		source, err := model.GetAuthSourceByName(ctx, name)
		if err == nil {
			return source, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	return nil, errors.New("认证源不存在")
}
