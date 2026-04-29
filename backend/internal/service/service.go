package service

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/wolf/dex-backend/internal/blockchain"
	"github.com/wolf/dex-backend/internal/model"
	"github.com/wolf/dex-backend/internal/store"
)

type Service struct {
	client *blockchain.Client
	store  *store.MemoryStore
}

func New(client *blockchain.Client, store *store.MemoryStore) *Service {
	return &Service{
		client: client,
		store:  store,
	}
}

func (s *Service) GetPairs(ctx context.Context) ([]*model.Pair, error) {
	return s.store.ListPairs(), nil
}

func (s *Service) GetPair(ctx context.Context, address string) (*model.Pair, error) {
	pair, ok := s.store.GetPair(address)
	if !ok {
		pairAddr := common.HexToAddress(address)
		return s.fetchPairInfo(ctx, pairAddr)
	}
	return pair, nil
}

func (s *Service) GetTokens(ctx context.Context) ([]*model.TokenInfo, error) {
	return s.store.ListTokens(), nil
}

func (s *Service) GetToken(ctx context.Context, address string) (*model.TokenInfo, error) {
	token, ok := s.store.GetToken(address)
	if !ok {
		tokenAddr := common.HexToAddress(address)
		return s.fetchTokenInfo(ctx, tokenAddr)
	}
	return token, nil
}

func (s *Service) GetQuote(ctx context.Context, amountIn string, path []string) (*model.SwapQuote, error) {
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

	return &model.SwapQuote{
		AmountIn:  amounts[0].String(),
		AmountOut: amounts[len(amounts)-1].String(),
		Path:      path,
	}, nil
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

func (s *Service) fetchPairInfo(ctx context.Context, pairAddr common.Address) (*model.Pair, error) {
	token0, token1, err := s.client.GetToken0Token1(ctx, pairAddr)
	if err != nil {
		return nil, err
	}

	reserve0, reserve1, err := s.client.GetReserves(ctx, pairAddr)
	if err != nil {
		return nil, err
	}

	pair := &model.Pair{
		Address:  pairAddr.Hex(),
		Token0:   token0.Hex(),
		Token1:   token1.Hex(),
		Reserve0: reserve0,
		Reserve1: reserve1,
	}

	s.store.SavePair(pairAddr.Hex(), pair)
	return pair, nil
}

func (s *Service) fetchTokenInfo(ctx context.Context, tokenAddr common.Address) (*model.TokenInfo, error) {
	name, symbol, decimals, err := s.client.GetTokenInfo(ctx, tokenAddr)
	if err != nil {
		return nil, err
	}

	token := &model.TokenInfo{
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
