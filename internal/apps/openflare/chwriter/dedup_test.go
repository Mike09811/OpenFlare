// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package chwriter

import "testing"

func TestDedupSetMarkIfNew(t *testing.T) {
	t.Parallel()

	set := newDedupSet()
	if !set.markIfNew("node-a|1") {
		t.Fatal("markIfNew() = false, want true on first key")
	}
	if set.markIfNew("node-a|1") {
		t.Fatal("markIfNew() = true, want false on duplicate key")
	}
	if !set.markIfNew("node-b|1") {
		t.Fatal("markIfNew() = false, want true on different key")
	}
	if set.markIfNew("") {
		t.Fatal("markIfNew() = true, want false on empty key")
	}
}