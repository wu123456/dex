package model

import "math/big"

type Pair struct {
	Address  string   `json:"address"`
	Token0   string   `json:"token0"`
	Token1   string   `json:"token1"`
	Reserve0 *big.Int `json:"reserve0"`
	Reserve1 *big.Int `json:"reserve1"`
}

type TokenInfo struct {
	Address  string `json:"address"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals uint8  `json:"decimals"`
}

type SwapQuote struct {
	AmountIn  string   `json:"amountIn"`
	AmountOut string   `json:"amountOut"`
	Path      []string `json:"path"`
}

type LiquidityInfo struct {
	PairAddress string `json:"pairAddress"`
	Liquidity   string `json:"liquidity"`
}
