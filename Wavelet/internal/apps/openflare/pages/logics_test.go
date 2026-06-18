// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package pages

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/Rain-kl/Wavelet/internal/db"
	"github.com/Rain-kl/Wavelet/internal/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPagesTestDB(t *testing.T) func() {
	t.Helper()

	sqliteDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	require.NoError(t, err)
	require.NoError(t, sqliteDB.AutoMigrate(
		&model.PagesProject{},
		&model.PagesDeployment{},
		&model.PagesDeploymentFile{},
		&model.ConfigVersion{},
	))

	db.SetDB(sqliteDB)
	return func() {
		db.SetDB(nil)
	}
}

func TestCreateProject(t *testing.T) {
	cleanup := setupPagesTestDB(t)
	defer cleanup()
	ctx := context.Background()

	project, err := CreateProject(ctx, Input{
		Name:               "Marketing Site",
		Slug:               "marketing-site",
		Description:        "public site",
		Enabled:            true,
		SPAFallbackEnabled: true,
		SPAFallbackPath:    "/index.html",
		EntryFile:          "index.html",
	})
	require.NoError(t, err)
	assert.NotZero(t, project.ID)
	assert.Equal(t, "Marketing Site", project.Name)
	assert.Equal(t, "marketing-site", project.Slug)
	assert.Equal(t, "public site", project.Description)
	assert.True(t, project.Enabled)
	assert.True(t, project.SPAFallbackEnabled)
	assert.Equal(t, "/index.html", project.SPAFallbackPath)
	assert.Equal(t, "index.html", project.EntryFile)
	assert.Equal(t, int64(0), project.DeploymentCount)

	_, err = CreateProject(ctx, Input{
		Name: "Duplicate Slug",
		Slug: "marketing-site",
	})
	require.Error(t, err)
	assert.Equal(t, errPagesSlugExists, err.Error())
}

func TestCreateProjectRejectsUnsafeFallbackPath(t *testing.T) {
	cleanup := setupPagesTestDB(t)
	defer cleanup()
	ctx := context.Background()

	_, err := CreateProject(ctx, Input{
		Name:               "Unsafe Fallback",
		Slug:               "unsafe-fallback",
		Enabled:            true,
		SPAFallbackEnabled: true,
		SPAFallbackPath:    "/index.html; proxy_pass http://evil",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "回退路径")
}

func TestGetDeploymentPackagePathRequiresActiveConfigSnapshot(t *testing.T) {
	cleanup := setupPagesTestDB(t)
	defer cleanup()
	ctx := context.Background()

	project, err := CreateProject(ctx, Input{
		Name:    "Published Site",
		Slug:    "published-site",
		Enabled: true,
	})
	require.NoError(t, err)

	deployment, err := UploadDeployment(ctx, project.ID, testPagesMultipartFile(t, "site.zip", testPagesZip(t, map[string]string{
		"index.html": "ok",
	})), "root")
	require.NoError(t, err)

	_, err = ActivateDeployment(ctx, project.ID, deployment.ID)
	require.NoError(t, err)

	_, _, err = GetDeploymentPackagePath(ctx, deployment.ID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "激活配置")

	require.NoError(t, db.DB(ctx).Create(&model.ConfigVersion{
		Version:          "v2026-001",
		SnapshotJSON:     fmt.Sprintf(`{"routes":[{"upstream_type":"pages","pages_deployment":{"deployment_id":%d}}]}`, deployment.ID),
		MainConfig:       "",
		RenderedConfig:   "",
		SupportFilesJSON: "[]",
		Checksum:         "test-checksum",
		IsActive:         true,
		CreatedBy:        "test",
	}).Error)

	filePath, fileName, err := GetDeploymentPackagePath(ctx, deployment.ID)
	require.NoError(t, err)
	assert.NotEmpty(t, filePath)
	assert.Equal(t, "pages-deployment-"+strconv.FormatUint(uint64(deployment.ID), 10)+".zip", fileName)
}

func testPagesZip(t *testing.T, files map[string]string) []byte {
	t.Helper()

	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, content := range files {
		file, err := writer.Create(name)
		require.NoError(t, err)
		_, err = file.Write([]byte(content))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	return buffer.Bytes()
}

func testPagesMultipartFile(t *testing.T, fileName string, content []byte) *multipart.FileHeader {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("package", fileName)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest("POST", "/", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, req.ParseMultipartForm(int64(len(content))+1024))

	file, header, err := req.FormFile("package")
	require.NoError(t, err)
	file.Close()
	return header
}
