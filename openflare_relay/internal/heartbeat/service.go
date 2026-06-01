package heartbeat

import (
	"context"
	"log/slog"
	"time"

	"openflare-relay/internal/config"
	"openflare-relay/internal/frps"
	"openflare-relay/internal/httpclient"
	"openflare/service"
)

type Service struct {
	client      *httpclient.Client
	frpsManager *frps.Manager
	config      *config.Config
}

func New(client *httpclient.Client, manager *frps.Manager, cfg *config.Config) *Service {
	return &Service{
		client:      client,
		frpsManager: manager,
		config:      cfg,
	}
}

func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(s.config.HeartbeatInterval.Duration())
	defer ticker.Stop()

	// initial heartbeat
	s.doHeartbeat(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.doHeartbeat(ctx)
		}
	}
}

func (s *Service) doHeartbeat(ctx context.Context) {
	slog.Debug("sending heartbeat")

	payload := service.RelayHeartbeatPayload{
		RelayVersion:   "0.1.0", // TODO dynamically inject build version
		FrpVersion:     s.frpsManager.GetVersion(),
		RelayStatus:    s.frpsManager.GetStatus(),
		FrpsConnCount:  0,
		FrpsProxyCount: 0,
	}

	resp, err := s.client.Heartbeat(ctx, payload)
	if err != nil {
		slog.Error("heartbeat failed", "error", err)
		return
	}
	slog.Debug("heartbeat succeeded")

	// Update configs if changed
	s.frpsManager.UpdateConfig(resp.RelayConfig)
}
