// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package agent

import pkgprotocol "github.com/Rain-kl/Wavelet/pkg/protocol"

type NodePayload = pkgprotocol.NodePayload
type NodeSystemProfile = pkgprotocol.NodeSystemProfile
type NodeMetricSnapshot = pkgprotocol.NodeMetricSnapshot
type NodeOpenrestyObservation = pkgprotocol.NodeOpenrestyObservation
type NodeTrafficReport = pkgprotocol.NodeTrafficReport
type NodeAccessLog = pkgprotocol.NodeAccessLog
type BufferedObservabilityRecord = pkgprotocol.BufferedObservabilityRecord
type NodeHealthEvent = pkgprotocol.NodeHealthEvent
type ApplyLogPayload = pkgprotocol.ApplyLogPayload
type Settings = pkgprotocol.AgentSettings
type ActiveConfigMeta = pkgprotocol.ActiveConfigMeta
type SupportFile = pkgprotocol.SupportFile
type WAFIPGroup = pkgprotocol.WAFIPGroup
type WAFIPGroupSyncRequest = pkgprotocol.WAFIPGroupSyncRequest
type WAFIPGroupSyncResponse = pkgprotocol.WAFIPGroupSyncResponse

// Backward-compatible names used by server routers and handlers.
type WAFIPGroupSyncInput = WAFIPGroupSyncRequest
type WAFIPGroupSyncResult = WAFIPGroupSyncResponse