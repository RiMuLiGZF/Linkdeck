//! connection.rs — rusqlite 连接与初始化迁移。
//!
//! 纪律（spec §11 / ADR-002）：连接层只打开 SQLite 并应用 WAL 模式（防半写损坏），
//! 然后执行 0001 迁移。所有访问使用命名参数，禁止拼接。

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;
use crate::normalize;

/// 在 `app_data_dir` 下打开（不存在则创建）`url-launcher.db` 并执行初始迁移。
pub fn open(app_data_dir: &Path) -> Result<Connection, AppError> {
    let db_path = app_data_dir.join("url-launcher.db");
    let conn = Connection::open(&db_path)?;

    // WAL 模式：并发读 + 顺序写，避免单写者长时间阻塞 UI 读；降低断电损坏概率。
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| AppError::Sqlite(e.to_string()))?;

    let migration = include_str!("../../db/migrations/0001_init.sql");
    conn.execute_batch(migration)
        .map_err(|e| AppError::Sqlite(format!("迁移执行失败: {e}")))?;

    // 兼容已有数据库：normalized_url 列在 v2 迁移中添加，旧库无此列，静默忽略重复列错误
    let _ = conn.execute_batch("ALTER TABLE links ADD COLUMN normalized_url TEXT;");

    // 回填已有行的 normalized_url（仅首次迁移时需要）
    backfill_normalized_url(&conn)?;

    // 清理因 URL 规范化合并导致的重复行（https://a.com 与 https://a.com/ 归一化后相同）
    deduplicate_normalized_urls(&conn)?;

    // 最后建唯一索引（先回填后建索引，避免 UNIQUE 约束阻止批量 UPDATE）
    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_links_normalized_url ON links(normalized_url);"
    )?;

    // 兼容已有数据库：start_date / end_date 列在比赛管理功能中添加
    let _ = conn.execute_batch("ALTER TABLE links ADD COLUMN start_date TEXT;");
    let _ = conn.execute_batch("ALTER TABLE links ADD COLUMN end_date TEXT;");

    // 首次启动写入默认设置（hotkey=Ctrl+Alt+Space 等），保证 settings 行存在。
    crate::db::repositories::settings_repo::ensure_defaults(&conn)?;

    Ok(conn)
}

/// 为 `normalized_url IS NULL` 的行逐个计算并回填。
fn backfill_normalized_url(conn: &Connection) -> Result<(), AppError> {
    let mut stmt = conn.prepare("SELECT id, url FROM links WHERE normalized_url IS NULL")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut count = 0usize;
    for row in rows {
        let (id, url) = row?;
        let normalized = normalize::normalize_url(&url);
        conn.execute(
            "UPDATE links SET normalized_url = :norm WHERE id = :id",
            rusqlite::named_params! { ":norm": normalized, ":id": id },
        )?;
        count += 1;
    }
    if count > 0 {
        eprintln!("[migrate] 回填了 {count} 条 normalized_url");
    }
    Ok(())
}

/// 删除因 URL 规范化合并产生的重复行，保留 created_at 最早的（相同时保留 id 较小者）。
fn deduplicate_normalized_urls(conn: &Connection) -> Result<(), AppError> {
    let deleted = conn.execute(
        "DELETE FROM links WHERE id IN ( \
            SELECT l2.id FROM links l1 \
            INNER JOIN links l2 \
                ON l1.normalized_url = l2.normalized_url \
                AND (l1.created_at < l2.created_at \
                     OR (l1.created_at = l2.created_at AND l1.id < l2.id)) \
            WHERE l1.normalized_url IS NOT NULL \
        )",
        [],
    )?;
    if deleted > 0 {
        eprintln!("[migrate] 清理了 {deleted} 条规范化后重复的链接");
    }
    Ok(())
}
