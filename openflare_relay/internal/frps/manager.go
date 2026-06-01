package frps

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"openflare/service"
)

type Manager struct {
	frpsPath   string
	dataDir    string
	configPath string

	mu           sync.RWMutex
	activeConfig *service.RelayConfig
	cmd          *exec.Cmd
	status       string
}

func NewManager(frpsPath string, dataDir string) *Manager {
	return &Manager{
		frpsPath:   frpsPath,
		dataDir:    dataDir,
		configPath: filepath.Join(dataDir, "frps.toml"),
		status:     "unhealthy",
	}
}

func (m *Manager) GetVersion() string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, m.frpsPath, "-v")
	out, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("failed to get frps version", "error", err)
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (m *Manager) GetStatus() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

func (m *Manager) UpdateConfig(cfg *service.RelayConfig) {
	if cfg == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if config changed
	if m.activeConfig != nil &&
		m.activeConfig.BindPort == cfg.BindPort &&
		m.activeConfig.VhostHTTPPort == cfg.VhostHTTPPort &&
		m.activeConfig.AuthToken == cfg.AuthToken {
		return // No change
	}

	m.activeConfig = cfg
	slog.Info("relay config updated, reloading frps")

	if err := m.renderConfig(cfg); err != nil {
		slog.Error("failed to render frps config", "error", err)
		m.status = "unhealthy"
		return
	}

	if err := m.restartProcess(); err != nil {
		slog.Error("failed to restart frps", "error", err)
		m.status = "unhealthy"
	} else {
		m.status = "healthy"
	}
}

func (m *Manager) renderConfig(cfg *service.RelayConfig) error {
	if err := os.MkdirAll(m.dataDir, 0755); err != nil {
		return err
	}
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("bindPort = %d\n", cfg.BindPort))
	if cfg.VhostHTTPPort > 0 {
		buf.WriteString(fmt.Sprintf("vhostHTTPPort = %d\n", cfg.VhostHTTPPort))
	}
	if cfg.AuthToken != "" {
		buf.WriteString("[auth]\n")
		buf.WriteString("method = \"token\"\n")
		buf.WriteString(fmt.Sprintf("token = \"%s\"\n", cfg.AuthToken))
	}

	return os.WriteFile(m.configPath, buf.Bytes(), 0644)
}

func (m *Manager) restartProcess() error {
	if m.cmd != nil && m.cmd.Process != nil {
		slog.Debug("stopping existing frps process")
		_ = m.cmd.Process.Kill()
		_ = m.cmd.Wait()
		m.cmd = nil
	}

	cmd := exec.Command(m.frpsPath, "-c", m.configPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return err
	}

	m.cmd = cmd

	// Start a goroutine to monitor process exit
	go func(c *exec.Cmd) {
		err := c.Wait()
		slog.Warn("frps process exited", "error", err)
		m.mu.Lock()
		if m.cmd == c {
			m.cmd = nil
			m.status = "unhealthy"
		}
		m.mu.Unlock()
	}(cmd)

	return nil
}

func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cmd != nil && m.cmd.Process != nil {
		_ = m.cmd.Process.Kill()
		_ = m.cmd.Wait()
		m.cmd = nil
	}
}
