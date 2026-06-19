package wsclient

import (
	"context"
	"time"

	edgews "github.com/Rain-kl/Wavelet/internal/apps/edge/wsclient"
)

type WSMessage = edgews.WSMessage
type MessageHandler = edgews.MessageHandler
type Connection = edgews.Connection

type Client struct {
	inner *edgews.Client
}

func New(baseURL, token string, timeout time.Duration) *Client {
	return &Client{
		inner: edgews.New(edgews.PresetFlared, baseURL, token, timeout),
	}
}

func (c *Client) SetToken(token string) {
	c.inner.SetToken(token)
}

func (c *Client) Connect(ctx context.Context) (*Connection, error) {
	return c.inner.Connect(ctx)
}