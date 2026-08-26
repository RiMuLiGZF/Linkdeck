//! connection.rs — rusqlite 连接与初始化迁移。
//!
//! 纪律（spec §11 / ADR-002）：连接层只打开 SQLite 并应用 WAL 模式（防半写损坏），
//! 然后执行 0001 迁移。所有访问使用命名参数，禁止拼接。

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;

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

    // 首次启动写入默认设置（hotkey=Ctrl+Alt+Space 等），保证 settings 行存在。
    crate::db::repositories::settings_repo::ensure_defaults(&conn)?;

    Ok(conn)
}
