// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package observability

import (
	"testing"
	"time"

	"github.com/Rain-kl/Wavelet/internal/model"
)

func TestBuildTrafficTrendPointsBucketsByHour(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 19, 17, 30, 0, 0, time.UTC)
	reports := []*model.OpenFlareRequestReport{
		{
			NodeID:          "node-a",
			WindowStartedAt: now.Add(-3 * time.Hour),
			WindowEndedAt:   now.Add(-3*time.Hour + time.Minute),
			RequestCount:    10,
			ErrorCount:      1,
		},
		{
			NodeID:          "node-a",
			WindowStartedAt: now.Add(-30 * time.Minute),
			WindowEndedAt:   now.Add(-29 * time.Minute),
			RequestCount:    6,
			ErrorCount:      0,
		},
	}

	points := BuildTrafficTrendPoints(now, reports)
	if len(points) != observabilityTrendBuckets {
		t.Fatalf("BuildTrafficTrendPoints() len = %d, want %d", len(points), observabilityTrendBuckets)
	}

	var totalRequests int64
	for _, point := range points {
		totalRequests += point.RequestCount
	}
	if totalRequests != 16 {
		t.Fatalf("total request_count = %d, want 16", totalRequests)
	}

	currentHour := points[len(points)-1]
	if currentHour.RequestCount != 6 {
		t.Fatalf("current hour request_count = %d, want 6", currentHour.RequestCount)
	}
	if currentHour.ErrorCount != 0 {
		t.Fatalf("current hour error_count = %d, want 0", currentHour.ErrorCount)
	}
}