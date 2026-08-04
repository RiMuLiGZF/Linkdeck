//! state.rs — 应用共享状态（托管给 Tauri）。
//!
//! 分层纪律（spec §11 / ADR-002）：状态仅持有无业务逻辑的“资源句柄”，
//! 不放任何领域逻辑。命令通过 `State<'_, AppState>` 注入访问。

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use reqwest::Client;
use rusqlite::Connection;
use tokio::sync::Semaphore;

/// 托管状态：HTTP 客户端 + SQLite 连接 + 数据目录 + favicon 并发信号量。
///
/// - `db` 用 `Arc<Mutex<Connection>>`：rusqlite 的 `Connection` 是 `Send` 但非 `Sync`，
///   经 `Mutex` 包裹后可在线程间安全共享；仓库函数在持锁期间只做同步 IO，不在 `.await` 时持有锁。
/// - `favicon_semaphore` 限制并发抓取数为 4，避免大量书签导入时打爆网络。
/// - 派生 `Clone` 以便把状态整体移入后台任务（后台 fetch_meta）。
#[derive(Clone)]
pub struct AppState {
    pub client: Client,
    pub db: Arc<Mutex<Connection>>,
    pub data_dir: PathBuf,
    pub favicon_semaphore: Arc<Semaphore>,
}
