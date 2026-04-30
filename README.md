# DEX - 去中心化交易所

基于 AMM（恒定乘积 x·y=k）的去中心化交易所，灵感来自 Uniswap V2。

## 功能概览

| 功能 | 状态 | 说明 |
|------|------|------|
| 代币兑换 (Swap) | ✅ | 支持 ERC20 代币互换，0.3% 手续费 |
| 流动性管理 | ✅ | 添加/移除流动性，获取 LP 代币 |
| ETH 兑换 | ✅ | 支持 ETH ↔ ERC20 兑换（通过 WETH 包装） |
| 多跳路由 | ✅ | 支持 A→B→C 间接路径兑换 |
| 实时报价 | ✅ | 输入数量自动计算输出，含滑点保护 |
| 钱包连接 | ✅ | RainbowKit 支持 MetaMask 等主流钱包 |
| 链上事件监听 | ✅ | 后端实时监听 Swap/Mint/Burn 事件 |
| 限价单 | ✅ | 链下挂单 + 链上结算，支持创建/取消/成交 |
| 价格图表 | ✅ | SVG 折线图，从后端 Kline API 获取历史数据 |
| 治理 & 投票 | ✅ | 创建提案、代币加权投票、执行提案 |
| 流动性挖矿 | ✅ | 质押 LP 代币赚取奖励，支持多池 |
| 持久化存储 | ✅ | MySQL / PostgreSQL / 内存三模式，通过 DATABASE_URL + DB_TYPE 切换 |

## 项目结构

```
dex/
├── contracts/                  # Solidity 智能合约 (Hardhat)
│   ├── contracts/
│   │   ├── DEXFactory.sol      # 交易对工厂合约
│   │   ├── DEXPair.sol         # 交易对核心合约（AMM 逻辑）
│   │   ├── DEXRouter.sol       # 路由合约（用户交互入口）
│   │   ├── LimitOrderVault.sol # 限价单金库合约
│   │   ├── DEXGovernance.sol   # 治理合约（提案+投票）
│   │   ├── LiquidityMining.sol # 流动性挖矿合约
│   │   ├── libraries/
│   │   │   └── DEXLibrary.sol  # 辅助库（报价/金额计算）
│   │   ├── interfaces/
│   │   │   └── IWETH.sol       # WETH 接口
│   │   └── mock/
│   │       ├── MockERC20.sol   # 测试用 ERC20
│   │       └── MockWETH.sol    # 测试用 WETH
│   ├── test/
│   │   ├── DEXFactory.test.ts  # 工厂合约测试 (10 cases)
│   │   ├── DEXPair.test.ts     # 交易对测试 (11 cases)
│   │   └── DEXRouter.test.ts   # 路由合约测试 (18 cases)
│   ├── scripts/
│   │   ├── deploy.ts           # 部署核心合约
│   │   └── deploy-tokens.ts    # 部署测试代币
│   └── hardhat.config.ts
│
├── backend/                    # Go 后端服务
│   ├── cmd/
│   │   └── main.go             # 入口，启动 API + 事件监听
│   └── internal/
│       ├── api/
│       │   └── handler.go      # REST API 路由与处理
│       ├── blockchain/
│       │   ├── client.go       # 链上交互客户端
│       │   ├── abi.go          # 合约 ABI 定义
│       │   └── events.go       # 事件订阅与处理
│       ├── service/
│       │   ├── service.go      # 业务逻辑（报价/订单/治理/K线）
│       │   └── errors.go       # 错误定义
│       ├── store/
│       │   ├── models.go       # 数据模型 + 接口定义
│       │   ├── memory.go       # 内存存储实现
│       │   └── postgres.go     # 数据库存储实现（MySQL/PG 通用）
│       ├── model/
│       │   └── model.go        # 传输层数据模型
│       ├── migrations/
│       │   ├── 001_init_mysql.sql    # MySQL 建表脚本
│       │   └── 001_init_postgres.sql # PostgreSQL 建表脚本
│       └── logs/                # 日志文件目录
│
└── frontend/                   # Next.js 前端
    └── src/
        ├── app/
        │   ├── page.tsx            # 首页
        │   ├── swap/page.tsx       # Swap + 价格图表
        │   ├── liquidity/page.tsx  # 流动性管理页面
        │   ├── limit-order/page.tsx # 限价单页面
        │   ├── governance/page.tsx  # 治理投票页面
        │   └── farming/page.tsx     # 流动性挖矿页面
        ├── components/
        │   ├── Providers.tsx       # wagmi/RainbowKit/ReactQuery Provider
        │   ├── Navbar.tsx          # 导航栏 + 钱包连接按钮
        │   ├── SwapCard.tsx        # Swap 交互组件
        │   ├── LiquidityCard.tsx   # 流动性交互组件
        │   ├── LimitOrderCard.tsx  # 限价单交互组件
        │   ├── GovernanceCard.tsx  # 治理投票交互组件
        │   ├── FarmingCard.tsx     # 流动性挖矿交互组件
        │   └── PriceChart.tsx      # SVG 价格图表组件
        └── lib/
            ├── wagmi.ts            # wagmi 链配置
            ├── contracts.ts        # 合约 ABI + 地址
            └── tokens.ts           # 常用代币列表
```

## 核心合约架构

```
                        ┌── DEXGovernance (治理投票)
                        │
用户 ──→ DEXRouter ──→ DEXPair ──→ ERC20 Tokens
              │              │
              ├── DEXFactory ──┘  (创建/查询交易对)
              │
              ├── LimitOrderVault (限价单托管+结算)
              │
              └── LiquidityMining  (LP 质押挖矿)
```

- **DEXFactory**：创建交易对，维护 token→pair 映射
- **DEXPair**：AMM 核心，管理储备量、执行 swap、铸造/销毁 LP 代币
- **DEXRouter**：用户入口，封装 approve、滑点保护、deadline、多跳路由
- **LimitOrderVault**：限价单托管，用户存入 tokenIn，成交时交付 tokenOut
- **DEXGovernance**：治理代币加权投票，创建提案→投票→执行
- **LiquidityMining**：LP 质押挖矿，多池分配奖励
- **恒定乘积公式**：`x * y = k`，swap 后 `x' * y' >= k`（0.3% 手续费）

## 操作手册

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Go](https://go.dev/) >= 1.22
- [MySQL](https://www.mysql.com/) 8+ 或 [PostgreSQL](https://www.postgresql.org/) (可选，不设置则使用内存存储)
- [Docker](https://www.docker.com/) (可选，用于本地启动 MySQL)
- [MetaMask](https://metamask.io/) 浏览器插件

### 1. 启动本地区块链

```bash
cd contracts
npm install
npx hardhat node
```

终端会输出 20 个测试账户及其私钥，保留此终端窗口。

### 2. 部署合约

新开终端：

```bash
cd contracts

# 部署核心合约（WETH + Factory + Router）
npx hardhat run scripts/deploy.ts --network localhost
```

输出示例：
```
MockWETH deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
DEXFactory deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
DEXRouter deployed to: 0x9fE46736679d2D9a65F0992F2272De9f3c7fa6e0

Update frontend/.env.local with:
NEXT_PUBLIC_FACTORY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_ROUTER_ADDRESS=0x9fE46736679d2D9a65F0992F2272De9f3c7fa6e0
NEXT_PUBLIC_WETH_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

将输出的地址填入 `frontend/.env.local`：

```bash
cd ../frontend
# 编辑 .env.local，填入上面输出的地址
```

部署测试代币（可选）：

```bash
cd contracts
npx hardhat run scripts/deploy-tokens.ts --network localhost
```

### 3. 启动后端服务

#### 内存存储模式（默认，无需数据库）

```bash
cd backend
go run cmd/main.go
```

#### MySQL 模式

```bash
# 使用 Docker 启动 MySQL（如已有可跳过）
docker run -d --name mysql8 \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root@123456 \
  -e MYSQL_DATABASE=dex \
  -e MYSQL_CHARACTER_SET_SERVER=utf8mb4 \
  -e MYSQL_COLLATION_SERVER=utf8mb4_unicode_ci \
  mysql:8

# 或在已有 MySQL 中创建数据库
docker exec mysql8 mysql -uroot -proot@123456 \
  -e "CREATE DATABASE IF NOT EXISTS dex DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 启动后端（自动建表）
DB_TYPE=mysql \
DATABASE_URL="root:root@123456@tcp(127.0.0.1:3306)/dex?charset=utf8mb4&parseTime=True&loc=Local" \
go run cmd/main.go
```

#### PostgreSQL 模式

```bash
# 创建数据库
createdb dex

# 启动后端（自动建表）
DB_TYPE=postgres \
DATABASE_URL="host=localhost port=5432 user=postgres dbname=dex sslmode=disable" \
go run cmd/main.go
```

> **注意**：`DB_TYPE` 可省略，默认为 `auto`，会根据 `DATABASE_URL` 格式自动判断（含 `tcp(` 或 `:3306` 识别为 MySQL，其余识别为 PostgreSQL）。

后端启动后：
- 日志同时输出到终端和 `logs/backend.log`
- 自动执行 `migrations/` 目录下的原生 SQL 建表脚本（**禁止 GORM AutoMigrate**）

可配置环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RPC_URL` | `http://127.0.0.1:8545` | 区块链 RPC 地址 |
| `LISTEN_ADDR` | `:8080` | API 监听地址 |
| `FACTORY_ADDRESS` | 空 | Factory 合约地址（设置后启用事件监听） |
| `DATABASE_URL` | 空 | 数据库连接串（空则用内存存储） |
| `DB_TYPE` | `auto` | 数据库类型：`auto` / `mysql` / `postgres` |

API 端点：

```
# 基础
GET  /api/pairs                          # 列出所有交易对
GET  /api/pairs/:address                 # 查询交易对详情
GET  /api/tokens                         # 列出已知代币
GET  /api/tokens/:address                # 查询代币信息
GET  /api/quote?amountIn=...&path=[...]  # 获取报价
POST /api/sync                           # 手动同步链上数据

# 交易数据
GET  /api/swaps?pair=...&limit=50        # 查询交易记录
GET  /api/klines?pair=...&from=...&to=...# 查询K线数据

# 限价单
GET    /api/orders?status=open           # 列出订单
POST   /api/orders                       # 创建订单
DELETE /api/orders/:id                   # 取消订单

# 治理
GET  /api/proposals?status=active        # 列出提案
POST /api/proposals                      # 创建提案
POST /api/proposals/:id/vote             # 投票
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

### 5. 配置 MetaMask 连接本地链

1. 打开 MetaMask → 添加网络：
   - 网络名称：`Hardhat Local`
   - RPC URL：`http://127.0.0.1:8545`
   - 链 ID：`31337`
   - 货币符号：`ETH`

2. 导入 Hardhat 测试账户（使用 `npx hardhat node` 输出的私钥）

3. 如果部署了测试代币，在 MetaMask 中导入代币（粘贴代币合约地址）

### 6. 使用 DEX

#### Swap 代币
1. 访问 http://localhost:3000/swap
2. 选择输入代币和输出代币
3. 输入数量，自动获取报价
4. 点击 **Approve** 授权（首次需要）
5. 点击 **Swap** 执行兑换
6. 页面下方显示价格走势图

#### 管理流动性
1. 访问 http://localhost:3000/liquidity
2. 选择 **Add Liquidity** 标签
3. 选择代币对，输入数量 A，数量 B 自动计算
4. Approve 代币 → 点击 **Add Liquidity**
5. 移除流动性：切换到 **Remove Liquidity**，选择百分比 → 确认

#### 限价单
1. 访问 http://localhost:3000/limit-order
2. 输入 Token In / Token Out 地址和期望数量
3. 选择有效期（1h/6h/24h/3d/7d）
4. Approve → Create Order
5. 其他用户可在价格满足时 Fill Order

#### 治理投票
1. 访问 http://localhost:3000/governance
2. **NewProposal** 标签：填写标题和描述，创建提案
3. **Proposals** 标签：输入提案 ID，For/Against 投票
4. 投票期结束后可执行通过的提案

#### 流动性挖矿
1. 访问 http://localhost:3000/farming
2. 输入 Pool ID 和质押数量
3. Approve → Deposit 质押 LP 代币
4. Harvest 收获奖励 → Withdraw 取回 LP

### 7. 运行合约测试

```bash
cd contracts
npx hardhat test
```

预期输出：`39 passing`

## 环境变量汇总

### frontend/.env.local

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | 是 | DEXFactory 合约地址 |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | 是 | DEXRouter 合约地址 |
| `NEXT_PUBLIC_WETH_ADDRESS` | 是 | WETH 合约地址 |
| `NEXT_PUBLIC_LIMIT_ORDER_ADDRESS` | 否 | LimitOrderVault 合约地址 |
| `NEXT_PUBLIC_GOVERNANCE_ADDRESS` | 否 | DEXGovernance 合约地址 |
| `NEXT_PUBLIC_FARM_ADDRESS` | 否 | LiquidityMining 合约地址 |

### backend 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RPC_URL` | `http://127.0.0.1:8545` | 区块链 RPC |
| `LISTEN_ADDR` | `:8080` | API 端口 |
| `FACTORY_ADDRESS` | 空 | 设置后启用事件监听 |
| `DATABASE_URL` | 空 | 数据库连接串，空则用内存存储 |
| `DB_TYPE` | `auto` | `auto` / `mysql` / `postgres` |

## 技术栈

| 层 | 技术 |
|----|------|
| 智能合约 | Solidity 0.8.24, Hardhat, OpenZeppelin 5 |
| 后端 | Go 1.22+, go-ethereum, GORM |
| 数据库 | MySQL 8 / PostgreSQL / 内存存储 |
| 前端 | Next.js 16, React 19, wagmi 3, viem 2, RainbowKit 2, Tailwind CSS 4 |
| 钱包 | MetaMask / WalletConnect (via RainbowKit) |

## 数据库设计规范

- **严禁外键**：所有表无外键约束，应用层保证数据一致性
- **禁止 GORM AutoMigrate**：建表使用 `migrations/` 下的原生 SQL 脚本
- **DEFAULT 值**：数值型字段 DEFAULT 0，字符串 DEFAULT ''，时间 DEFAULT CURRENT_TIMESTAMP，避免 NULL 导致转换异常
- **编码**：统一 UTF-8（MySQL 使用 utf8mb4_unicode_ci）
- **大数存储**：储备量、金额等大数使用 VARCHAR(128) 存储十进制字符串，避免精度丢失
- **三模式切换**：内存存储（默认）→ MySQL → PostgreSQL，通过 `DATABASE_URL` + `DB_TYPE` 配置

## 后续规划

- [ ] 跨链交易（LayerZero / Axelar）
- [ ] 合约安全审计
- [ ] 前端限价单订单簿实时展示
- [ ] WebSocket 推送价格更新
- [ ] 移动端适配优化
