// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package option

import (
	"encoding/json"
	"errors"
	"io"

	"github.com/Rain-kl/Wavelet/internal/apps/openflare/compat"
	"github.com/Rain-kl/Wavelet/internal/model"
	"github.com/gin-gonic/gin"
)

// RegisterRoutes mounts legacy OpenFlare option and public status routes.
func RegisterRoutes(apiGroup *gin.RouterGroup) {
	apiGroup.GET("/status", getStatusHandler)
	apiGroup.GET("/notice", getNoticeHandler)
	apiGroup.GET("/about", getAboutHandler)

	optionRoute := apiGroup.Group("/option")
	optionRoute.Use(compat.RootAuth())
	{
		optionRoute.GET("/", listOptionsHandler)
		optionRoute.POST("/update", updateOptionHandler)
		optionRoute.POST("/update-batch", updateOptionsBatchHandler)
		optionRoute.POST("/geoip/lookup", lookupGeoIPHandler)
		optionRoute.POST("/database/cleanup", cleanupDatabaseHandler)
	}

	uptimeKumaRoute := apiGroup.Group("/uptimekuma")
	uptimeKumaRoute.Use(compat.RootAuth())
	{
		uptimeKumaRoute.POST("/sync", syncUptimeKumaHandler)
	}
}

func getStatusHandler(c *gin.Context) {
	view, err := getStatus(c.Request.Context(), "/api")
	if err != nil {
		compat.Fail(c, errOptionInitFailed)
		return
	}
	compat.OK(c, view)
}

func getNoticeHandler(c *gin.Context) {
	notice, err := getNotice(c.Request.Context())
	if err != nil {
		compat.Fail(c, errOptionInitFailed)
		return
	}
	compat.OK(c, notice)
}

func getAboutHandler(c *gin.Context) {
	about, err := getAbout(c.Request.Context())
	if err != nil {
		compat.Fail(c, errOptionInitFailed)
		return
	}
	compat.OK(c, about)
}

func listOptionsHandler(c *gin.Context) {
	options, err := listOptions(c.Request.Context())
	if err != nil {
		compat.Fail(c, errOptionInitFailed)
		return
	}
	compat.OK(c, options)
}

func updateOptionHandler(c *gin.Context) {
	var option model.OpenFlareOption
	if !compat.BindJSON(c, &option) {
		return
	}
	if err := updateOption(c.Request.Context(), option); err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OKMessage(c, "")
}

func updateOptionsBatchHandler(c *gin.Context) {
	var payload optionBatchPayload
	if !compat.BindJSON(c, &payload) {
		return
	}
	if err := updateOptionsBatch(c.Request.Context(), payload); err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OKMessage(c, "")
}

func lookupGeoIPHandler(c *gin.Context) {
	var request geoIPLookupRequest
	if !compat.BindJSON(c, &request) {
		return
	}
	view, err := lookupGeoIP(c.Request.Context(), request.Provider, request.IP)
	if err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OK(c, view)
}

func cleanupDatabaseHandler(c *gin.Context) {
	var input databaseCleanupInput
	if err := bindOptionalJSON(c.Request.Body, &input); err != nil {
		compat.Fail(c, errInvalidParams)
		return
	}
	result, err := cleanupDatabaseObservability(c.Request.Context(), input)
	if err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OK(c, result)
}

func syncUptimeKumaHandler(c *gin.Context) {
	if err := syncUptimeKuma(c.Request.Context()); err != nil {
		compat.Fail(c, err.Error())
		return
	}
	compat.OKMessage(c, "同步成功")
}

func bindOptionalJSON(body io.Reader, target any) error {
	if err := json.NewDecoder(body).Decode(target); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}
