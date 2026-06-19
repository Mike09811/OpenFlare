// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package flared

import (
	"net/http"

	"github.com/Rain-kl/Wavelet/internal/apps/openflare/apiutil"
	ofws "github.com/Rain-kl/Wavelet/internal/apps/openflare/websocket"
	"github.com/Rain-kl/Wavelet/internal/common/response"
	"github.com/Rain-kl/Wavelet/internal/model"
	"github.com/gin-gonic/gin"
)

// PostHeartbeat handles POST /tunnel/heartbeat.
func PostHeartbeat(c *gin.Context) {
	var payload HeartbeatPayload
	if !apiutil.BindJSON(c, &payload) {
		return
	}

	authNode, ok := c.Get(ctxFlaredNodeKey)
	if !ok {
		response.AbortUnauthorized(c, errTunnelTokenInvalid)
		return
	}
	node := authNode.(*model.OpenFlareNode)

	result, err := Heartbeat(c.Request.Context(), node, payload)
	if apiutil.AbortBadRequestOnError(c, err) {
		return
	}
	c.JSON(http.StatusOK, response.OK(result))
}

// GetActiveConfig handles GET /tunnel/config/active.
func GetActiveConfig(c *gin.Context) {
	authNode, ok := c.Get(ctxFlaredNodeKey)
	if !ok {
		response.AbortUnauthorized(c, errTunnelTokenInvalid)
		return
	}
	node := authNode.(*model.OpenFlareNode)

	config, err := GetTunnelConfig(c.Request.Context(), node)
	if apiutil.AbortBadRequestOnError(c, err) {
		return
	}
	c.JSON(http.StatusOK, response.OK(config))
}

// PostApplyLog handles POST /tunnel/apply-log.
func PostApplyLog(c *gin.Context) {
	var payload ApplyLogPayload
	if !apiutil.BindJSON(c, &payload) {
		return
	}
	if authNode, ok := c.Get(ctxFlaredNodeKey); ok {
		payload.NodeID = authNode.(*model.OpenFlareNode).NodeID
	}

	log, err := ReportApplyLog(c.Request.Context(), payload)
	if apiutil.AbortBadRequestOnError(c, err) {
		return
	}
	c.JSON(http.StatusOK, response.OK(log))
}

// GetWebSocket handles GET /tunnel/ws.
func GetWebSocket(c *gin.Context) {
	authNode, ok := c.Get(ctxFlaredNodeKey)
	if !ok {
		response.AbortUnauthorized(c, errTunnelTokenInvalid)
		return
	}
	node := authNode.(*model.OpenFlareNode)
	ofws.ServeFlared(c, node.NodeID)
}