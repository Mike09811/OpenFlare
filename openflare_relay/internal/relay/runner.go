package relay

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"openflare-relay/internal/config"
	"openflare-relay/internal/frps"
	"openflare-relay/internal/heartbeat"
	"openflare-relay/internal/httpclient"
	"openflare-relay/internal/state"
	"openflare-relay/internal/wsclient"
	"openflare/service"
)

type Runner struct {
	Config           *config.Config
	StateStore       *state.Store
	HeartbeatService *heartbeat.Service
	FrpsManager      *frps.Manager
	WebSocketService *wsclient.Client
	HttpClient       *httpclient.Client
}

func (r *Runner) Run(ctx context.Context) error {
	// Start heartbeat loop in background
	go r.HeartbeatService.Run(ctx)

	// WebSocket reconnection loop
	for {
		select {
		case <-ctx.Done():
			r.FrpsManager.Stop()
			return ctx.Err()
		default:
		}

		conn, err := r.WebSocketService.Connect(ctx)
		if err != nil {
			slog.Error("relay ws connect failed, will retry", "error", err)
			r.sleepContext(ctx, 5*time.Second)
			continue
		}

		r.handleConnection(ctx, conn)
		_ = conn.Close()
		slog.Info("relay ws connection closed, reconnecting...")
		r.sleepContext(ctx, 2*time.Second)
	}
}

func (r *Runner) handleConnection(ctx context.Context, conn *wsclient.Connection) {
	// Send pings at 2× heartbeat interval to keep the server-side read deadline
	// from expiring (server closes the WS if no data arrives within ~30 s).
	pingInterval := r.Config.HeartbeatInterval.Duration() * 2
	pingTicker := time.NewTicker(pingInterval)
	defer pingTicker.Stop()

	messages := make(chan service.WSMessage, 8)
	readDone := make(chan error, 1)
	go func() {
		for {
			msg, err := conn.Receive()
			if err != nil {
				readDone <- err
				return
			}
			select {
			case messages <- msg:
			case <-ctx.Done():
				readDone <- ctx.Err()
				return
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case err := <-readDone:
			slog.Error("relay ws receive failed", "error", err)
			return
		case <-pingTicker.C:
			if err := conn.SendPing(); err != nil {
				slog.Error("relay ws send ping failed", "error", err)
				return
			}
		case msg := <-messages:
			switch msg.Type {
			case "ping":
				_ = conn.SendPong()
			case "pong":
				slog.Debug("relay ws pong received")
			case "relay_config":
				payloadBytes, ok := msg.Payload.(json.RawMessage)
				if !ok {
					slog.Error("invalid relay_config payload type")
					continue
				}
				var cfg service.RelayConfig
				if err := json.Unmarshal(payloadBytes, &cfg); err != nil {
					slog.Error("failed to unmarshal relay_config", "error", err)
					continue
				}
				r.FrpsManager.UpdateConfig(&cfg)
			default:
				slog.Debug("ignored unknown ws message type", "type", msg.Type)
			}
		}
	}
}

func (r *Runner) sleepContext(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}
