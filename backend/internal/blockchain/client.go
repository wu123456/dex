package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

type Client struct {
	ethClient   *ethclient.Client
	factoryAddr common.Address
	routerAddr  common.Address
	wethAddr    common.Address
	factoryABI  abi.ABI
	pairABI     abi.ABI
	erc20ABI    abi.ABI
}

func NewClient(rpcURL string) (*Client, error) {
	ec, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}

	factoryABI, err := abi.JSON(strings.NewReader(FactoryABI))
	if err != nil {
		return nil, fmt.Errorf("parse factory abi: %w", err)
	}

	pairABI, err := abi.JSON(strings.NewReader(PairABI))
	if err != nil {
		return nil, fmt.Errorf("parse pair abi: %w", err)
	}

	erc20ABI, err := abi.JSON(strings.NewReader(ERC20ABI))
	if err != nil {
		return nil, fmt.Errorf("parse erc20 abi: %w", err)
	}

	return &Client{
		ethClient:  ec,
		factoryABI: factoryABI,
		pairABI:    pairABI,
		erc20ABI:   erc20ABI,
	}, nil
}

func (c *Client) SetFactory(addr common.Address) {
	c.factoryAddr = addr
}

func (c *Client) SetRouter(addr common.Address) {
	c.routerAddr = addr
}

func (c *Client) SetWETH(addr common.Address) {
	c.wethAddr = addr
}

func (c *Client) GetPair(ctx context.Context, tokenA, tokenB common.Address) (common.Address, error) {
	data, err := c.factoryABI.Pack("getPair", tokenA, tokenB)
	if err != nil {
		return common.Address{}, fmt.Errorf("pack getPair: %w", err)
	}

	result, err := c.callContract(ctx, c.factoryAddr, data)
	if err != nil {
		return common.Address{}, fmt.Errorf("call getPair: %w", err)
	}

	out, err := c.factoryABI.Methods["getPair"].Outputs.Unpack(result)
	if err != nil {
		return common.Address{}, fmt.Errorf("unpack getPair: %w", err)
	}

	if len(out) == 0 {
		return common.Address{}, fmt.Errorf("no pair found")
	}

	addr, ok := out[0].(common.Address)
	if !ok {
		return common.Address{}, fmt.Errorf("unexpected type")
	}

	return addr, nil
}

func (c *Client) GetReserves(ctx context.Context, pairAddr common.Address) (reserve0, reserve1 *big.Int, err error) {
	data, err := c.pairABI.Pack("getReserves")
	if err != nil {
		return nil, nil, fmt.Errorf("pack getReserves: %w", err)
	}

	result, err := c.callContract(ctx, pairAddr, data)
	if err != nil {
		return nil, nil, fmt.Errorf("call getReserves: %w", err)
	}

	out, err := c.pairABI.Methods["getReserves"].Outputs.Unpack(result)
	if err != nil {
		return nil, nil, fmt.Errorf("unpack getReserves: %w", err)
	}

	if len(out) < 2 {
		return nil, nil, fmt.Errorf("unexpected reserves output length")
	}

	reserve0, _ = out[0].(*big.Int)
	reserve1, _ = out[1].(*big.Int)

	return reserve0, reserve1, nil
}

func (c *Client) GetTokenInfo(ctx context.Context, tokenAddr common.Address) (name, symbol string, decimals uint8, err error) {
	nameData, _ := c.erc20ABI.Pack("name")
	nameResult, err := c.callContract(ctx, tokenAddr, nameData)
	if err == nil {
		out, _ := c.erc20ABI.Methods["name"].Outputs.Unpack(nameResult)
		if len(out) > 0 {
			name, _ = out[0].(string)
		}
	}

	symbolData, _ := c.erc20ABI.Pack("symbol")
	symbolResult, err := c.callContract(ctx, tokenAddr, symbolData)
	if err == nil {
		out, _ := c.erc20ABI.Methods["symbol"].Outputs.Unpack(symbolResult)
		if len(out) > 0 {
			symbol, _ = out[0].(string)
		}
	}

	decimalsData, _ := c.erc20ABI.Pack("decimals")
	decimalsResult, err := c.callContract(ctx, tokenAddr, decimalsData)
	if err == nil {
		out, _ := c.erc20ABI.Methods["decimals"].Outputs.Unpack(decimalsResult)
		if len(out) > 0 {
			d, ok := out[0].(uint8)
			if ok {
				decimals = d
			}
		}
	}

	return name, symbol, decimals, nil
}

func (c *Client) GetToken0Token1(ctx context.Context, pairAddr common.Address) (token0, token1 common.Address, err error) {
	token0Data, _ := c.pairABI.Pack("token0")
	token0Result, err := c.callContract(ctx, pairAddr, token0Data)
	if err != nil {
		return common.Address{}, common.Address{}, err
	}
	out, _ := c.pairABI.Methods["token0"].Outputs.Unpack(token0Result)
	if len(out) > 0 {
		token0, _ = out[0].(common.Address)
	}

	token1Data, _ := c.pairABI.Pack("token1")
	token1Result, err := c.callContract(ctx, pairAddr, token1Data)
	if err != nil {
		return common.Address{}, common.Address{}, err
	}
	out, _ = c.pairABI.Methods["token1"].Outputs.Unpack(token1Result)
	if len(out) > 0 {
		token1, _ = out[0].(common.Address)
	}

	return token0, token1, nil
}

func (c *Client) AllPairsLength(ctx context.Context) (uint64, error) {
	data, err := c.factoryABI.Pack("allPairsLength")
	if err != nil {
		return 0, err
	}

	result, err := c.callContract(ctx, c.factoryAddr, data)
	if err != nil {
		return 0, err
	}

	out, err := c.factoryABI.Methods["allPairsLength"].Outputs.Unpack(result)
	if err != nil {
		return 0, err
	}

	if len(out) == 0 {
		return 0, nil
	}

	length, ok := out[0].(*big.Int)
	if !ok {
		return 0, fmt.Errorf("unexpected type")
	}

	return length.Uint64(), nil
}

func (c *Client) callContract(ctx context.Context, to common.Address, data []byte) ([]byte, error) {
	msg := ethereumCallMsg{
		To:   &to,
		Data: data,
	}
	var result string
	err := c.ethClient.Client().CallContext(ctx, &result, "eth_call", msg, "latest")
	if err != nil {
		return nil, err
	}

	return common.FromHex(result), nil
}

type ethereumCallMsg struct {
	From common.Address  `json:"from"`
	To   *common.Address `json:"to"`
	Data []byte          `json:"data"`
}
