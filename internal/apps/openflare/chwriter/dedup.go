// Copyright 2026 Arctel.net
// SPDX-License-Identifier: Apache-2.0

package chwriter

import (
	"sync"
	"time"
)

const dedupTTL = 2 * time.Minute

type dedupSet struct {
	mu   sync.Mutex
	keys map[string]time.Time
}

func newDedupSet() *dedupSet {
	return &dedupSet{keys: make(map[string]time.Time)}
}

// markIfNew records key when it has not been seen within dedupTTL.
func (s *dedupSet) markIfNew(key string) bool {
	if key == "" {
		return false
	}

	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()

	for existing, expiresAt := range s.keys {
		if now.After(expiresAt) {
			delete(s.keys, existing)
		}
	}
	if expiresAt, exists := s.keys[key]; exists && now.Before(expiresAt) {
		return false
	}
	s.keys[key] = now.Add(dedupTTL)
	return true
}