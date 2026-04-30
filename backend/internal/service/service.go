package service

import (
	"context"
	"math/big"
	"sort"

	"github.com/ethereum/go-ethereum/common"
	"github.com/wolf/dex-backend/internal/blockchain"
	"github.com/wolf/dex-backend/internal/store"
	"github.com/wolf/dex-backend/internal/ws"
)

type Service struct {
	client *blockchain.Client
	store  store.Store
	hub    *ws.Hub
}

func New(client *blockchain.Client, s store.Store) *Service {
	return &Service{
		client: client,
		store:  s,
	}
}

func NewWithHub(client *blockchain.Client, s store.Store, hub *ws.Hub) *Service {
	return &Service{
		client: client,
		store:  s,
		hub:    hub,
	}
}

func (s *Service) GetPairs(ctx context.Context) []*store.Pair {
	return s.store.ListPairs()
}

func (s *Service) GetPair(ctx context.Context, address string) (*store.Pair, error) {
	pair, ok := s.store.GetPair(address)
	if !ok {
		pairAddr := common.HexToAddress(address)
		return s.fetchPairInfo(ctx, pairAddr)
	}
	return pair, nil
}

func (s *Service) GetTokens(ctx context.Context) []*store.Token {
	return s.store.ListTokens()
}

func (s *Service) GetToken(ctx context.Context, address string) (*store.Token, error) {
	token, ok := s.store.GetToken(address)
	if !ok {
		tokenAddr := common.HexToAddress(address)
		return s.fetchTokenInfo(ctx, tokenAddr)
	}
	return token, nil
}

func (s *Service) GetQuote(ctx context.Context, amountIn string, path []string) (*SwapQuoteResult, error) {
	amount, ok := new(big.Int).SetString(amountIn, 10)
	if !ok {
		return nil, ErrInvalidAmount
	}

	amounts := []*big.Int{amount}
	for i := 0; i < len(path)-1; i++ {
		pairAddr, err := s.client.GetPair(ctx, common.HexToAddress(path[i]), common.HexToAddress(path[i+1]))
		if err != nil {
			return nil, err
		}
		reserveIn, reserveOut, err := s.getSortedReserves(ctx, pairAddr, path[i], path[i+1])
		if err != nil {
			return nil, err
		}
		out := getAmountOut(amounts[i], reserveIn, reserveOut)
		amounts = append(amounts, out)
	}

	return &SwapQuoteResult{
		AmountIn:  amounts[0].String(),
		AmountOut: amounts[len(amounts)-1].String(),
		Path:      path,
	}, nil
}

func (s *Service) GetSwaps(ctx context.Context, pair string, limit int) []*store.SwapEvent {
	if limit <= 0 {
		limit = 50
	}
	return s.store.ListSwaps(pair, limit)
}

func (s *Service) GetKlines(ctx context.Context, pair string, from, to int64) []*store.Kline {
	return s.store.ListKlines(pair, from, to)
}

func (s *Service) CreateOrder(order *store.LimitOrder) error {
	order.Status = "open"
	if err := s.store.SaveOrder(order); err != nil {
		return err
	}
	s.broadcastOrderBook(order.TokenIn, order.TokenOut)
	return nil
}

func (s *Service) GetOrders(status string) []*store.LimitOrder {
	return s.store.ListOrders(status)
}

func (s *Service) GetOrder(id uint) (*store.LimitOrder, error) {
	order, ok := s.store.GetOrder(id)
	if !ok {
		return nil, ErrNotFound
	}
	return order, nil
}

func (s *Service) CancelOrder(id uint) error {
	order, ok := s.store.GetOrder(id)
	if !ok {
		return ErrNotFound
	}
	if err := s.store.UpdateOrderStatus(id, "cancelled", ""); err != nil {
		return err
	}
	s.broadcastOrderBook(order.TokenIn, order.TokenOut)
	return nil
}

func (s *Service) FillOrder(id uint, txHash string) error {
	order, ok := s.store.GetOrder(id)
	if !ok {
		return ErrNotFound
	}
	if err := s.store.UpdateOrderStatus(id, "filled", txHash); err != nil {
		return err
	}
	s.broadcastOrderBook(order.TokenIn, order.TokenOut)
	return nil
}

func (s *Service) GetOrderBook(tokenIn, tokenOut string) *ws.OrderBookUpdate {
	orders := s.store.ListOrdersByPair(tokenIn, tokenOut, "open")
	bidMap := make(map[string]*ws.PriceLevel)
	askMap := make(map[string]*ws.PriceLevel)

	reverseOrders := s.store.ListOrdersByPair(tokenOut, tokenIn, "open")

	for _, o := range orders {
		amountIn, _ := new(big.Int).SetString(o.AmountIn, 10)
		amountOut, _ := new(big.Int).SetString(o.AmountOut, 10)
		if amountIn == nil || amountOut == nil || amountOut.Sign() == 0 {
			continue
		}
		priceRat := new(big.Rat).SetFrac(amountOut, amountIn)
		priceStr := priceRat.FloatString(8)
		if _, ok := bidMap[priceStr]; !ok {
			bidMap[priceStr] = &ws.PriceLevel{Price: priceStr, Amount: "0"}
		}
		existing, _ := new(big.Rat).SetString(bidMap[priceStr].Amount)
		bidMap[priceStr].Amount = new(big.Rat).Add(
			existing,
			new(big.Rat).SetFrac(amountIn, big.NewInt(1)),
		).FloatString(6)
		bidMap[priceStr].Count++
	}

	for _, o := range reverseOrders {
		amountIn, _ := new(big.Int).SetString(o.AmountIn, 10)
		amountOut, _ := new(big.Int).SetString(o.AmountOut, 10)
		if amountIn == nil || amountOut == nil || amountIn.Sign() == 0 {
			continue
		}
		priceRat := new(big.Rat).SetFrac(amountIn, amountOut)
		priceStr := priceRat.FloatString(8)
		if _, ok := askMap[priceStr]; !ok {
			askMap[priceStr] = &ws.PriceLevel{Price: priceStr, Amount: "0"}
		}
		existing, _ := new(big.Rat).SetString(askMap[priceStr].Amount)
		askMap[priceStr].Amount = new(big.Rat).Add(
			existing,
			new(big.Rat).SetFrac(amountOut, big.NewInt(1)),
		).FloatString(6)
		askMap[priceStr].Count++
	}

	bids := make([]*ws.PriceLevel, 0, len(bidMap))
	for _, v := range bidMap {
		bids = append(bids, v)
	}
	sort.Slice(bids, func(i, j int) bool {
		bi, _ := new(big.Rat).SetString(bids[i].Price)
		bj, _ := new(big.Rat).SetString(bids[j].Price)
		return bi.Cmp(bj) > 0
	})

	asks := make([]*ws.PriceLevel, 0, len(askMap))
	for _, v := range askMap {
		asks = append(asks, v)
	}
	sort.Slice(asks, func(i, j int) bool {
		ai, _ := new(big.Rat).SetString(asks[i].Price)
		aj, _ := new(big.Rat).SetString(asks[j].Price)
		return ai.Cmp(aj) < 0
	})

	bidSlice := make([]ws.PriceLevel, len(bids))
	for i, b := range bids {
		bidSlice[i] = *b
	}
	askSlice := make([]ws.PriceLevel, len(asks))
	for i, a := range asks {
		askSlice[i] = *a
	}

	return &ws.OrderBookUpdate{
		TokenIn:  tokenIn,
		TokenOut: tokenOut,
		Bids:     bidSlice,
		Asks:     askSlice,
	}
}

func (s *Service) broadcastOrderBook(tokenIn, tokenOut string) {
	if s.hub == nil {
		return
	}
	update := s.GetOrderBook(tokenIn, tokenOut)
	s.hub.BroadcastOrderBook(update)
}

func (s *Service) CreateProposal(proposal *store.GovernanceProposal) error {
	proposal.Status = "pending"
	proposal.ForVotes = "0"
	proposal.AgainstVotes = "0"
	return s.store.SaveProposal(proposal)
}

func (s *Service) GetProposals(status string) []*store.GovernanceProposal {
	return s.store.ListProposals(status)
}

func (s *Service) GetProposal(id uint) (*store.GovernanceProposal, error) {
	proposal, ok := s.store.GetProposal(id)
	if !ok {
		return nil, ErrNotFound
	}
	return proposal, nil
}

func (s *Service) Vote(proposalID uint, support bool, weight string) error {
	proposal, ok := s.store.GetProposal(proposalID)
	if !ok {
		return ErrNotFound
	}
	if support {
		v, _ := new(big.Int).SetString(proposal.ForVotes, 10)
		w, _ := new(big.Int).SetString(weight, 10)
		proposal.ForVotes = new(big.Int).Add(v, w).String()
	} else {
		v, _ := new(big.Int).SetString(proposal.AgainstVotes, 10)
		w, _ := new(big.Int).SetString(weight, 10)
		proposal.AgainstVotes = new(big.Int).Add(v, w).String()
	}
	return s.store.UpdateProposal(proposal)
}

func (s *Service) SyncPairs(ctx context.Context) error {
	length, err := s.client.AllPairsLength(ctx)
	if err != nil {
		return err
	}
	for i := uint64(0); i < length; i++ {
		pairAddr := common.BigToAddress(new(big.Int).SetUint64(i))
		_, ok := s.store.GetPair(pairAddr.Hex())
		if !ok {
			_, err := s.fetchPairInfo(ctx, pairAddr)
			if err != nil {
				continue
			}
		}
	}
	return nil
}

func (s *Service) fetchPairInfo(ctx context.Context, pairAddr common.Address) (*store.Pair, error) {
	token0, token1, err := s.client.GetToken0Token1(ctx, pairAddr)
	if err != nil {
		return nil, err
	}
	reserve0, reserve1, err := s.client.GetReserves(ctx, pairAddr)
	if err != nil {
		return nil, err
	}
	pair := &store.Pair{
		Address:  pairAddr.Hex(),
		Token0:   token0.Hex(),
		Token1:   token1.Hex(),
		Reserve0: store.BigToIntString(reserve0),
		Reserve1: store.BigToIntString(reserve1),
	}
	s.store.SavePair(pairAddr.Hex(), pair)
	return pair, nil
}

func (s *Service) fetchTokenInfo(ctx context.Context, tokenAddr common.Address) (*store.Token, error) {
	name, symbol, decimals, err := s.client.GetTokenInfo(ctx, tokenAddr)
	if err != nil {
		return nil, err
	}
	token := &store.Token{
		Address:  tokenAddr.Hex(),
		Name:     name,
		Symbol:   symbol,
		Decimals: decimals,
	}
	s.store.SaveToken(tokenAddr.Hex(), token)
	return token, nil
}

func (s *Service) getSortedReserves(ctx context.Context, pairAddr common.Address, tokenA, tokenB string) (*big.Int, *big.Int, error) {
	reserve0, reserve1, err := s.client.GetReserves(ctx, pairAddr)
	if err != nil {
		return nil, nil, err
	}
	token0, _, err := s.client.GetToken0Token1(ctx, pairAddr)
	if err != nil {
		return nil, nil, err
	}
	if common.HexToAddress(tokenA) == token0 {
		return reserve0, reserve1, nil
	}
	return reserve1, reserve0, nil
}

func getAmountOut(amountIn, reserveIn, reserveOut *big.Int) *big.Int {
	amountInWithFee := new(big.Int).Mul(amountIn, big.NewInt(997))
	numerator := new(big.Int).Mul(amountInWithFee, reserveOut)
	denominator := new(big.Int).Add(
		new(big.Int).Mul(reserveIn, big.NewInt(1000)),
		amountInWithFee,
	)
	return new(big.Int).Div(numerator, denominator)
}

type SwapQuoteResult struct {
	AmountIn  string   `json:"amountIn"`
	AmountOut string   `json:"amountOut"`
	Path      []string `json:"path"`
}
