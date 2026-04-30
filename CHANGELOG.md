# Changelog

## [0.3.0] - 2026-04-30

### 多数据库支持 + 运维改造

#### 关键设计变更

- **禁止 GORM AutoMigrate**：所有建表改用原生 SQL（`migrations/` 目录），GORM 仅作为查询引擎
- **严禁外键**：所有表无外键约束，应用层保证数据一致性
- **DEFAULT 值策略**：所有字段设置 `DEFAULT`（数值为 0，字符串为空串），避免 NULL 转换异常
- **双数据库支持**：MySQL 和 PostgreSQL 通过 `DB_TYPE` 环境变量选择，实际只使用一套
  - `DB_TYPE=auto`（默认）：根据 `DATABASE_URL` 格式自动判断
  - `DB_TYPE=mysql`：强制 MySQL
  - `DB_TYPE=postgres`：强制 PostgreSQL
- **日志统一输出**：日志同时写入 stdout 和 `logs/backend.log`
- **编码统一 UTF-8**：MySQL 建表使用 `utf8mb4_unicode_ci`

#### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/migrations/001_init_mysql.sql` | MySQL 建表脚本 |
| `backend/migrations/001_init_postgres.sql` | PostgreSQL 建表脚本 |
| `CHANGELOG.md` | 本文件 |

#### 修改文件

| 文件 | 变更 |
|------|------|
| `backend/cmd/main.go` | 重构：支持 MySQL/PG 双驱动、原生 SQL 迁移、日志文件输出 |
| `backend/internal/store/models.go` | 所有 GORM 模型添加 `column` tag + `TableName()` 方法，移除 `AutoMigrate` |
| `backend/internal/store/postgres.go` | 无逻辑变更，表名/列名由模型 tag 驱动 |
| `backend/go.mod` | 新增 `gorm.io/driver/mysql` 依赖 |

#### MySQL DSN 格式

```
root:password@tcp(127.0.0.1:3306)/dex?charset=utf8mb4&parseTime=True&loc=Local
```

#### PostgreSQL DSN 格式

```
host=127.0.0.1 port=5432 user=postgres dbname=dex sslmode=disable
```

---

## [0.2.0] - 2026-04-30

### Phase 2 功能

- 新增限价单合约 `LimitOrderVault.sol`（链下挂单 + 链上结算）
- 新增治理合约 `DEXGovernance.sol`（提案 + 代币加权投票 + 执行）
- 新增流动性挖矿合约 `LiquidityMining.sol`（多池质押 + 奖励分配）
- 新增前端页面：限价单、治理投票、流动性挖矿、价格图表
- 新增后端 API：订单 CRUD、提案 CRUD + 投票、交易记录查询、K 线数据查询
- 新增 PostgreSQL 持久化存储（与内存存储双模式切换）
- 后端 store 层重构为接口驱动，模型统一使用 `store` 包

---

## [0.1.0] - 2026-04-29

### 初始版本

- 智能合约：DEXFactory、DEXPair、DEXRouter、DEXLibrary（39 个测试通过）
- Go 后端：REST API + 链上事件监听 + 内存缓存
- Next.js 前端：Swap + 流动性管理 + 钱包连接（RainbowKit + wagmi）
- 部署脚本：核心合约部署 + 测试代币部署
