package wsclient

import (
	"context"
	"time"

	"github.com/Rain-kl/Wavelet/internal/apps/agent/protocol"
	edgews "github.com/Rain-kl/Wavelet/internal/apps/edge/wsclient"
)

type WSMessage = edgews.WSMessage
type MessageHandler = edgews.MessageHandler
type Connection = edgews.AgentConnection

type Client struct {
	inner *edgews.Client
}

func New(baseURL, token string, timeout time.Duration) *Client {
	return &Client{
		inner: edgews.New(edgews.PresetAgent, baseURL, token, timeout),
	}
}

func (c *Client) SetToken(token string) {
	c.inner.SetToken(token)
}

func (c *Client) URL() string {
	return c.inner.URL()
}

func (c *Client) Connect(ctx context.Context) (protocol.WebSocketConnection, error) {
	return c.inner.ConnectAgent(ctx)
}