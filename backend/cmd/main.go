package main

import (
	"context"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/wolf/dex-backend/internal/api"
	"github.com/wolf/dex-backend/internal/blockchain"
	"github.com/wolf/dex-backend/internal/service"
	"github.com/wolf/dex-backend/internal/store"
	"github.com/wolf/dex-backend/internal/ws"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	rpcURL := getEnv("RPC_URL", "http://127.0.0.1:8545")
	listenAddr := getEnv("LISTEN_ADDR", ":8080")
	factoryAddr := getEnv("FACTORY_ADDRESS", "")
	dbURL := getEnv("DATABASE_URL", "")
	dbType := getEnv("DB_TYPE", "auto")

	initLogging()

	client, err := blockchain.NewClient(rpcURL)
	if err != nil {
		log.Fatalf("failed to connect blockchain: %v", err)
	}

	if factoryAddr != "" {
		client.SetFactory(parseAddress(factoryAddr))
	}

	var s store.Store
	if dbURL != "" {
		if dbType == "auto" {
			if strings.HasPrefix(dbURL, "mysql://") || strings.Contains(dbURL, "tcp(") || strings.Contains(dbURL, ":3306") {
				dbType = "mysql"
			} else {
				dbType = "postgres"
			}
		}

		db, err := openDB(dbType, dbURL)
		if err != nil {
			log.Fatalf("failed to connect %s: %v", dbType, err)
		}

		if err := runMigrations(db, dbType); err != nil {
			log.Fatalf("failed to run migrations: %v", err)
		}

		s = store.NewPGStore(db)
		log.Printf("using %s storage", dbType)
	} else {
		s = store.NewMemoryStore()
		log.Println("using in-memory storage")
	}

	if factoryAddr != "" {
		eventHandler := blockchain.NewEventHandler(client, s)
		ctx := context.Background()
		if err := eventHandler.WatchFactory(ctx); err != nil {
			log.Printf("warning: could not start event watcher: %v", err)
		}

		vaultAddrStr := getEnv("VAULT_ADDRESS", "")
		if vaultAddrStr != "" {
			eventHandler.SetOrderStore(s)
			eventHandler.SetVaultAddr(common.HexToAddress(vaultAddrStr))
			if err := eventHandler.WatchVault(ctx); err != nil {
				log.Printf("warning: could not start vault event watcher: %v", err)
			}
		}
	}

	hub := ws.NewHub()
	go hub.Run()

	svc := service.NewWithHub(client, s, hub)
	handler := api.NewHandler(svc, hub)

	log.Printf("DEX backend starting on %s", listenAddr)
	if err := handler.Serve(listenAddr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func openDB(dbType, dbURL string) (*gorm.DB, error) {
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{SlowThreshold: time.Second, LogLevel: logger.Warn},
	)

	switch dbType {
	case "mysql":
		dsn := dbURL
		if strings.HasPrefix(dsn, "mysql://") {
			dsn = strings.TrimPrefix(dsn, "mysql://")
		}
		return gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: gormLogger})
	default:
		return gorm.Open(postgres.Open(dbURL), &gorm.Config{Logger: gormLogger})
	}
}

func runMigrations(db *gorm.DB, dbType string) error {
	var filename string
	switch dbType {
	case "mysql":
		filename = "001_init_mysql.sql"
	default:
		filename = "001_init_postgres.sql"
	}

	migrationPath := filepath.Join("migrations", filename)
	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		log.Printf("migration file %s not found, skipping: %v", migrationPath, err)
		return nil
	}

	sqlStr := string(sqlBytes)
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	statements := splitSQL(sqlStr)
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := sqlDB.Exec(stmt); err != nil {
			if !isAlreadyExistsError(err) {
				return err
			}
			log.Printf("migration skip (already exists): %v", err)
		}
	}

	log.Printf("migrations applied from %s", filename)
	return nil
}

func splitSQL(sql string) []string {
	return strings.Split(sql, ";")
}

func isAlreadyExistsError(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "already exists") ||
		strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "table") && strings.Contains(msg, "exists")
}

func initLogging() {
	logDir := "logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Printf("warning: cannot create logs dir: %v", err)
		return
	}

	logFile, err := os.OpenFile(
		filepath.Join(logDir, "backend.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if err != nil {
		log.Printf("warning: cannot open log file: %v", err)
		return
	}

	multiWriter := io.MultiWriter(os.Stdout, logFile)
	log.SetOutput(multiWriter)
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
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
