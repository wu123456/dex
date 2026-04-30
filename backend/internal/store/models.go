package store

import (
	"math/big"
	"time"
)

type Pair struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Address   string    `gorm:"uniqueIndex;size:42;column:address" json:"address"`
	Token0    string    `gorm:"size:42;column:token0" json:"token0"`
	Token1    string    `gorm:"size:42;column:token1" json:"token1"`
	Reserve0  string    `gorm:"column:reserve0" json:"reserve0"`
	Reserve1  string    `gorm:"column:reserve1" json:"reserve1"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

type Token struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Address   string    `gorm:"uniqueIndex;size:42;column:address" json:"address"`
	Name      string    `gorm:"column:name" json:"name"`
	Symbol    string    `gorm:"column:symbol" json:"symbol"`
	Decimals  uint8     `gorm:"column:decimals" json:"decimals"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
}

type SwapEvent struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Pair       string    `gorm:"index;size:42;column:pair" json:"pair"`
	Sender     string    `gorm:"size:42;column:sender" json:"sender"`
	Amount0In  string    `gorm:"column:amount0_in" json:"amount0In"`
	Amount1In  string    `gorm:"column:amount1_in" json:"amount1In"`
	Amount0Out string    `gorm:"column:amount0_out" json:"amount0Out"`
	Amount1Out string    `gorm:"column:amount1_out" json:"amount1Out"`
	ToAddr     string    `gorm:"size:42;column:to_addr" json:"to"`
	BlockNum   uint64    `gorm:"index;column:block_num" json:"blockNum"`
	TxHash     string    `gorm:"size:66;column:tx_hash" json:"txHash"`
	LogIndex   uint      `gorm:"column:log_index" json:"logIndex"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
}

type Kline struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Pair      string    `gorm:"index;size:42;column:pair" json:"pair"`
	OpenTime  int64     `gorm:"index;column:open_time" json:"openTime"`
	Open      string    `gorm:"column:open" json:"open"`
	High      string    `gorm:"column:high" json:"high"`
	Low       string    `gorm:"column:low" json:"low"`
	Close     string    `gorm:"column:close" json:"close"`
	Volume    string    `gorm:"column:volume" json:"volume"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
}

type LimitOrder struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Maker     string    `gorm:"size:42;column:maker" json:"maker"`
	TokenIn   string    `gorm:"size:42;column:token_in" json:"tokenIn"`
	TokenOut  string    `gorm:"size:42;column:token_out" json:"tokenOut"`
	AmountIn  string    `gorm:"column:amount_in" json:"amountIn"`
	AmountOut string    `gorm:"column:amount_out" json:"amountOut"`
	Status    string    `gorm:"index;size:20;column:status" json:"status"`
	Signature string    `gorm:"column:signature" json:"signature"`
	Deadline  int64     `gorm:"column:deadline" json:"deadline"`
	FilledTx  string    `gorm:"size:66;column:filled_tx" json:"filledTx"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

type GovernanceProposal struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Proposer     string    `gorm:"size:42;column:proposer" json:"proposer"`
	Title        string    `gorm:"column:title" json:"title"`
	Description  string    `gorm:"column:description" json:"description"`
	Status       string    `gorm:"index;size:20;column:status" json:"status"`
	ForVotes     string    `gorm:"column:for_votes" json:"forVotes"`
	AgainstVotes string    `gorm:"column:against_votes" json:"againstVotes"`
	StartTime    int64     `gorm:"column:start_time" json:"startTime"`
	EndTime      int64     `gorm:"column:end_time" json:"endTime"`
	ExecutedTx   string    `gorm:"size:66;column:executed_tx" json:"executedTx"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

type Store interface {
	PairStore
	TokenStore
	SwapStore
	KlineStore
	OrderStore
	GovernanceStore
}

type PairStore interface {
	SavePair(address string, pair *Pair)
	GetPair(address string) (*Pair, bool)
	ListPairs() []*Pair
}

type TokenStore interface {
	SaveToken(address string, token *Token)
	GetToken(address string) (*Token, bool)
	ListTokens() []*Token
}

type SwapStore interface {
	SaveSwap(event *SwapEvent)
	ListSwaps(pair string, limit int) []*SwapEvent
}

type KlineStore interface {
	SaveKline(kline *Kline)
	ListKlines(pair string, from, to int64) []*Kline
}

type OrderStore interface {
	SaveOrder(order *LimitOrder) error
	GetOrder(id uint) (*LimitOrder, bool)
	ListOrders(status string) []*LimitOrder
	ListOrdersByPair(tokenIn, tokenOut, status string) []*LimitOrder
	UpdateOrderStatus(id uint, status, filledTx string) error
}

type GovernanceStore interface {
	SaveProposal(proposal *GovernanceProposal) error
	GetProposal(id uint) (*GovernanceProposal, bool)
	ListProposals(status string) []*GovernanceProposal
	UpdateProposal(proposal *GovernanceProposal) error
}

func BigToIntString(v *big.Int) string {
	if v == nil {
		return "0"
	}
	return v.String()
}

func IntStringToBig(s string) *big.Int {
	v, _ := new(big.Int).SetString(s, 10)
	if v == nil {
		return big.NewInt(0)
	}
	return v
}

func (Pair) TableName() string               { return "pairs" }
func (Token) TableName() string              { return "tokens" }
func (SwapEvent) TableName() string          { return "swap_events" }
func (Kline) TableName() string              { return "klines" }
func (LimitOrder) TableName() string         { return "limit_orders" }
func (GovernanceProposal) TableName() string { return "governance_proposals" }
