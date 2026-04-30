package store

import (
	"gorm.io/gorm"
)

type PGStore struct {
	db *gorm.DB
}

func NewPGStore(db *gorm.DB) *PGStore {
	return &PGStore{db: db}
}

func (s *PGStore) SavePair(address string, pair *Pair) {
	var existing Pair
	result := s.db.Where("address = ?", address).First(&existing)
	if result.Error == gorm.ErrRecordNotFound {
		s.db.Create(pair)
	} else {
		s.db.Model(&existing).Updates(map[string]interface{}{
			"reserve0": pair.Reserve0,
			"reserve1": pair.Reserve1,
		})
	}
}

func (s *PGStore) GetPair(address string) (*Pair, bool) {
	var pair Pair
	result := s.db.Where("address = ?", address).First(&pair)
	if result.Error != nil {
		return nil, false
	}
	return &pair, true
}

func (s *PGStore) ListPairs() []*Pair {
	var pairs []*Pair
	s.db.Find(&pairs)
	return pairs
}

func (s *PGStore) SaveToken(address string, token *Token) {
	var existing Token
	result := s.db.Where("address = ?", address).First(&existing)
	if result.Error == gorm.ErrRecordNotFound {
		s.db.Create(token)
	}
}

func (s *PGStore) GetToken(address string) (*Token, bool) {
	var token Token
	result := s.db.Where("address = ?", address).First(&token)
	if result.Error != nil {
		return nil, false
	}
	return &token, true
}

func (s *PGStore) ListTokens() []*Token {
	var tokens []*Token
	s.db.Find(&tokens)
	return tokens
}

func (s *PGStore) SaveSwap(event *SwapEvent) {
	s.db.Create(event)
}

func (s *PGStore) ListSwaps(pair string, limit int) []*SwapEvent {
	var swaps []*SwapEvent
	q := s.db.Order("block_num desc")
	if pair != "" {
		q = q.Where("pair = ?", pair)
	}
	if limit > 0 {
		q = q.Limit(limit)
	}
	q.Find(&swaps)
	return swaps
}

func (s *PGStore) SaveKline(kline *Kline) {
	s.db.Create(kline)
}

func (s *PGStore) ListKlines(pair string, from, to int64) []*Kline {
	var klines []*Kline
	s.db.Where("pair = ? AND open_time >= ? AND open_time <= ?", pair, from, to).
		Order("open_time asc").
		Find(&klines)
	return klines
}

func (s *PGStore) SaveOrder(order *LimitOrder) error {
	return s.db.Create(order).Error
}

func (s *PGStore) GetOrder(id uint) (*LimitOrder, bool) {
	var order LimitOrder
	result := s.db.First(&order, id)
	if result.Error != nil {
		return nil, false
	}
	return &order, true
}

func (s *PGStore) ListOrders(status string) []*LimitOrder {
	var orders []*LimitOrder
	q := s.db.Order("created_at desc")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&orders)
	return orders
}

func (s *PGStore) ListOrdersByPair(tokenIn, tokenOut, status string) []*LimitOrder {
	var orders []*LimitOrder
	q := s.db.Order("created_at desc")
	if tokenIn != "" {
		q = q.Where("token_in = ?", tokenIn)
	}
	if tokenOut != "" {
		q = q.Where("token_out = ?", tokenOut)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&orders)
	return orders
}

func (s *PGStore) UpdateOrderStatus(id uint, status, filledTx string) error {
	return s.db.Model(&LimitOrder{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": status, "filled_tx": filledTx}).Error
}

func (s *PGStore) SaveProposal(proposal *GovernanceProposal) error {
	return s.db.Create(proposal).Error
}

func (s *PGStore) GetProposal(id uint) (*GovernanceProposal, bool) {
	var proposal GovernanceProposal
	result := s.db.First(&proposal, id)
	if result.Error != nil {
		return nil, false
	}
	return &proposal, true
}

func (s *PGStore) ListProposals(status string) []*GovernanceProposal {
	var proposals []*GovernanceProposal
	q := s.db.Order("created_at desc")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&proposals)
	return proposals
}

func (s *PGStore) UpdateProposal(proposal *GovernanceProposal) error {
	return s.db.Save(proposal).Error
}
