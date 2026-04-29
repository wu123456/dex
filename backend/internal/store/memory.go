package store

import (
	"sync"

	"github.com/wolf/dex-backend/internal/model"
)

type MemoryStore struct {
	mu     sync.RWMutex
	pairs  map[string]*model.Pair
	tokens map[string]*model.TokenInfo
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		pairs:  make(map[string]*model.Pair),
		tokens: make(map[string]*model.TokenInfo),
	}
}

func (s *MemoryStore) SavePair(address string, pair *model.Pair) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pairs[address] = pair
}

func (s *MemoryStore) GetPair(address string) (*model.Pair, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.pairs[address]
	return p, ok
}

func (s *MemoryStore) ListPairs() []*model.Pair {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.Pair, 0, len(s.pairs))
	for _, p := range s.pairs {
		result = append(result, p)
	}
	return result
}

func (s *MemoryStore) SaveToken(address string, token *model.TokenInfo) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens[address] = token
}

func (s *MemoryStore) GetToken(address string) (*model.TokenInfo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tokens[address]
	return t, ok
}

func (s *MemoryStore) ListTokens() []*model.TokenInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.TokenInfo, 0, len(s.tokens))
	for _, t := range s.tokens {
		result = append(result, t)
	}
	return result
}
