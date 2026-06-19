// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package analytics

import (
	"context"
	"fmt"
	"time"
)

// DeleteAllNodeMetricSnapshots deletes all node metric snapshots.
func DeleteAllNodeMetricSnapshots(ctx context.Context) (int64, error) {
	tableName := nodeMetricSnapshotTableName()
	return deleteNodeObservabilityWithCount(ctx, "SELECT count() FROM "+tableName, nil, "ALTER TABLE "+tableName+" DELETE WHERE 1")
}

// DeleteNodeMetricSnapshotsBefore deletes metric snapshots captured before cutoff.
func DeleteNodeMetricSnapshotsBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tableName := nodeMetricSnapshotTableName()
	cutoff = cutoff.UTC()
	return deleteNodeObservabilityWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE captured_at < ?", tableName),
		[]any{cutoff},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE captured_at < ?", tableName),
		cutoff,
	)
}

// DeleteAllNodeRequestReports deletes all node request reports.
func DeleteAllNodeRequestReports(ctx context.Context) (int64, error) {
	tableName := nodeRequestReportTableName()
	return deleteNodeObservabilityWithCount(ctx, "SELECT count() FROM "+tableName, nil, "ALTER TABLE "+tableName+" DELETE WHERE 1")
}

// DeleteNodeRequestReportsBefore deletes request reports ending before cutoff.
func DeleteNodeRequestReportsBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tableName := nodeRequestReportTableName()
	cutoff = cutoff.UTC()
	return deleteNodeObservabilityWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE window_ended_at < ?", tableName),
		[]any{cutoff},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE window_ended_at < ?", tableName),
		cutoff,
	)
}

// DeleteAllNodeObsOpenresty deletes all OpenResty observations.
func DeleteAllNodeObsOpenresty(ctx context.Context) (int64, error) {
	tableName := nodeObsOpenrestyTableName()
	return deleteNodeObservabilityWithCount(ctx, "SELECT count() FROM "+tableName, nil, "ALTER TABLE "+tableName+" DELETE WHERE 1")
}

// DeleteNodeObsOpenrestyBefore deletes OpenResty observations captured before cutoff.
func DeleteNodeObsOpenrestyBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tableName := nodeObsOpenrestyTableName()
	cutoff = cutoff.UTC()
	return deleteNodeObservabilityWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE captured_at < ?", tableName),
		[]any{cutoff},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE captured_at < ?", tableName),
		cutoff,
	)
}

// DeleteAllNodeObsFrps deletes all FRPS observations.
func DeleteAllNodeObsFrps(ctx context.Context) (int64, error) {
	tableName := nodeObsFrpsTableName()
	return deleteNodeObservabilityWithCount(ctx, "SELECT count() FROM "+tableName, nil, "ALTER TABLE "+tableName+" DELETE WHERE 1")
}

// DeleteNodeObsFrpsBefore deletes FRPS observations captured before cutoff.
func DeleteNodeObsFrpsBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tableName := nodeObsFrpsTableName()
	cutoff = cutoff.UTC()
	return deleteNodeObservabilityWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE captured_at < ?", tableName),
		[]any{cutoff},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE captured_at < ?", tableName),
		cutoff,
	)
}

// DeleteAllNodeObsFrpc deletes all FRPC observations.
func DeleteAllNodeObsFrpc(ctx context.Context) (int64, error) {
	tableName := nodeObsFrpcTableName()
	return deleteNodeObservabilityWithCount(ctx, "SELECT count() FROM "+tableName, nil, "ALTER TABLE "+tableName+" DELETE WHERE 1")
}

// DeleteNodeObsFrpcBefore deletes FRPC observations captured before cutoff.
func DeleteNodeObsFrpcBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tableName := nodeObsFrpcTableName()
	cutoff = cutoff.UTC()
	return deleteNodeObservabilityWithCount(
		ctx,
		fmt.Sprintf("SELECT count() FROM %s WHERE captured_at < ?", tableName),
		[]any{cutoff},
		fmt.Sprintf("ALTER TABLE %s DELETE WHERE captured_at < ?", tableName),
		cutoff,
	)
}

func deleteNodeObservabilityWithCount(ctx context.Context, countSQL string, countArgs []any, deleteSQL string, deleteArgs ...any) (int64, error) {
	conn, err := observabilityConn()
	if err != nil {
		return 0, err
	}
	var count uint64
	if err := conn.QueryRow(ctx, countSQL, countArgs...).Scan(&count); err != nil {
		return 0, fmt.Errorf("count node observability rows for delete: %w", err)
	}
	if count == 0 {
		return 0, nil
	}
	if err := conn.Exec(ctx, deleteSQL, deleteArgs...); err != nil {
		return 0, fmt.Errorf("delete node observability rows: %w", err)
	}
	return safeInt64Count(count), nil
}
