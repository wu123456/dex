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

## 项目结构

```
dex/
├── contracts/                  # Solidity 智能合约 (Hardhat)
│   ├── contracts/
│   │   ├── DEXFactory.sol      # 交易对工厂合约
│   │   ├── DEXPair.sol         # 交易对核心合约（AMM 逻辑）
│   │   ├── DEXRouter.sol       # 路由合约（用户交互入口）
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
│       │   ├── service.go      # 业务逻辑（报价/同步）
│       │   └── errors.go       # 错误定义
│       ├── store/
│       │   └── memory.go       # 内存缓存存储
│       └── model/
│           └── model.go        # 数据模型
│
└── frontend/                   # Next.js 前端
    └── src/
        ├── app/
        │   ├── page.tsx        # 首页
        │   ├── swap/page.tsx   # Swap 页面
        │   └── liquidity/page.tsx # 流动性管理页面
        ├── components/
        │   ├── Providers.tsx   # wagmi/RainbowKit/ReactQuery Provider
        │   ├── Navbar.tsx      # 导航栏 + 钱包连接按钮
        │   ├── SwapCard.tsx    # Swap 交互组件
        │   └── LiquidityCard.tsx # 流动性交互组件
        └── lib/
            ├── wagmi.ts        # wagmi 链配置
            ├── contracts.ts    # 合约 ABI + 地址
            └── tokens.ts       # 常用代币列表
```

## 核心合约架构

```
用户 ──→ DEXRouter ──→ DEXPair ──→ ERC20 Tokens
              │              │
              └── DEXFactory ──┘  (创建/查询交易对)
```

- **DEXFactory**：创建交易对，维护 token→pair 映射
- **DEXPair**：AMM 核心，管理储备量、执行 swap、铸造/销毁 LP 代币
- **DEXRouter**：用户入口，封装 approve、滑点保护、deadline、多跳路由
- **恒定乘积公式**：`x * y = k`，swap 后 `x' * y' >= k`（0.3% 手续费）

## 操作手册

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Go](https://go.dev/) >= 1.22
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

```bash
cd backend
go run cmd/main.go
```

可配置环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RPC_URL` | `http://127.0.0.1:8545` | 区块链 RPC 地址 |
| `LISTEN_ADDR` | `:8080` | API 监听地址 |
| `FACTORY_ADDRESS` | 空 | Factory 合约地址（设置后启用事件监听） |

API 端点：

```
GET  /api/pairs              # 列出所有交易对
GET  /api/pairs/:address     # 查询交易对详情
GET  /api/tokens             # 列出已知代币
GET  /api/tokens/:address    # 查询代币信息
GET  /api/quote?amountIn=...&path=[...]  # 获取报价
POST /api/sync               # 手动同步链上数据
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

#### 管理流动性
1. 访问 http://localhost:3000/liquidity
2. 选择 **Add Liquidity** 标签
3. 选择代币对，输入数量 A，数量 B 自动计算
4. Approve 代币 → 点击 **Add Liquidity**
5. 移除流动性：切换到 **Remove Liquidity**，选择百分比 → 确认

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

### backend 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RPC_URL` | `http://127.0.0.1:8545` | 区块链 RPC |
| `LISTEN_ADDR` | `:8080` | API 端口 |
| `FACTORY_ADDRESS` | 空 | 设置后启用事件监听 |

## 技术栈

| 层 | 技术 |
|----|------|
| 智能合约 | Solidity 0.8.24, Hardhat, OpenZeppelin 5 |
| 后端 | Go 1.22+, go-ethereum |
| 前端 | Next.js 16, React 19, wagmi 3, viem 2, RainbowKit 2, Tailwind CSS 4 |
| 钱包 | MetaMask / WalletConnect (via RainbowKit) |

## 后续规划 (Phase 2+)

- [ ] 限价单（链下订单簿 + 链上结算）
- [ ] K 线图 / 交易图表
- [ ] 跨链交易（LayerZero / Axelar）
- [ ] 治理代币 & 投票
- [ ] 流动性挖矿激励
- [ ] 后端持久化存储（PostgreSQL）
- [ ] 合约安全审计
