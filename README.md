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

**[English](#english)** · **[中文](#中文)**

</div>

---

<a id="english"></a>

## Why This Project

This isn't a tutorial DEX. It's a **complete, vertically-integrated DeFi protocol** designed to demonstrate production-level engineering across the entire stack — from EVM smart contracts to real-time WebSocket infrastructure to a modern React frontend.

**Key engineering decisions that matter in production:**

- **OZ v5–compliant MINIMUM_LIQUIDITY** — OpenZeppelin v5 forbids `address(0)` mint; MINIMUM_LIQUIDITY is minted to the pair contract itself, matching real-world Uniswap V2 deployments
- **Deterministic pair addressing** — Tokens are sorted by address at creation, guaranteeing a canonical pair address per token pair and preventing duplicate pools
- **Constant-product invariant enforcement** — Every `swap`, `mint`, and `burn` asserts `√(reserve0 × reserve1)` never decreases, making the pool self-auditing on-chain
- **Atomic limit order settlement** — `LimitOrderVault` escrows `tokenIn` upfront; `fillOrder` validates AMM pricing via `DEXLibrary.getAmountsOut` before releasing funds, ensuring makers never receive less than their minimum
- **ReentrancyGuard on all state-mutating vaults** — External token transfers (`transfer`, `transferFrom`) in Vault and Mining contracts are guarded; no check-effect-interaction vulnerability possible
- **Explicit versioned SQL migrations** — Fully auditable, idempotent, and production-grade without ORM schema surprises
- **Zero-FK data layer** — Referential integrity enforced at the application layer; eliminates cross-table lock contention under high-throughput blockchain event ingestion and simplifies horizontal scaling
- **WebSocket order book** — Not just a REST polling UI; real-time bid/ask depth with on-chain event-driven updates
- **BigInt-safe pipeline** — All token amounts stored as decimal strings with `big.Rat` arithmetic; zero floating-point anywhere from contract to DB to frontend

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

<br/>
<br/>

---

<a id="中文"></a>

<div align="center">

# 🏦 DEX 去中心化交易所

**从零构建的生产级去中心化交易所**

全栈 AMM DEX：恒定乘积做市、链上结算限价订单簿、治理投票、流动性挖矿、WebSocket 实时深度图。

**[English](#english)** · **[中文](#中文)**

</div>

---

## 项目定位

这不是一个教程级 DEX。这是一个**完整的、垂直整合的 DeFi 协议**，旨在展示从 EVM 智能合约到实时 WebSocket 基础设施再到现代 React 前端的全栈生产级工程能力。

**生产环境中真正重要的工程决策：**

- **兼容 OZ v5 的 MINIMUM_LIQUIDITY** — OpenZeppelin v5 禁止 `address(0)` 铸造；MINIMUM_LIQUIDITY 铸造给交易对合约自身，与线上 Uniswap V2 行为一致
- **确定性交易对地址** — 创建时按地址排序代币，保证每对代币仅有唯一规范交易对地址，防止重复资金池
- **恒定乘积不变量强制校验** — 每次 `swap`、`mint`、`burn` 均断言 `√(reserve0 × reserve1)` 不减，使资金池在链上可自审计
- **原子化限价单结算** — `LimitOrderVault` 预先托管 `tokenIn`；`fillOrder` 通过 `DEXLibrary.getAmountsOut` 验证 AMM 价格后释放资金，确保挂单方不低于最低成交价
- **所有状态变更金库使用 ReentrancyGuard** — Vault 和 Mining 合约中的外部代币转账（`transfer`、`transferFrom`）均受防护；不可能出现检查-生效-交互漏洞
- **显式版本化 SQL 迁移** — 完全可审计、幂等、生产级，杜绝 ORM Schema 漂移风险
- **零外键数据层** — 引用完整性由应用层保证；消除高吞吐链上事件写入下的跨表锁争用，简化水平扩展
- **WebSocket 订单簿** — 不是 REST 轮询 UI；实时买卖盘深度，链上事件驱动更新
- **BigInt 安全管线** — 所有代币金额以十进制字符串 + `big.Rat` 算术存储；从合约到数据库到前端全链路零浮点

---

## ✨ 功能一览

| 分类 | 功能 | 详情 |
|------|------|------|
| **核心 AMM** | 代币兑换 | ERC20 ↔ ERC20，0.3% 手续费，恒定乘积 `x·y=k` |
| | ETH 包装 | 原生 ETH ↔ ERC20，通过 WETH 网关 |
| | 多跳路由 | A→B→C 中间路径优化 |
| | 滑点保护 | 可配置最小输出 + 交易截止时间 |
| **流动性** | 添加/移除 | 存入配对代币获得 LP 份额；销毁份额提取代币 |
| | LP 代币 | 符合 ERC20 标准的流动性提供者代币 |
| **限价单** | 链下订单簿 | REST API + WebSocket 实时深度聚合 |
| | 链上结算 | `LimitOrderVault` 托管代币，原子化成交 |
| | 事件同步 | 后端监听链上 `OrderCreated/Filled/Cancelled` 事件 |
| **治理** | 提案 | 创建 → 投票 → 执行，代币加权投票 |
| **流动性挖矿** | 多池质押 | 质押 LP 代币，按池权重分配奖励 |
| **实时数据** | WebSocket 推送 | 订单簿深度变更广播至所有连接客户端 |
| | K 线 / OHLCV | 通过 REST API 获取历史 K 线数据 |
| | 链上事件监听 | Factory `PairCreated`、Pair `Swap/Mint/Burn/Sync` 实时索引 |
| **基础设施** | 多数据库 | MySQL 8 / PostgreSQL / 内存，运行时切换 |
| | 原生 SQL 迁移 | 无 ORM Schema 漂移 — 显式、版本化的 DDL 脚本 |
| | 结构化日志 | 双输出至 stdout + `logs/backend.log` |

---

## 🏗 系统架构

```
                              ┌─────────────────────────┐
                              │         前端            │
                              │  Next.js 16 + React 19  │
                              │  wagmi 3 · RainbowKit   │
                              │  WebSocket · REST       │
                              └──────────┬──────────────┘
                                   │     │
                              HTTP │     │ WS
                                   ▼     ▼
                              ┌─────────────────────────┐
                              │      Go 后端            │
                              │  REST API · WebSocket   │
                              │  事件索引器             │
                              │  业务逻辑层             │
                              └──────┬─────┬────────────┘
                                     │     │
                              RPC    │     │ SQL
                                     ▼     ▼
  ┌──────────────────────────┐  ┌────────────────┐
  │      EVM 区块链          │  │  MySQL / PG    │
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

### 合约交互流程

```
用户 ──→ DEXRouter ──→ DEXPair ──→ ERC20 代币
              │              │
              ├── DEXFactory ──┘  (创建/查询交易对)
              ├── LimitOrderVault (托管 + 结算)
              ├── DEXGovernance   (提案 → 投票 → 执行)
              └── LiquidityMining (质押 LP → 赚取奖励)
```

---

## 📂 项目结构

```
dex/
├── contracts/                     # Solidity 0.8.24 · Hardhat 2
│   ├── contracts/
│   │   ├── DEXFactory.sol         # 交易对工厂，feeTo 设置
│   │   ├── DEXPair.sol            # AMM 核心：储备量、兑换、LP 铸造/销毁
│   │   ├── DEXRouter.sol          # 用户入口：兑换、添加/移除流动性
│   │   ├── LimitOrderVault.sol    # 托管式限价单结算
│   │   ├── DEXGovernance.sol      # 代币加权治理
│   │   ├── LiquidityMining.sol    # 多池 LP 质押奖励
│   │   ├── libraries/DEXLibrary.sol
│   │   └── interfaces/IWETH.sol
│   ├── test/                      # 39 个单元测试（Factory · Pair · Router）
│   └── scripts/                   # 部署脚本（核心 + 测试代币）
│
├── backend/                       # Go 1.22+ · go-ethereum · GORM
│   ├── cmd/main.go                # 入口：API + 事件监听 + WS Hub
│   ├── internal/
│   │   ├── api/handler.go         # REST + WebSocket 端点
│   │   ├── blockchain/            # 以太坊客户端、ABI、事件订阅
│   │   ├── service/service.go     # 业务逻辑 + 订单簿聚合
│   │   ├── store/                 # 接口 + 内存/PG 实现
│   │   └── ws/hub.go              # WebSocket Hub + 广播
│   ├── migrations/                # 原生 SQL（MySQL / PostgreSQL）
│   └── logs/
│
└── frontend/                      # Next.js 16 · React 19 · wagmi 3
    └── src/
        ├── app/                   # 页面：/swap /liquidity /limit-order ...
        ├── components/            # SwapCard · LiquidityCard · OrderBook ...
        └── lib/                   # wagmi 配置 · ABI · useOrderBook hook
```

---

## 🚀 快速开始

### 前置条件

- Node.js ≥ 18 · Go ≥ 1.22 · MetaMask

### 1. 启动本地区块链

```bash
cd contracts && npm install
npx hardhat node                  # 输出 20 个测试账户
```

### 2. 部署合约

```bash
npx hardhat run scripts/deploy.ts --network localhost
# → 将输出的地址填入 frontend/.env.local
```

### 3. 启动后端

```bash
cd backend

# 内存模式（无需数据库）
go run cmd/main.go

# MySQL 模式
DB_TYPE=mysql \
DATABASE_URL="root:root@123456@tcp(127.0.0.1:3306)/dex?charset=utf8mb4&parseTime=True&loc=Local" \
FACTORY_ADDRESS=0x... \
VAULT_ADDRESS=0x... \
go run cmd/main.go
```

### 4. 启动前端

```bash
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

### 5. 运行合约测试

```bash
cd contracts && npx hardhat test   # 39 passing
```

---

## 📡 API 参考

### 核心

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/pairs` | 列出所有交易对 |
| `GET` | `/api/pairs/:address` | 按地址查询交易对 |
| `GET` | `/api/tokens` | 列出已知代币 |
| `GET` | `/api/tokens/:address` | 查询代币信息 |
| `GET` | `/api/quote?amountIn=...&path=[...]` | 获取兑换报价 |
| `POST` | `/api/sync` | 从链上同步交易对 |

### 行情数据

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/swaps?pair=...&limit=50` | 最近兑换事件 |
| `GET` | `/api/klines?pair=...&from=...&to=...` | OHLCV K 线数据 |

### 限价单

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/orders?status=open` | 按状态列出订单 |
| `POST` | `/api/orders` | 创建订单 |
| `DELETE` | `/api/orders/:id` | 取消订单 |
| `GET` | `/api/orderbook?tokenIn=...&tokenOut=...` | 聚合买卖盘深度 |

### 实时推送

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/ws` | WebSocket — 订单簿深度更新 |

### 治理

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/proposals?status=active` | 列出提案 |
| `POST` | `/api/proposals` | 创建提案 |
| `POST` | `/api/proposals/:id/vote` | 投票 |

---

## 🧠 设计决策

### 智能合约

| 决策 | 原因 |
|------|------|
| `MINIMUM_LIQUIDITY` 铸造给 `address(self)` | OpenZeppelin v5 ERC20 拒绝 `address(0)` 铸造；与线上 Uniswap V2 行为一致 |
| 0.3% 手续费硬编码 | 减少审计面；手续开关由 Factory `feeTo` 控制 |
| Vault 和 Mining 合约使用 `ReentrancyGuard` | 所有外部调用（transfer、transferFrom）均防护重入攻击 |
| 不使用代理/可升级模式 | 不可变部署减少攻击面；需升级时通过治理执行 |

### 后端

| 决策 | 原因 |
|------|------|
| 原生 SQL 迁移 | 零 Schema 漂移；每个 DDL 变更显式、可审查、版本化 |
| 禁止外键 | 区块链事件写入是高并发路径；FK 检查在大规模下成为瓶颈 |
| BigInt 以十进制字符串存储 | `uint256` 超出 `int64` 范围；使用 `VARCHAR(128)` + `big.Rat` 算术 |
| WebSocket Hub 广播 | 订单簿深度变更推送至所有客户端；避免惊群效应轮询 |
| 接口驱动存储层 | `Store` 接口支持内存/PG/MySQL 切换，无需改动业务逻辑 |

### 前端

| 决策 | 原因 |
|------|------|
| wagmi v3 + viem v2 | 类型安全的合约调用；`as const` ABI 推断实现编译时参数检查 |
| WebSocket + 轮询兜底 | 连接时实时更新；WS 不可用时 5 秒 HTTP 轮询 |
| 禁止浮点运算 | 所有金额以字符串处理；`parseUnits`/`formatUnits` 仅用于显示 |
| `tsconfig` target ES2020 | TypeScript 中 `BigInt` 字面量所需 |

---

## 🗄 数据库设计

六张表，零外键，全 UTF-8：

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

> 所有数值型金额以 `VARCHAR(128)` 十进制字符串存储。所有字段设置 `DEFAULT` — 无 NULL。

---

## ⚙️ 配置

### 后端环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RPC_URL` | `http://127.0.0.1:8545` | 以太坊 JSON-RPC 端点 |
| `LISTEN_ADDR` | `:8080` | API 服务器绑定地址 |
| `FACTORY_ADDRESS` | — | 启用链上事件监听 |
| `VAULT_ADDRESS` | — | 启用限价单事件同步 |
| `DATABASE_URL` | — | 数据库连接串（空则使用内存存储） |
| `DB_TYPE` | `auto` | `auto` / `mysql` / `postgres` |

### 前端环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | 是 | DEXFactory 合约 |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | 是 | DEXRouter 合约 |
| `NEXT_PUBLIC_WETH_ADDRESS` | 是 | WETH 合约 |
| `NEXT_PUBLIC_LIMIT_ORDER_ADDRESS` | 否 | LimitOrderVault 合约 |
| `NEXT_PUBLIC_GOVERNANCE_ADDRESS` | 否 | DEXGovernance 合约 |
| `NEXT_PUBLIC_FARM_ADDRESS` | 否 | LiquidityMining 合约 |
| `NEXT_PUBLIC_WS_URL` | 否 | WebSocket 地址（默认 `ws://localhost:8080/api/ws`） |
| `NEXT_PUBLIC_API_URL` | 否 | REST API 地址（默认 `http://localhost:8080`） |

---

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 智能合约 | Solidity 0.8.24, Hardhat 2, OpenZeppelin 5 |
| 后端 | Go 1.22+, go-ethereum, GORM, gorilla/websocket |
| 数据库 | MySQL 8 / PostgreSQL / 内存存储 |
| 前端 | Next.js 16, React 19, wagmi 3, viem 2, RainbowKit 2, Tailwind CSS 4 |
| 钱包 | MetaMask / WalletConnect（通过 RainbowKit） |

---

## 🗺 路线图

- [ ] 跨链交易（LayerZero / Axelar）
- [ ] 合约安全审计（Slither + 人工审查）
- [ ] 集中流动性（Uniswap V3 风格 tick 系统）
- [ ] TWAP 预言机集成
- [ ] 移动端适配优化
- [ ] 深色/浅色主题切换

---

## 📄 许可证

MIT

---

<div align="center">

**以对工程细节的极致追求构建。**

如果你在做 DeFi 基础设施、交易所系统或区块链工具——期待与你交流。

📧 **wolfbian017@gmail.com**

[⬆ 回到顶部 / Back to Top](#english)

</div>
