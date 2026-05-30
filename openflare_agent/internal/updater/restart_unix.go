//go:build !windows

package updater

import (
	"fmt"
	"log/slog"
	"os"
	"syscall"
)

func replaceAndRestart(execPath string, tmpPath string) error {
	backupPath := execPath + ".bak"
	err := os.Remove(backupPath)
	if err != nil {
		slog.Error("remove backup binary failed", "path", backupPath, "error", err)
		return err
	}
	if err := os.Rename(execPath, backupPath); err != nil {
		err := os.Remove(tmpPath)
		if err != nil {
			slog.Error("remove tmp binary failed", "path", tmpPath, "error", err)
			return err
		}
		return fmt.Errorf("backup current binary: %w", err)
	}
	if err := os.Rename(tmpPath, execPath); err != nil {
		err := os.Rename(backupPath, execPath)
		if err != nil {
			slog.Error("restore backup binary failed", "path", backupPath, "error", err)
			return err
		}
		return fmt.Errorf("replace binary: %w", err)
	}
	err = os.Remove(backupPath)
	if err != nil {
		slog.Error("remove backup binary failed", "path", backupPath, "error", err)
		return err
	}
	if err := syscall.Exec(execPath, os.Args, os.Environ()); err != nil {
		return fmt.Errorf("exec restart: %w", err)
	}
	return fmt.Errorf("unreachable after exec")
}
