package main

import (
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

	client, err := blockchain.NewClient(rpcURL)
	if err != nil {
		log.Fatalf("failed to connect blockchain: %v", err)
	}

	store := store.NewMemoryStore()
	svc := service.New(client, store)
	handler := api.NewHandler(svc)

	log.Printf("DEX backend starting on %s", listenAddr)
	if err := handler.Serve(listenAddr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
