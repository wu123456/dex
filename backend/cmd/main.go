package main

import (
	"context"
	"log"
	"os"

	"github.com/wolf/dex-backend/internal/api"
	"github.com/wolf/dex-backend/internal/blockchain"
	"github.com/wolf/dex-backend/internal/service"
	"github.com/wolf/dex-backend/internal/store"
)

func main() {
	rpcURL := getEnv("RPC_URL", "http://127.0.0.1:8545")
	listenAddr := getEnv("LISTEN_ADDR", ":8080")
	factoryAddr := getEnv("FACTORY_ADDRESS", "")

	client, err := blockchain.NewClient(rpcURL)
	if err != nil {
		log.Fatalf("failed to connect blockchain: %v", err)
	}

	if factoryAddr != "" {
		client.SetFactory(parseAddress(factoryAddr))
	}

	memStore := store.NewMemoryStore()

	if factoryAddr != "" {
		eventHandler := blockchain.NewEventHandler(client, memStore)
		ctx := context.Background()
		if err := eventHandler.WatchFactory(ctx); err != nil {
			log.Printf("warning: could not start factory event watcher: %v", err)
		}
	}

	svc := service.New(client, memStore)
	handler := api.NewHandler(svc)

	log.Printf("DEX backend starting on %s", listenAddr)
	if err := handler.Serve(listenAddr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func parseAddress(s string) [20]byte {
	var addr [20]byte
	copy(addr[:], []byte(s))
	return addr
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
