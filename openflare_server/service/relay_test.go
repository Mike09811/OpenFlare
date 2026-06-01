package service

import (
	"errors"
	"openflare/model"
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestHeartbeatRelayPersistsRuntimeAndObservability(t *testing.T) {
	setupServiceTestDB(t)

	node := &model.Node{
		NodeID:      "node-relay-observe",
		Name:        "relay-1",
		IP:          "",
		AccessToken: "relay-token",
		Status:      NodeStatusPending,
		NodeType:    "tunnel_relay",
		RelayStatus: "unknown",
		Version:     "",
	}
	if err := node.Insert(); err != nil {
		t.Fatalf("failed to seed relay node: %v", err)
	}

	now := time.Now().UTC()
	_, err := HeartbeatRelay(node, RelayHeartbeatPayload{
		Version:        "v0.1.0",
		ExtVersion:     "0.61.0",
		RelayStatus:    "healthy",
		FrpsConnCount:  7,
		FrpsProxyCount: 3,
		Name:           "relay-runtime",
		IP:             "203.0.113.9",
		Profile: &AgentNodeSystemProfile{
			Hostname:       "relay-runtime",
			OSName:         "Ubuntu",
			OSVersion:      "24.04",
			Architecture:   "amd64",
			CPUCores:       4,
			ReportedAtUnix: now.Unix(),
		},
		Snapshot: &AgentNodeMetricSnapshot{
			CapturedAtUnix:  now.Unix(),
			CPUUsagePercent: 12.5,
			NetworkRxBytes:  1024,
			NetworkTxBytes:  2048,
		},
		HealthEvents: []AgentNodeHealthEvent{},
	})
	if err != nil {
		t.Fatalf("HeartbeatRelay failed: %v", err)
	}

	updated, err := model.GetNodeByNodeID(node.NodeID)
	if err != nil {
		t.Fatalf("failed to reload node: %v", err)
	}
	if updated.Status != NodeStatusOnline || updated.RelayStatus != "healthy" {
		t.Fatalf("unexpected relay status: %+v", updated)
	}
	if updated.IP != "203.0.113.9" {
		t.Fatalf("expected relay IP to be updated, got %q", updated.IP)
	}
	if updated.Version != "v0.1.0" || updated.ExtVersion != "0.61.0" {
		t.Fatalf("expected relay versions to be updated, got relay=%q frp=%q", updated.Version, updated.ExtVersion)
	}

	profile, err := model.GetNodeSystemProfile(node.NodeID)
	if err != nil {
		t.Fatalf("expected relay system profile: %v", err)
	}
	if profile.Hostname != "relay-runtime" || profile.OSName != "Ubuntu" {
		t.Fatalf("unexpected relay profile: %+v", profile)
	}

	snapshots, err := model.ListNodeMetricSnapshots(node.NodeID, now.Add(-time.Minute), 10)
	if err != nil {
		t.Fatalf("failed to list relay snapshots: %v", err)
	}
	if len(snapshots) != 1 || snapshots[0].CPUUsagePercent != 12.5 {
		t.Fatalf("unexpected relay snapshots: %+v", snapshots)
	}

	observability, err := GetNodeObservability(updated.ID, NodeObservabilityQuery{Hours: 1, Limit: 10})
	if err != nil {
		t.Fatalf("GetNodeObservability failed: %v", err)
	}
	if observability.RelayDashboard == nil {
		t.Fatal("expected relay dashboard snapshot")
	}
	if observability.RelayDashboard.TotalConnections != 7 || observability.RelayDashboard.TotalProxies != 3 {
		t.Fatalf("unexpected relay dashboard: %+v", observability.RelayDashboard)
	}
}

func TestHeartbeatFlaredRejectsWrongNodeType(t *testing.T) {
	setupServiceTestDB(t)

	node := &model.Node{
		NodeID:      "node-not-tunnel-client",
		Name:        "edge",
		IP:          "10.0.0.1",
		AccessToken: "edge-token",
		Status:      NodeStatusPending,
		NodeType:    "edge_node",
		Version:     "v0.0.0",
	}
	if err := node.Insert(); err != nil {
		t.Fatalf("failed to seed edge node: %v", err)
	}

	_, err := HeartbeatFlared(node, FlaredHeartbeatPayload{
		ClientVersion:  "v0.1.0",
		FrpVersion:     "0.61.0",
		TunnelStatus:   "running",
		CurrentVersion: "v1",
	})
	if err == nil {
		t.Fatal("expected error for non-tunnel_client node type")
	}
}

func TestHeartbeatFlaredRejectsNilNode(t *testing.T) {
	if _, err := HeartbeatFlared(nil, FlaredHeartbeatPayload{}); err == nil {
		t.Fatal("expected error when node is nil")
	}
}

func TestHeartbeatFlaredPersistsRuntime(t *testing.T) {
	setupServiceTestDB(t)

	node := &model.Node{
		NodeID:      "node-flared-1",
		Name:        "flared-1",
		IP:          "",
		AccessToken: "tunnel-token-abc",
		Status:      NodeStatusPending,
		NodeType:    "tunnel_client",
		Version:     "",
	}
	if err := node.Insert(); err != nil {
		t.Fatalf("failed to seed flared node: %v", err)
	}

	resp, err := HeartbeatFlared(node, FlaredHeartbeatPayload{
		ClientVersion: "  v0.2.0  ",
		FrpVersion:    "  0.61.1  ",
		TunnelStatus:  "  RUNNING ",
		ConnectedRelays: []FlaredConnectedRelay{
			{RelayNodeID: "  node-relay-1 ", Status: "  HEALTHY ", ProxyCount: 3},
			{RelayNodeID: "", Status: "running"},
			{RelayNodeID: "node-relay-2", Status: ""},
		},
		CurrentVersion:  "v1",
		CurrentChecksum: "checksum-1",
	})
	if err != nil {
		t.Fatalf("HeartbeatFlared failed: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.TunnelSettings == nil {
		t.Fatal("expected tunnel_settings in response")
	}
	if resp.TunnelSettings.HeartbeatInterval == 0 {
		t.Fatal("expected heartbeat interval to be set in tunnel_settings")
	}

	updated, err := model.GetNodeByNodeID(node.NodeID)
	if err != nil {
		t.Fatalf("failed to reload flared node: %v", err)
	}
	if updated.Status != NodeStatusOnline {
		t.Fatalf("expected flared node to be online, got %q", updated.Status)
	}
	if updated.Version != "v0.2.0" {
		t.Fatalf("expected client_version to be trimmed and stored, got %q", updated.Version)
	}
	if updated.ExtVersion != "0.61.1" {
		t.Fatalf("expected frp_version to be trimmed and stored, got %q", updated.ExtVersion)
	}
	if updated.CurrentVersion != "v1" {
		t.Fatalf("expected current_version to be stored, got %q", updated.CurrentVersion)
	}
	if updated.LastSeenAt.IsZero() {
		t.Fatal("expected last_seen_at to be updated")
	}
}

func TestHeartbeatFlaredTrimsAndFiltersRelays(t *testing.T) {
	normalized := normalizeFlaredHeartbeatPayload(FlaredHeartbeatPayload{
		TunnelStatus: "  UNHEALTHY ",
		ConnectedRelays: []FlaredConnectedRelay{
			{RelayNodeID: "  node-a ", Status: "  OK "},
			{RelayNodeID: "", Status: "running"},
		},
	})
	if normalized.TunnelStatus != "unhealthy" {
		t.Fatalf("expected tunnel_status to be lower-cased, got %q", normalized.TunnelStatus)
	}
	if len(normalized.ConnectedRelays) != 1 {
		t.Fatalf("expected empty relay_node_id to be dropped, got %+v", normalized.ConnectedRelays)
	}
	relay := normalized.ConnectedRelays[0]
	if relay.RelayNodeID != "node-a" {
		t.Fatalf("expected relay_node_id to be trimmed, got %q", relay.RelayNodeID)
	}
	if relay.Status != "ok" {
		t.Fatalf("expected status to be lower-cased, got %q", relay.Status)
	}
}

func TestHeartbeatFlaredEmitsHealthEventOnUnhealthy(t *testing.T) {
	setupServiceTestDB(t)

	node := &model.Node{
		NodeID:      "node-flared-unhealthy",
		Name:        "flared-unhealthy",
		IP:          "",
		AccessToken: "tunnel-token-unhealthy",
		Status:      NodeStatusPending,
		NodeType:    "tunnel_client",
		Version:     "",
	}
	if err := node.Insert(); err != nil {
		t.Fatalf("failed to seed flared node: %v", err)
	}

	if _, err := HeartbeatFlared(node, FlaredHeartbeatPayload{
		ClientVersion:   "v0.2.0",
		FrpVersion:      "0.61.0",
		TunnelStatus:    "unhealthy",
		CurrentVersion:  "v1",
		CurrentChecksum: "checksum-1",
	}); err != nil {
		t.Fatalf("HeartbeatFlared failed: %v", err)
	}

	events, err := model.ListNodeHealthEvents(node.NodeID, false, 20)
	if err != nil {
		t.Fatalf("ListNodeHealthEvents failed: %v", err)
	}
	if len(events) == 0 {
		t.Fatal("expected unhealthy heartbeat to emit a node health event")
	}
	foundUnhealthy := false
	for _, event := range events {
		if event.EventType == "flared_runtime_unhealthy" {
			foundUnhealthy = true
		}
	}
	if !foundUnhealthy {
		t.Fatalf("expected flared_runtime_unhealthy event in %+v", events)
	}
}

func TestHeartbeatFlaredEmitsEmptyConnectedRelays(t *testing.T) {
	normalized := normalizeFlaredHeartbeatPayload(FlaredHeartbeatPayload{})
	if normalized.ConnectedRelays == nil {
		t.Fatal("expected ConnectedRelays to be non-nil empty slice for nil input")
	}
	if len(normalized.ConnectedRelays) != 0 {
		t.Fatalf("expected empty ConnectedRelays, got %+v", normalized.ConnectedRelays)
	}
}

func TestGetFlaredTunnelConfigRequiresActiveVersion(t *testing.T) {
	setupServiceTestDB(t)

	node := &model.Node{
		NodeID:      "node-flared-noactive",
		Name:        "flared-noactive",
		IP:          "",
		AccessToken: "tunnel-token-na",
		Status:      NodeStatusPending,
		NodeType:    "tunnel_client",
		Version:     "",
	}
	if err := node.Insert(); err != nil {
		t.Fatalf("failed to seed flared node: %v", err)
	}

	_, err := GetFlaredTunnelConfig(node)
	if err == nil {
		t.Fatal("expected error when no active config version exists")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// We accept either wrapping the underlying error or surfacing a friendly message.
		// Just ensure we surface a clear failure instead of a nil result.
		t.Logf("GetFlaredTunnelConfig returned wrapped error: %v", err)
	}
}
