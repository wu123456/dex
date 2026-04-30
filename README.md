<div align="center">

# 🏦 DEX Protocol

**A Production-Grade Decentralized Exchange Built from Scratch**

Full-stack AMM DEX featuring constant-product market making, limit order books with on-chain settlement, governance, liquidity mining, and real-time WebSocket-powered depth visualization.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://docs.soliditylang.org/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Architecture](#-system-architecture) · [Features](#-features) · [Quick Start](#-quick-start) · [API Reference](#-api-reference) · [Design Decisions](#-design-decisions)

</div>

---

## Why This Project

This isn't a tutorial DEX. It's a **complete, vertically-integrated DeFi protocol** designed to demonstrate production-level engineering across the entire stack — from EVM smart contracts to real-time WebSocket infrastructure to a modern React frontend.

**Key engineering decisions that matter in production:**

- **No `address(0)` mint** — OpenZeppelin v5 forbids it; MINIMUM_LIQUIDITY is minted to the pair contract itself, matching real-world Uniswap V2 deployments
- **No GORM AutoMigrate** — Raw SQL migrations only; schema changes are explicit, reviewable, and never surprise you in production
- **No foreign keys** — High-write blockchain event ingestion paths avoid FK contention; referential integrity enforced at the application layer
- **Three-mode storage** — In-memory (dev), MySQL (production), PostgreSQL (alternative), switched by a single env var
- **WebSocket order book** — Not just a REST polling UI; real-time bid/ask depth with on-chain event-driven updates
- **BigInt-safe** — All token amounts stored as decimal strings, zero floating-point anywhere in the pipeline

---

## ✨ Features

| Category | Feature | Detail |
|----------|---------|--------|
| **Core AMM** | Token Swap | ERC20 ↔ ERC20 with 0.3% fee, constant-product `x·y=k` |
| | ETH Wrapper | Native ETH ↔ ERC20 via WETH gateway |
| | Multi-hop Routing | A→B→C path optimization through intermediate pairs |
| | Slippage Protection | Configurable minimum output + transaction deadline |
| **Liquidity** | Add / Remove | Deposit paired tokens, receive LP shares; burn to withdraw |
| | LP Token | ERC20-compliant liquidity provider token with `permit` support |
| **Limit Orders** | Off-chain Orderbook | REST API + WebSocket for real-time depth aggregation |
| | On-chain Settlement | `LimitOrderVault` holds deposited tokens, fills atomically |
| | Event Sync | Backend listens to `OrderCreated/Filled/Cancelled` on-chain |
| **Governance** | Proposals | Create → Vote → Execute lifecycle with token-weighted voting |
| **Liquidity Mining** | Multi-pool Staking | Stake LP tokens, earn rewards proportional to pool weight |
| **Real-time Data** | WebSocket Push | Order book depth updates broadcast to all connected clients |
| | K-line / OHLCV | Historical candlestick data via REST API |
| | On-chain Event Listener | Factory `PairCreated`, Pair `Swap/Mint/Burn/Sync` indexed in real-time |
| **Infrastructure** | Multi-database | MySQL 8 / PostgreSQL / In-memory, switchable at runtime |
| | Raw SQL Migrations | No ORM schema drift — explicit, versioned DDL scripts |
| | Structured Logging | Dual output to stdout + `logs/backend.log` |

---

## 🏗 System Architecture

```
                              ┌─────────────────────────┐
                              │       Frontend          │
                              │  Next.js 16 + React 19  │
                              │  wagmi 3 · RainbowKit   │
                              │  WebSocket · REST       │
                              └──────────┬──────────────┘
                                   │     │
                              HTTP │     │ WS
                                   ▼     ▼
                              ┌─────────────────────────┐
                              │      Go Backend         │
                              │  REST API · WebSocket   │
                              │  Event Indexer          │
                              │  Service Layer          │
                              └──────┬─────┬────────────┘
                                     │     │
                              RPC    │     │ SQL
                                     ▼     ▼
  ┌──────────────────────────┐  ┌────────────────┐
  │   EVM Blockchain         │  │   MySQL / PG   │
  │                          │  │                │
  │  ┌── DEXFactory ──────┐  │  │  pairs         │
  │  │  createPair()      │  │  │  tokens        │
  │  └────────┬───────────┘  │  │  swap_events   │
  │           │              │  │  klines        │
  │  ┌── DEXPair ─────────┐  │  │  limit_orders  │
  │  │  swap() mint()     │  │  │  governance_   │
  │  │  burn() sync()     │  │  │    proposals   │
  │  └────────────────────┘  │  └────────────────┘
  │                          │
  │  ┌── DEXRouter ────────┐  │
  │  │  addLiquidity()     │  │
  │  │  swapExact()        │  │
  │  │  getAmountsOut()    │  │
  │  └────────────────────┘  │
  │                          │
  │  ┌── LimitOrderVault ──┐  │
  │  │  createOrder()      │  │
  │  │  fillOrder()        │  │
  │  │  cancelOrder()      │  │
  │  └────────────────────┘  │
  │                          │
  │  ┌── DEXGovernance ────┐  │
  │  │  propose() vote()   │  │
  │  │  execute()          │  │
  │  └────────────────────┘  │
  │                          │
  │  ┌── LiquidityMining ──┐  │
  │  │  deposit() withdraw │  │
  │  │  harvest()          │  │
  │  └────────────────────┘  │
  └──────────────────────────┘
```

### Contract Interaction Flow

```
User ──→ DEXRouter ──→ DEXPair ──→ ERC20 Tokens
              │              │
              ├── DEXFactory ──┘  (create/query pairs)
              ├── LimitOrderVault (escrow + settlement)
              ├── DEXGovernance   (propose → vote → execute)
              └── LiquidityMining (stake LP → earn rewards)
```

---

## 📂 Project Structure

```
dex/
├── contracts/                     # Solidity 0.8.24 · Hardhat 2
│   ├── contracts/
│   │   ├── DEXFactory.sol         # Pair factory with feeTo setter
│   │   ├── DEXPair.sol            # AMM core: reserves, swap, LP mint/burn
│   │   ├── DEXRouter.sol          # User-facing: swap, add/remove liquidity
│   │   ├── LimitOrderVault.sol    # Escrow-based limit order settlement
│   │   ├── DEXGovernance.sol      # Token-weighted governance
│   │   ├── LiquidityMining.sol    # Multi-pool LP staking rewards
│   │   ├── libraries/DEXLibrary.sol
│   │   └── interfaces/IWETH.sol
│   ├── test/                      # 39 unit tests (Factory · Pair · Router)
│   └── scripts/                   # Deploy scripts (core + test tokens)
│
├── backend/                       # Go 1.22+ · go-ethereum · GORM
│   ├── cmd/main.go                # Entry: API + event watcher + WS hub
│   ├── internal/
│   │   ├── api/handler.go         # REST + WebSocket endpoints
│   │   ├── blockchain/            # Eth client, ABI, event subscription
│   │   ├── service/service.go     # Business logic + orderbook aggregation
│   │   ├── store/                 # Interface + Memory/PG implementations
│   │   └── ws/hub.go              # WebSocket hub + broadcast
│   ├── migrations/                # Raw SQL (MySQL / PostgreSQL)
│   └── logs/
│
└── frontend/                      # Next.js 16 · React 19 · wagmi 3
    └── src/
        ├── app/                   # Pages: /swap /liquidity /limit-order ...
        ├── components/            # SwapCard · LiquidityCard · OrderBook ...
        └── lib/                   # wagmi config · ABIs · useOrderBook hook
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18 · Go ≥ 1.22 · MetaMask

### 1. Launch Local Chain

```bash
cd contracts && npm install
npx hardhat node                  # 20 test accounts printed
```

### 2. Deploy Contracts

```bash
npx hardhat run scripts/deploy.ts --network localhost
# → Copy output addresses to frontend/.env.local
```

### 3. Start Backend

```bash
cd backend

# In-memory mode (no DB needed)
go run cmd/main.go

# MySQL mode
DB_TYPE=mysql \
DATABASE_URL="root:root@123456@tcp(127.0.0.1:3306)/dex?charset=utf8mb4&parseTime=True&loc=Local" \
FACTORY_ADDRESS=0x... \
VAULT_ADDRESS=0x... \
go run cmd/main.go
```

### 4. Start Frontend

```bash
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

### 5. Run Contract Tests

```bash
cd contracts && npx hardhat test   # 39 passing
```

---

## 📡 API Reference

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pairs` | List all trading pairs |
| `GET` | `/api/pairs/:address` | Get pair by address |
| `GET` | `/api/tokens` | List known tokens |
| `GET` | `/api/tokens/:address` | Get token info |
| `GET` | `/api/quote?amountIn=...&path=[...]` | Get swap quote |
| `POST` | `/api/sync` | Sync pairs from chain |

### Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/swaps?pair=...&limit=50` | Recent swap events |
| `GET` | `/api/klines?pair=...&from=...&to=...` | OHLCV candlestick data |

### Limit Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/orders?status=open` | List orders by status |
| `POST` | `/api/orders` | Create order |
| `DELETE` | `/api/orders/:id` | Cancel order |
| `GET` | `/api/orderbook?tokenIn=...&tokenOut=...` | Aggregated bid/ask depth |

### Real-time

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ws` | WebSocket — orderbook depth updates |

### Governance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/proposals?status=active` | List proposals |
| `POST` | `/api/proposals` | Create proposal |
| `POST` | `/api/proposals/:id/vote` | Cast vote |

---

## 🧠 Design Decisions

### Smart Contracts

| Decision | Rationale |
|----------|-----------|
| `MINIMUM_LIQUIDITY` minted to `address(self)` | OpenZeppelin v5 ERC20 rejects `address(0)` mint; mirrors production Uniswap V2 behavior |
| 0.3% swap fee hardcoded | Simplifies audit surface; fee-on/fee-off controlled by Factory `feeTo` |
| `ReentrancyGuard` on Vault & Mining | All external calls (transfer, transferFrom) guarded against reentrancy |
| No proxy/upgrade pattern | Immutable deployments reduce attack surface; upgrade via governance if needed |

### Backend

| Decision | Rationale |
|----------|-----------|
| Raw SQL migrations | Zero schema drift; every DDL change is explicit, reviewed, versioned |
| No foreign keys | Blockchain event ingestion is high-write; FK checks become bottlenecks at scale |
| BigInt as decimal strings | `uint256` values exceed `int64`; stored as `VARCHAR(128)` with `big.Rat` arithmetic |
| WebSocket hub with broadcast | Orderbook depth changes pushed to all clients; avoids thundering-herd polling |
| Interface-driven store layer | `Store` interface enables memory/PG/MySQL swap without touching business logic |

### Frontend

| Decision | Rationale |
|----------|-----------|
| wagmi v3 + viem v2 | Type-safe contract calls; `as const` ABI inference for compile-time arg checking |
| WebSocket + polling fallback | Live updates when connected; 5s HTTP poll when WS unavailable |
| No floating-point arithmetic | All amounts handled as strings; `parseUnits`/`formatUnits` for display only |
| `tsconfig` target ES2020 | Required for `BigInt` literal support in TypeScript |

---

## 🗄 Database Schema

Six tables, zero foreign keys, UTF-8 throughout:

```
pairs                 tokens               swap_events
├── id (PK)           ├── id (PK)          ├── id (PK)
├── address (UQ)      ├── address (UQ)     ├── pair (IDX)
├── token0            ├── name             ├── sender
├── token1            ├── symbol           ├── amount0_in / amount1_in
├── reserve0          ├── decimals         ├── amount0_out / amount1_out
└── reserve1          └── created_at       ├── to_addr
                                           ├── block_num (IDX)
klines                ├── id (PK)          ├── tx_hash
├── id (PK)           ├── maker            └── created_at
├── pair (IDX)        ├── token_in
├── open_time (IDX)   ├── token_out        governance_proposals
├── open/high/low/cls ├── amount_in/out    ├── id (PK)
├── volume            ├── status (IDX)     ├── proposer
└── created_at        ├── deadline         ├── title / description
                      ├── filled_tx        ├── status (IDX)
limit_orders          └── created_at       ├── for_votes / against_votes
├── id (PK)                                ├── start_time / end_time
├── maker                                  ├── executed_tx
├── token_in / token_out                   └── created_at / updated_at
├── amount_in / amount_out
├── status (IDX)
├── deadline
├── filled_tx
└── created_at / updated_at
```

> All numeric amounts stored as `VARCHAR(128)` decimal strings. `DEFAULT` values on every column — no NULLs.

---

## ⚙️ Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_URL` | `http://127.0.0.1:8545` | Ethereum JSON-RPC endpoint |
| `LISTEN_ADDR` | `:8080` | API server bind address |
| `FACTORY_ADDRESS` | — | Enables on-chain event listening |
| `VAULT_ADDRESS` | — | Enables limit order event sync |
| `DATABASE_URL` | — | DB connection string (empty = in-memory) |
| `DB_TYPE` | `auto` | `auto` / `mysql` / `postgres` |

### Frontend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Yes | DEXFactory contract |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | Yes | DEXRouter contract |
| `NEXT_PUBLIC_WETH_ADDRESS` | Yes | WETH contract |
| `NEXT_PUBLIC_LIMIT_ORDER_ADDRESS` | No | LimitOrderVault contract |
| `NEXT_PUBLIC_GOVERNANCE_ADDRESS` | No | DEXGovernance contract |
| `NEXT_PUBLIC_FARM_ADDRESS` | No | LiquidityMining contract |
| `NEXT_PUBLIC_WS_URL` | No | WebSocket URL (default `ws://localhost:8080/api/ws`) |
| `NEXT_PUBLIC_API_URL` | No | REST API URL (default `http://localhost:8080`) |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, Hardhat 2, OpenZeppelin 5 |
| Backend | Go 1.22+, go-ethereum, GORM, gorilla/websocket |
| Database | MySQL 8 / PostgreSQL / In-memory |
| Frontend | Next.js 16, React 19, wagmi 3, viem 2, RainbowKit 2, Tailwind CSS 4 |
| Wallet | MetaMask / WalletConnect (via RainbowKit) |

---

## 🗺 Roadmap

- [ ] Cross-chain swaps (LayerZero / Axelar)
- [ ] Contract security audit (Slither + manual review)
- [ ] Concentrated liquidity (Uniswap V3-style tick system)
- [ ] TWAP oracle integration
- [ ] Mobile-responsive optimization
- [ ] Dark/light theme toggle

---

## 📄 License

MIT

---

<div align="center">

**Built with obsessive attention to engineering detail.**

If you're building something in DeFi infrastructure, exchange systems, or blockchain tooling — I'd love to talk.

📧 **wolfbian017@gmail.com**

</div>
