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
	client    *Client
	store     eventPairStore
	pairTopic common.Hash
	mintTopic common.Hash
	burnTopic common.Hash
	swapTopic common.Hash
	syncTopic common.Hash
}

type eventPairStore interface {
	SavePair(address string, pair *store.Pair)
	GetPair(address string) (*store.Pair, bool)
}

func NewEventHandler(client *Client, store eventPairStore) *EventHandler {
	return &EventHandler{
		client:    client,
		store:     store,
		pairTopic: crypto.Keccak256Hash([]byte("PairCreated(address,address,address,uint256)")),
		mintTopic: crypto.Keccak256Hash([]byte("Mint(address,uint256,uint256)")),
		burnTopic: crypto.Keccak256Hash([]byte("Burn(address,uint256,uint256,address)")),
		swapTopic: crypto.Keccak256Hash([]byte("Swap(address,uint256,uint256,uint256,uint256,address)")),
		syncTopic: crypto.Keccak256Hash([]byte("Sync(uint112,uint112)")),
	}
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
