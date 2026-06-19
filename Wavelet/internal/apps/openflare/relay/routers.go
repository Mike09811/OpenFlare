// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package relay

import (
	"net/http"

	"github.com/Rain-kl/Wavelet/internal/apps/openflare/apiutil"
	ofws "github.com/Rain-kl/Wavelet/internal/apps/openflare/websocket"
	"github.com/Rain-kl/Wavelet/internal/common/response"
	"github.com/Rain-kl/Wavelet/internal/model"
	"github.com/gin-gonic/gin"
)

// PostHeartbeat handles POST /relay/heartbeat.
func PostHeartbeat(c *gin.Context) {
	var payload HeartbeatPayload
	if !apiutil.BindJSON(c, &payload) {
		return
	}
	payload.IP = resolveReportedNodeIP(payload.IP, c.Request.RemoteAddr)

	authNode, ok := c.Get(ctxRelayNodeKey)
	if !ok {
		response.AbortUnauthorized(c, errAgentTokenInvalid)
		return
	}
	node := authNode.(*model.OpenFlareNode)

	result, err := Heartbeat(c.Request.Context(), node, payload)
	if apiutil.AbortBadRequestOnError(c, err) {
		return
	}
	c.JSON(http.StatusOK, response.OK(result))
}

// GetWebSocket handles GET /relay/ws.
func GetWebSocket(c *gin.Context) {
	authNode, ok := c.Get(ctxRelayNodeKey)
	if !ok {
		response.AbortUnauthorized(c, errAgentTokenInvalid)
		return
	}
	node := authNode.(*model.OpenFlareNode)
	ofws.ServeRelay(c, node.NodeID)
}