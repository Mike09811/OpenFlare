package service

import (
	"testing"

	"openflare/common"
	"openflare/model"
)

func TestCompleteOAuthLoginRequiresLinkWhenRegistrationDisabled(t *testing.T) {
	setupServiceTestDB(t)
	previousRegisterEnabled := common.RegisterEnabled
	common.RegisterEnabled = false
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegisterEnabled
	})

	source := createTestAuthSource(t)
	result, pending, err := CompleteOAuthLogin(source, &OAuthProfile{
		ExternalID:       "external-1",
		ExternalUsername: "external-user",
		DisplayName:      "External User",
		Email:            "external@example.com",
	}, nil)
	if err != nil {
		t.Fatalf("CompleteOAuthLogin failed: %v", err)
	}
	if result.Status != "link_required" || pending == nil {
		t.Fatalf("expected link_required with pending account, got %#v pending=%#v", result, pending)
	}

	user, err := LinkPendingExternalAccount(pending, LinkExistingRequest{
		Username: "root",
		Password: "123456",
	})
	if err != nil {
		t.Fatalf("LinkPendingExternalAccount failed: %v", err)
	}
	if user.Username != "root" {
		t.Fatalf("expected root user, got %s", user.Username)
	}
	account, err := model.FindExternalAccount(source.ID, "external-1")
	if err != nil {
		t.Fatalf("expected external account to be linked: %v", err)
	}
	if account.UserID != user.Id {
		t.Fatalf("expected external account user %d, got %d", user.Id, account.UserID)
	}
}

func TestCompleteOAuthLoginAutoRegistersWhenEnabled(t *testing.T) {
	setupServiceTestDB(t)
	previousRegisterEnabled := common.RegisterEnabled
	common.RegisterEnabled = true
	t.Cleanup(func() {
		common.RegisterEnabled = previousRegisterEnabled
	})

	source := createTestAuthSource(t)
	result, pending, err := CompleteOAuthLogin(source, &OAuthProfile{
		ExternalID:       "external-2",
		ExternalUsername: "oidc-user",
		DisplayName:      "OIDC User",
		Email:            "oidc@example.com",
	}, nil)
	if err != nil {
		t.Fatalf("CompleteOAuthLogin failed: %v", err)
	}
	if pending != nil {
		t.Fatalf("expected no pending account when registration is enabled")
	}
	if result.Status != "registered" || result.User == nil {
		t.Fatalf("expected registered user result, got %#v", result)
	}
	account, err := model.FindExternalAccount(source.ID, "external-2")
	if err != nil {
		t.Fatalf("expected external account to be linked: %v", err)
	}
	if account.UserID != result.User.Id {
		t.Fatalf("expected external account user %d, got %d", result.User.Id, account.UserID)
	}
}

func createTestAuthSource(t *testing.T) *model.AuthSource {
	t.Helper()
	source := &model.AuthSource{
		Name:               "Test OIDC",
		Type:               model.AuthSourceTypeOIDC,
		DisplayName:        "Test OIDC",
		ClientID:           "client-id",
		ClientSecret:       "client-secret",
		Scopes:             "openid profile email",
		OpenIDDiscoveryURL: "https://idp.example.com/.well-known/openid-configuration",
	}
	if err := model.CreateAuthSource(source); err != nil {
		t.Fatalf("CreateAuthSource failed: %v", err)
	}
	return source
}
