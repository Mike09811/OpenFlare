package wsclient

import (
	"context"
	"time"

	pkgprotocol "github.com/Rain-kl/Wavelet/pkg/protocol"
	shared "github.com/Rain-kl/Wavelet/pkg/wsclient"
)

type WSMessage = shared.WSMessage
type MessageHandler = shared.MessageHandler

type Preset int

const (
	PresetAgent Preset = iota
	PresetRelay
	PresetFlared
)

type presetConfig struct {
	HeaderKey string
	WSPath    string
}

var presets = map[Preset]presetConfig{
	PresetAgent:  {HeaderKey: "X-Agent-Token", WSPath: "/api/v1/agent/ws"},
	PresetRelay:  {HeaderKey: "X-Agent-Token", WSPath: "/api/v1/relay/ws"},
	PresetFlared: {HeaderKey: "X-Tunnel-Token", WSPath: "/api/v1/tunnel/ws"},
}

func PresetHeaderKey(preset Preset) string {
	return presets[preset].HeaderKey
}

func PresetWSPath(preset Preset) string {
	return presets[preset].WSPath
}

type Client struct {
	sharedClient *shared.Client
}

func New(preset Preset, baseURL, token string, timeout time.Duration) *Client {
	cfg := presets[preset]
	return &Client{
		sharedClient: shared.New(shared.Config{
			BaseURL:   baseURL,
			Token:     token,
			Timeout:   timeout,
			HeaderKey: cfg.HeaderKey,
			WSPath:    cfg.WSPath,
		}),
	}
}

func (c *Client) SetToken(token string) {
	c.sharedClient.SetToken(token)
}

func (c *Client) URL() string {
	return c.sharedClient.URL()
}

type Connection struct {
	sharedConn *shared.Connection
}

func (c *Client) Connect(ctx context.Context) (*Connection, error) {
	conn, err := c.sharedClient.Connect(ctx)
	if err != nil {
		return nil, err
	}
	return &Connection{sharedConn: conn}, nil
}

type AgentConnection struct {
	Connection
}

func (c *Client) ConnectAgent(ctx context.Context) (*AgentConnection, error) {
	conn, err := c.Connect(ctx)
	if err != nil {
		return nil, err
	}
	return &AgentConnection{Connection: *conn}, nil
}

func (conn *Connection) URL() string {
	if conn == nil || conn.sharedConn == nil {
		return ""
	}
	return conn.sharedConn.URL
}

func (conn *Connection) SendPing() error {
	return conn.sharedConn.SendMessage(pkgprotocol.WSMessageTypePing, nil)
}

func (conn *Connection) SendPong() error {
	return conn.sharedConn.SendMessage(pkgprotocol.WSMessageTypePong, nil)
}

func (conn *Connection) SendMessage(msgType string, payload any) error {
	return conn.sharedConn.SendMessage(msgType, payload)
}

func (conn *Connection) Receive() (pkgprotocol.WSMessage, error) {
	var message pkgprotocol.WSMessage
	if err := conn.sharedConn.Receive(&message); err != nil {
		return message, err
	}
	return message, nil
}

func (conn *Connection) RunReceiveLoop(ctx context.Context, handler MessageHandler) error {
	return conn.sharedConn.RunReceiveLoop(ctx, handler)
}

func (conn *Connection) Close() error {
	if conn == nil || conn.sharedConn == nil {
		return nil
	}
	return conn.sharedConn.Close()
}

func (conn *AgentConnection) SendStatus(payload pkgprotocol.NodePayload) error {
	return conn.sharedConn.SendMessage(pkgprotocol.WSMessageTypeStatus, payload)
}