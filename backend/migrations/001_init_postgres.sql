CREATE TABLE IF NOT EXISTS pairs (
    id         SERIAL PRIMARY KEY,
    address    VARCHAR(42)     NOT NULL DEFAULT '',
    token0     VARCHAR(42)     NOT NULL DEFAULT '',
    token1     VARCHAR(42)     NOT NULL DEFAULT '',
    reserve0   VARCHAR(128)    NOT NULL DEFAULT '0',
    reserve1   VARCHAR(128)    NOT NULL DEFAULT '0',
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_pairs_address ON pairs (address);

CREATE TABLE IF NOT EXISTS tokens (
    id         SERIAL PRIMARY KEY,
    address    VARCHAR(42)     NOT NULL DEFAULT '',
    name       VARCHAR(128)    NOT NULL DEFAULT '',
    symbol     VARCHAR(64)     NOT NULL DEFAULT '',
    decimals   SMALLINT        NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_tokens_address ON tokens (address);

CREATE TABLE IF NOT EXISTS swap_events (
    id          SERIAL PRIMARY KEY,
    pair        VARCHAR(42)     NOT NULL DEFAULT '',
    sender      VARCHAR(42)     NOT NULL DEFAULT '',
    amount0_in  VARCHAR(128)    NOT NULL DEFAULT '0',
    amount1_in  VARCHAR(128)    NOT NULL DEFAULT '0',
    amount0_out VARCHAR(128)    NOT NULL DEFAULT '0',
    amount1_out VARCHAR(128)    NOT NULL DEFAULT '0',
    to_addr     VARCHAR(42)     NOT NULL DEFAULT '',
    block_num   BIGINT          NOT NULL DEFAULT 0,
    tx_hash     VARCHAR(66)     NOT NULL DEFAULT '',
    log_index   INTEGER         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_events_pair ON swap_events (pair);
CREATE INDEX IF NOT EXISTS idx_swap_events_block ON swap_events (block_num);

CREATE TABLE IF NOT EXISTS klines (
    id         SERIAL PRIMARY KEY,
    pair       VARCHAR(42)     NOT NULL DEFAULT '',
    open_time  BIGINT          NOT NULL DEFAULT 0,
    open       VARCHAR(128)    NOT NULL DEFAULT '0',
    high       VARCHAR(128)    NOT NULL DEFAULT '0',
    low        VARCHAR(128)    NOT NULL DEFAULT '0',
    close      VARCHAR(128)    NOT NULL DEFAULT '0',
    volume     VARCHAR(128)    NOT NULL DEFAULT '0',
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_klines_pair_time ON klines (pair, open_time);

CREATE TABLE IF NOT EXISTS limit_orders (
    id          SERIAL PRIMARY KEY,
    maker       VARCHAR(42)     NOT NULL DEFAULT '',
    token_in    VARCHAR(42)     NOT NULL DEFAULT '',
    token_out   VARCHAR(42)     NOT NULL DEFAULT '',
    amount_in   VARCHAR(128)    NOT NULL DEFAULT '0',
    amount_out  VARCHAR(128)    NOT NULL DEFAULT '0',
    status      VARCHAR(20)     NOT NULL DEFAULT 'open',
    signature   TEXT            NOT NULL DEFAULT '',
    deadline    BIGINT          NOT NULL DEFAULT 0,
    filled_tx   VARCHAR(66)     NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders (status);

CREATE TABLE IF NOT EXISTS governance_proposals (
    id            SERIAL PRIMARY KEY,
    proposer      VARCHAR(42)     NOT NULL DEFAULT '',
    title         VARCHAR(256)    NOT NULL DEFAULT '',
    description   TEXT            NOT NULL DEFAULT '',
    status        VARCHAR(20)     NOT NULL DEFAULT 'pending',
    for_votes     VARCHAR(128)    NOT NULL DEFAULT '0',
    against_votes VARCHAR(128)    NOT NULL DEFAULT '0',
    start_time    BIGINT          NOT NULL DEFAULT 0,
    end_time      BIGINT          NOT NULL DEFAULT 0,
    executed_tx   VARCHAR(66)     NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON governance_proposals (status);
