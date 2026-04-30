package store

import (
	"sync"
)

type MemoryStore struct {
	mu        sync.RWMutex
	pairs     map[string]*Pair
	tokens    map[string]*Token
	swaps     []*SwapEvent
	klines    map[string][]*Kline
	orders    []*LimitOrder
	proposals []*GovernanceProposal
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		pairs:  make(map[string]*Pair),
		tokens: make(map[string]*Token),
		klines: make(map[string][]*Kline),
	}
}

func (s *MemoryStore) SavePair(address string, pair *Pair) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pairs[address] = pair
}

func (s *MemoryStore) GetPair(address string) (*Pair, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.pairs[address]
	return p, ok
}

func (s *MemoryStore) ListPairs() []*Pair {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Pair, 0, len(s.pairs))
	for _, p := range s.pairs {
		result = append(result, p)
	}
	return result
}

func (s *MemoryStore) SaveToken(address string, token *Token) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens[address] = token
}

func (s *MemoryStore) GetToken(address string) (*Token, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tokens[address]
	return t, ok
}

func (s *MemoryStore) ListTokens() []*Token {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Token, 0, len(s.tokens))
	for _, t := range s.tokens {
		result = append(result, t)
	}
	return result
}

func (s *MemoryStore) SaveSwap(event *SwapEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.swaps = append(s.swaps, event)
	if len(s.swaps) > 10000 {
		s.swaps = s.swaps[len(s.swaps)-5000:]
	}
}

func (s *MemoryStore) ListSwaps(pair string, limit int) []*SwapEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*SwapEvent
	for i := len(s.swaps) - 1; i >= 0 && len(result) < limit; i-- {
		if pair == "" || s.swaps[i].Pair == pair {
			result = append(result, s.swaps[i])
		}
	}
	return result
}

func (s *MemoryStore) SaveKline(kline *Kline) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.klines[kline.Pair] = append(s.klines[kline.Pair], kline)
}

func (s *MemoryStore) ListKlines(pair string, from, to int64) []*Kline {
	s.mu.RLock()
	defer s.mu.RUnlock()
	klines, ok := s.klines[pair]
	if !ok {
		return nil
	}
	var result []*Kline
	for _, k := range klines {
		if k.OpenTime >= from && k.OpenTime <= to {
			result = append(result, k)
		}
	}
	return result
}

func (s *MemoryStore) SaveOrder(order *LimitOrder) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	order.ID = uint(len(s.orders) + 1)
	s.orders = append(s.orders, order)
	return nil
}

func (s *MemoryStore) GetOrder(id uint) (*LimitOrder, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, o := range s.orders {
		if o.ID == id {
			return o, true
		}
	}
	return nil, false
}

func (s *MemoryStore) ListOrders(status string) []*LimitOrder {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*LimitOrder
	for _, o := range s.orders {
		if status == "" || o.Status == status {
			result = append(result, o)
		}
	}
	return result
}

func (s *MemoryStore) UpdateOrderStatus(id uint, status, filledTx string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, o := range s.orders {
		if o.ID == id {
			o.Status = status
			o.FilledTx = filledTx
			return nil
		}
	}
	return nil
}

func (s *MemoryStore) SaveProposal(proposal *GovernanceProposal) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	proposal.ID = uint(len(s.proposals) + 1)
	s.proposals = append(s.proposals, proposal)
	return nil
}

func (s *MemoryStore) GetProposal(id uint) (*GovernanceProposal, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.proposals {
		if p.ID == id {
			return p, true
		}
	}
	return nil, false
}

func (s *MemoryStore) ListProposals(status string) []*GovernanceProposal {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*GovernanceProposal
	for _, p := range s.proposals {
		if status == "" || p.Status == status {
			result = append(result, p)
		}
	}
	return result
}

func (s *MemoryStore) UpdateProposal(proposal *GovernanceProposal) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, p := range s.proposals {
		if p.ID == proposal.ID {
			s.proposals[i] = proposal
			return nil
		}
	}
	return nil
}
