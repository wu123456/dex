CREATE TABLE IF NOT EXISTS pairs (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    address    VARCHAR(42)     NOT NULL DEFAULT '',
    token0     VARCHAR(42)     NOT NULL DEFAULT '',
    token1     VARCHAR(42)     NOT NULL DEFAULT '',
    reserve0   VARCHAR(128)    NOT NULL DEFAULT '0',
    reserve1   VARCHAR(128)    NOT NULL DEFAULT '0',
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_address (address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tokens (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    address    VARCHAR(42)     NOT NULL DEFAULT '',
    name       VARCHAR(128)    NOT NULL DEFAULT '',
    symbol     VARCHAR(64)     NOT NULL DEFAULT '',
    decimals   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_address (address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS swap_events (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pair        VARCHAR(42)     NOT NULL DEFAULT '',
    sender      VARCHAR(42)     NOT NULL DEFAULT '',
    amount0_in  VARCHAR(128)    NOT NULL DEFAULT '0',
    amount1_in  VARCHAR(128)    NOT NULL DEFAULT '0',
    amount0_out VARCHAR(128)    NOT NULL DEFAULT '0',
    amount1_out VARCHAR(128)    NOT NULL DEFAULT '0',
    to_addr     VARCHAR(42)     NOT NULL DEFAULT '',
    block_num   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    tx_hash     VARCHAR(66)     NOT NULL DEFAULT '',
    log_index   INT UNSIGNED    NOT NULL DEFAULT 0,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pair (pair),
    KEY idx_block_num (block_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS klines (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pair       VARCHAR(42)     NOT NULL DEFAULT '',
    open_time  BIGINT          NOT NULL DEFAULT 0,
    open       VARCHAR(128)    NOT NULL DEFAULT '0',
    high       VARCHAR(128)    NOT NULL DEFAULT '0',
    low        VARCHAR(128)    NOT NULL DEFAULT '0',
    close      VARCHAR(128)    NOT NULL DEFAULT '0',
    volume     VARCHAR(128)    NOT NULL DEFAULT '0',
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pair_time (pair, open_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS limit_orders (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    maker       VARCHAR(42)     NOT NULL DEFAULT '',
    token_in    VARCHAR(42)     NOT NULL DEFAULT '',
    token_out   VARCHAR(42)     NOT NULL DEFAULT '',
    amount_in   VARCHAR(128)    NOT NULL DEFAULT '0',
    amount_out  VARCHAR(128)    NOT NULL DEFAULT '0',
    status      VARCHAR(20)     NOT NULL DEFAULT 'open',
    signature   TEXT            NOT NULL,
    deadline    BIGINT          NOT NULL DEFAULT 0,
    filled_tx   VARCHAR(66)     NOT NULL DEFAULT '',
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS governance_proposals (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    proposer      VARCHAR(42)     NOT NULL DEFAULT '',
    title         VARCHAR(256)    NOT NULL DEFAULT '',
    description   TEXT            NOT NULL,
    status        VARCHAR(20)     NOT NULL DEFAULT 'pending',
    for_votes     VARCHAR(128)    NOT NULL DEFAULT '0',
    against_votes VARCHAR(128)    NOT NULL DEFAULT '0',
    start_time    BIGINT          NOT NULL DEFAULT 0,
    end_time      BIGINT          NOT NULL DEFAULT 0,
    executed_tx   VARCHAR(66)     NOT NULL DEFAULT '',
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
