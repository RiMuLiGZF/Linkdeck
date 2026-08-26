-- 0001_init.sql
-- url-launcher 初始 schema（SQLite / rusqlite bundled 3.46, WAL 模式在 Rust 连接层设置）
-- 字段严格对齐 spec 第 6 节。
-- 纪律（ADR-002 / generated-code-failure-modes §3）：应用层全部使用命名参数，禁止字符串拼接。

-- 分类表：1:N links。category_id 在 links 中为可空，删除分类时由应用层将其下链接置 NULL（归"未分类"），
-- 故此处不声明外键，避免级联删除意外丢数据（spec 第 6 节：外键可选，应用层处理）。
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT    NOT NULL PRIMARY KEY,   -- uuid
    name        TEXT    NOT NULL,
    sort        INTEGER NOT NULL DEFAULT 0,
    color       TEXT,                            -- 可空
    icon        TEXT,                            -- 可空（lucide 图标名）
    created_at  TEXT    NOT NULL                -- ISO8601
);

-- 链接表
CREATE TABLE IF NOT EXISTS links (
    id              TEXT    NOT NULL PRIMARY KEY,  -- uuid
    title           TEXT,                          -- 可空（缺省回退 url）
    url             TEXT    NOT NULL,              -- 唯一业务键，应用层去重
    category_id     TEXT,                          -- 可空（NULL = 未分类）
    note            TEXT,                          -- 可空
    favicon_path    TEXT,                          -- 可空；值形如 favicons/{sha1(url)}.png
    normalized_url  TEXT,                          -- 规范化 URL，用于 O(1) 去重；由应用层写入
    created_at      TEXT    NOT NULL               -- ISO8601
);

-- 规范化 URL 唯一索引：使 exists_normalized 从 O(n) 降为 O(1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_normalized_url ON links(normalized_url);

-- KV 设置表：key/value。Settings 结构视图在应用层拆装。
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT NOT NULL PRIMARY KEY,
    value TEXT
);

-- 索引（spec 第 6 节锁定）
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_links_url      ON links(url);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort);
