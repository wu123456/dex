package blockchain

import (
	"context"
	"fmt"
	"log"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/wolf/dex-backend/internal/store"
)

type EventHandler struct {
	client              *Client
	store               eventPairStore
	orderStore          eventOrderStore
	pairTopic           common.Hash
	mintTopic           common.Hash
	burnTopic           common.Hash
	swapTopic           common.Hash
	syncTopic           common.Hash
	orderCreatedTopic   common.Hash
	orderFilledTopic    common.Hash
	orderCancelledTopic common.Hash
	vaultAddr           common.Address
}

type eventPairStore interface {
	SavePair(address string, pair *store.Pair)
	GetPair(address string) (*store.Pair, bool)
}

type eventOrderStore interface {
	SaveOrder(order *store.LimitOrder) error
	UpdateOrderStatus(id uint, status, filledTx string) error
	GetOrder(id uint) (*store.LimitOrder, bool)
}

func NewEventHandler(client *Client, store eventPairStore) *EventHandler {
	return &EventHandler{
		client:              client,
		store:               store,
		pairTopic:           crypto.Keccak256Hash([]byte("PairCreated(address,address,address,uint256)")),
		mintTopic:           crypto.Keccak256Hash([]byte("Mint(address,uint256,uint256)")),
		burnTopic:           crypto.Keccak256Hash([]byte("Burn(address,uint256,uint256,address)")),
		swapTopic:           crypto.Keccak256Hash([]byte("Swap(address,uint256,uint256,uint256,uint256,address)")),
		syncTopic:           crypto.Keccak256Hash([]byte("Sync(uint112,uint112)")),
		orderCreatedTopic:   crypto.Keccak256Hash([]byte("OrderCreated(uint256,address,address,address,uint256,uint256)")),
		orderFilledTopic:    crypto.Keccak256Hash([]byte("OrderFilled(uint256,address,uint256)")),
		orderCancelledTopic: crypto.Keccak256Hash([]byte("OrderCancelled(uint256)")),
	}
}

func (h *EventHandler) SetOrderStore(os eventOrderStore) {
	h.orderStore = os
}

func (h *EventHandler) SetVaultAddr(addr common.Address) {
	h.vaultAddr = addr
}

func (h *EventHandler) WatchFactory(ctx context.Context) error {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{h.client.factoryAddr},
		Topics:    [][]common.Hash{{h.pairTopic}},
	}

	logs := make(chan types.Log)
	sub, err := h.client.ethClient.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("subscribe factory events: %w", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-sub.Err():
				log.Printf("factory subscription error: %v", err)
				return
			case vLog := <-logs:
				h.handlePairCreated(vLog)
			}
		}
	}()

	log.Println("watching factory events for new pairs...")
	return nil
}

func (h *EventHandler) WatchPair(ctx context.Context, pairAddr common.Address) error {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{pairAddr},
		Topics:    [][]common.Hash{{h.syncTopic, h.mintTopic, h.burnTopic, h.swapTopic}},
	}

	logs := make(chan types.Log)
	sub, err := h.client.ethClient.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("subscribe pair events: %w", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-sub.Err():
				log.Printf("pair %s subscription error: %v", pairAddr.Hex(), err)
				return
			case vLog := <-logs:
				h.handlePairEvent(vLog)
			}
		}
	}()

	return nil
}

func (h *EventHandler) handlePairCreated(vLog types.Log) {
	if len(vLog.Topics) < 3 {
		return
	}

	token0 := common.BytesToAddress(vLog.Topics[1].Bytes())
	token1 := common.BytesToAddress(vLog.Topics[2].Bytes())

	pairAddr := common.BytesToAddress(vLog.Data[12:32])

	log.Printf("new pair created: %s (%s / %s)", pairAddr.Hex(), token0.Hex(), token1.Hex())

	reserve0, reserve1, err := h.client.GetReserves(context.Background(), pairAddr)
	if err != nil {
		reserve0 = big.NewInt(0)
		reserve1 = big.NewInt(0)
	}

	pair := &store.Pair{
		Address:  pairAddr.Hex(),
		Token0:   token0.Hex(),
		Token1:   token1.Hex(),
		Reserve0: store.BigToIntString(reserve0),
		Reserve1: store.BigToIntString(reserve1),
	}

	h.store.SavePair(pairAddr.Hex(), pair)
}

func (h *EventHandler) handlePairEvent(vLog types.Log) {
	if len(vLog.Topics) == 0 {
		return
	}

	pairAddr := vLog.Address
	topic := vLog.Topics[0]

	switch topic {
	case h.syncTopic:
		h.handleSync(pairAddr, vLog)
	case h.mintTopic:
		log.Printf("mint event on pair %s", pairAddr.Hex())
		h.refreshReserves(pairAddr)
	case h.burnTopic:
		log.Printf("burn event on pair %s", pairAddr.Hex())
		h.refreshReserves(pairAddr)
	case h.swapTopic:
		log.Printf("swap event on pair %s", pairAddr.Hex())
		h.refreshReserves(pairAddr)
	}
}

func (h *EventHandler) handleSync(pairAddr common.Address, vLog types.Log) {
	if len(vLog.Data) < 64 {
		return
	}

	reserve0 := new(big.Int).SetBytes(vLog.Data[:32])
	reserve1 := new(big.Int).SetBytes(vLog.Data[32:64])

	token0, token1, err := h.client.GetToken0Token1(context.Background(), pairAddr)
	if err != nil {
		return
	}

	pair := &store.Pair{
		Address:  pairAddr.Hex(),
		Token0:   token0.Hex(),
		Token1:   token1.Hex(),
		Reserve0: store.BigToIntString(reserve0),
		Reserve1: store.BigToIntString(reserve1),
	}

	h.store.SavePair(pairAddr.Hex(), pair)
	log.Printf("synced pair %s: reserve0=%s reserve1=%s", pairAddr.Hex(), reserve0.String(), reserve1.String())
}

func (h *EventHandler) refreshReserves(pairAddr common.Address) {
	reserve0, reserve1, err := h.client.GetReserves(context.Background(), pairAddr)
	if err != nil {
		return
	}

	existing, ok := h.store.GetPair(pairAddr.Hex())
	if !ok {
		token0, token1, _ := h.client.GetToken0Token1(context.Background(), pairAddr)
		existing = &store.Pair{
			Address: pairAddr.Hex(),
			Token0:  token0.Hex(),
			Token1:  token1.Hex(),
		}
	}

	existing.Reserve0 = store.BigToIntString(reserve0)
	existing.Reserve1 = store.BigToIntString(reserve1)
	h.store.SavePair(pairAddr.Hex(), existing)
}

func (h *EventHandler) WatchVault(ctx context.Context) error {
	if h.vaultAddr == (common.Address{}) || h.orderStore == nil {
		return fmt.Errorf("vault address or order store not configured")
	}

	query := ethereum.FilterQuery{
		Addresses: []common.Address{h.vaultAddr},
		Topics:    [][]common.Hash{{h.orderCreatedTopic, h.orderFilledTopic, h.orderCancelledTopic}},
	}

	logs := make(chan types.Log)
	sub, err := h.client.ethClient.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("subscribe vault events: %w", err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-sub.Err():
				log.Printf("vault subscription error: %v", err)
				return
			case vLog := <-logs:
				h.handleVaultEvent(vLog)
			}
		}
	}()

	log.Println("watching vault events for limit orders...")
	return nil
}

func (h *EventHandler) handleVaultEvent(vLog types.Log) {
	if len(vLog.Topics) == 0 {
		return
	}

	topic := vLog.Topics[0]

	switch topic {
	case h.orderCreatedTopic:
		h.handleOrderCreated(vLog)
	case h.orderFilledTopic:
		h.handleOrderFilled(vLog)
	case h.orderCancelledTopic:
		h.handleOrderCancelled(vLog)
	}
}

func (h *EventHandler) handleOrderCreated(vLog types.Log) {
	if len(vLog.Topics) < 3 || len(vLog.Data) < 96 {
		return
	}

	orderId := new(big.Int).SetBytes(vLog.Topics[1].Bytes())
	maker := common.BytesToAddress(vLog.Topics[2].Bytes())
	tokenIn := common.BytesToAddress(vLog.Data[12:32])
	tokenOut := common.BytesToAddress(vLog.Data[44:64])
	amountIn := new(big.Int).SetBytes(vLog.Data[64:96])
	amountOut := new(big.Int).SetBytes(vLog.Data[96:128])

	order := &store.LimitOrder{
		Maker:     maker.Hex(),
		TokenIn:   tokenIn.Hex(),
		TokenOut:  tokenOut.Hex(),
		AmountIn:  amountIn.String(),
		AmountOut: amountOut.String(),
		Status:    "open",
	}

	if h.orderStore != nil {
		if err := h.orderStore.SaveOrder(order); err != nil {
			log.Printf("failed to save order from chain event: %v", err)
		}
	}

	log.Printf("order created on chain: id=%s maker=%s", orderId.String(), maker.Hex())
}

func (h *EventHandler) handleOrderFilled(vLog types.Log) {
	if len(vLog.Topics) < 2 {
		return
	}

	orderId := new(big.Int).SetBytes(vLog.Topics[1].Bytes())
	id := uint(orderId.Uint64())

	if h.orderStore != nil {
		_ = h.orderStore.UpdateOrderStatus(id, "filled", vLog.TxHash.Hex())
	}

	log.Printf("order filled on chain: id=%d", id)
}

func (h *EventHandler) handleOrderCancelled(vLog types.Log) {
	if len(vLog.Topics) < 2 {
		return
	}

	orderId := new(big.Int).SetBytes(vLog.Topics[1].Bytes())
	id := uint(orderId.Uint64())

	if h.orderStore != nil {
		_ = h.orderStore.UpdateOrderStatus(id, "cancelled", "")
	}

	log.Printf("order cancelled on chain: id=%d", id)
}
