//! settings_repo.rs — settings 表（KV）读写。
//!
//! settings 表是 key/value 行；本模块在应用层把三行聚合成 `Settings` 结构视图，
//! 持久化时拆回 key/value 行。所有值经命名参数绑定，禁止拼接。

use rusqlite::{named_params, Connection};

use crate::error::AppError;
use crate::models::Settings;

/// 读取单个键；不存在返回 None（不视为错误）。
fn read_key(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    match conn.query_row(
        "SELECT value FROM settings WHERE key = :key",
        named_params! { ":key": key },
        |row| row.get::<_, String>(0),
    ) {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}

/// 写入单个键（存在则覆盖）。
fn upsert(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (:key, :value) \
         ON CONFLICT(key) DO UPDATE SET value = :value",
        named_params! { ":key": key, ":value": value },
    )?;
    Ok(())
}

/// 读取全部设置；缺键时用安全默认值补全。
pub fn get(conn: &Connection) -> Result<Settings, AppError> {
    let hotkey = read_key(conn, "hotkey")?.unwrap_or_else(|| "Ctrl+Alt+Space".to_string());
    let default_browser = read_key(conn, "default_browser")?.unwrap_or_default();
    let autostart = read_key(conn, "autostart")?
        .map(|v| v == "true")
        .unwrap_or(false);
    Ok(Settings {
        hotkey,
        default_browser,
        autostart,
    })
}

/// 持久化全部设置（拆回 key/value 行）。
pub fn set(conn: &Connection, s: &Settings) -> Result<(), AppError> {
    upsert(conn, "hotkey", &s.hotkey)?;
    upsert(conn, "default_browser", &s.default_browser)?;
    upsert(conn, "autostart", if s.autostart { "true" } else { "false" })?;
    Ok(())
}

/// 首次启动时写入默认设置（仅当 hotkey 行尚不存在）。
pub fn ensure_defaults(conn: &Connection) -> Result<(), AppError> {
    if read_key(conn, "hotkey")?.is_none() {
        upsert(conn, "hotkey", "Ctrl+Alt+Space")?;
        upsert(conn, "default_browser", "")?;
        upsert(conn, "autostart", "false")?;
    }
    Ok(())
}
