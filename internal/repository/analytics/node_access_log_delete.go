// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package analytics

import (
	"context"
	"fmt"
	"time"
)

// DeleteAllNodeAccessLogs deletes all node access logs.
func DeleteAllNodeAccessLogs(ctx context.Context) (int64, error) {
	tableName := nodeAccessLogTableName()
	return deleteNodeAccessLogsWithCount(ctx, "SELECT count() FROM "+tableName, nil, "ALTER TABLE "+tableName+" DELETE WHERE 1")
}

// DeleteNodeAccessLogsBefore deletes logs older than cutoff.
func DeleteNodeAccessLogsBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tableName := nodeAccessLogTableName()
	cutoff = cutoff.UTC()
	return deleteNodeAccessLogsWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE logged_at < ?", tableName),
		[]any{cutoff},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE logged_at < ?", tableName),
		cutoff,
	)
}

// DeleteNodeAccessLogsByNodeBefore deletes logs for a node older than cutoff.
func DeleteNodeAccessLogsByNodeBefore(ctx context.Context, nodeID string, before time.Time) (int64, error) {
	tableName := nodeAccessLogTableName()
	before = before.UTC()
	return deleteNodeAccessLogsWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE node_id = ? AND logged_at < ?", tableName),
		[]any{nodeID, before},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE node_id = ? AND logged_at < ?", tableName),
		nodeID, before,
	)
}

func deleteNodeAccessLogsWithCount(ctx context.Context, countSQL string, countArgs []any, deleteSQL string, deleteArgs ...any) (int64, error) {
	conn, err := nodeAccessLogConn()
	if err != nil {
		return 0, err
	}
	var count uint64
	if err := conn.QueryRow(ctx, countSQL, countArgs...).Scan(&count); err != nil {
		return 0, fmt.Errorf("count node access logs for delete: %w", err)
	}
	if count == 0 {
		return 0, nil
	}
	if err := conn.Exec(ctx, deleteSQL, deleteArgs...); err != nil {
		return 0, fmt.Errorf("delete node access logs: %w", err)
	}
	return safeInt64Count(count), nil
}