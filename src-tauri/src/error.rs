//! error.rs — url-launcher 统一错误类型与命令签名契约
//!
//! 设计纪律（spec §11 已知坑 / ADR-002 / generated-code-failure-modes）：
//! - `AppError` 实现 `serde::Serialize`，Tauri 把命令错误序列化为字符串回前端；
//!   同时实现 `Into<String>` 供显式转换（如托盘/快捷键处理中需要字符串消息）。
//! - 所有 DB 访问在 commands 中用 rusqlite 命名参数（`:name`），**禁止字符串拼接**。
//! - 命令签名（下方 `CommandSignatures` 区块）与 `openapi.yaml` 严格对齐，
//!   前端/后端以该契约为唯一依据。

use serde::Serialize;
use std::fmt;

/// 应用统一错误。
/// 变体携带 `String` 描述，便于直接序列化给前端；前端按 `code` 区分类型展示。
#[derive(Debug, Serialize, Clone)]
pub enum AppError {
    /// SQLite 读写错误（含约束冲突、损坏）
    Sqlite(String),
    /// 文件系统错误（favicon 读写、书签文件读取等）
    Io(String),
    /// 网络错误（fetch_meta / 书签抓取超时或失败）
    Network(String),
    /// 解析错误（HTML 书签、.url 文件、响应体）
    Parse(String),
    /// 资源不存在（id 查不到）
    NotFound(String),
    /// URL 非法或 scheme 非 http/https（安全约束 AC-15）
    InvalidUrl(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Sqlite(m) => write!(f, "数据库错误: {m}"),
            AppError::Io(m) => write!(f, "文件错误: {m}"),
            AppError::Network(m) => write!(f, "网络错误: {m}"),
            AppError::Parse(m) => write!(f, "解析错误: {m}"),
            AppError::NotFound(m) => write!(f, "未找到: {m}"),
            AppError::InvalidUrl(m) => write!(f, "非法链接: {m}"),
        }
    }
}

impl std::error::Error for AppError {}

/// 显式转 String（Tauri 前端拿到的是序列化后的字符串，这里提供便捷转换）。
impl From<AppError> for String {
    fn from(e: AppError) -> String {
        e.to_string()
    }
}

// ---------- From 转换（命令内部用 `?` 自动归一） ----------

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        // 唯一约束冲突（重复 URL）给更友好的提示
        if let rusqlite::Error::SqliteFailure(ref fr, _) = e {
            if fr.code == rusqlite::ErrorCode::ConstraintViolation {
                return AppError::InvalidUrl("该链接已存在".into());
            }
        }
        AppError::Sqlite(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<url::ParseError> for AppError {
    fn from(e: url::ParseError) -> Self {
        AppError::InvalidUrl(e.to_string())
    }
}

/// 安全校验：仅允许 http/https scheme（AC-15，拒绝命令注入）。
/// 命令入参在写入前必须过此关。
pub fn ensure_safe_url(raw: &str) -> Result<(), AppError> {
    match url::Url::parse(raw) {
        Ok(u) if u.scheme() == "http" || u.scheme() == "https" => Ok(()),
        Ok(u) => Err(AppError::InvalidUrl(format!("不允许的 scheme: {}", u.scheme()))),
        Err(e) => Err(AppError::InvalidUrl(e.to_string())),
    }
}

// ===========================================================================
// CommandSignatures —— 与 openapi.yaml 严格对齐的 Rust 命令签名契约
// （实际实现分布在 commands.rs / db.rs；此处仅作契约锚点，便于前后端评审）
// 约定：所有命令 `async fn`，返回 `Result<T, AppError>`。
// ===========================================================================

/// 命令签名契约（trait 仅为文档锚点，实际实现在 commands.rs / db.rs）。
/// 方法签名与 openapi.yaml 严格对齐：参数与返回类型一一对应。
/// 编译期保障：实现侧 `impl CommandContract for ...` 若签名漂移会被编译器捕获。
#[allow(dead_code)]
pub trait CommandContract {
    // --- 链接 ---
    fn urls_list(&self, category_id: Option<String>, search: Option<String>, limit: Option<i64>) -> impl std::future::Future<Output = Result<Vec<crate::models::Url>, AppError>> + Send;
    fn url_create(&self, url: String, title: Option<String>, category_id: Option<String>, note: Option<String>) -> impl std::future::Future<Output = Result<crate::models::Url, AppError>> + Send;
    fn url_update(&self, id: String, title: Option<String>, category_id: Option<String>, note: Option<String>) -> impl std::future::Future<Output = Result<crate::models::Url, AppError>> + Send;
    fn url_delete(&self, id: String) -> impl std::future::Future<Output = Result<(), AppError>> + Send;
    fn url_refresh_meta(&self, id: String) -> impl std::future::Future<Output = Result<crate::models::Url, AppError>> + Send;

    // --- 分类 ---
    fn categories_list(&self) -> impl std::future::Future<Output = Result<Vec<crate::models::Category>, AppError>> + Send;
    fn category_create(&self, name: String, color: Option<String>, icon: Option<String>) -> impl std::future::Future<Output = Result<crate::models::Category, AppError>> + Send;
    fn category_update(&self, id: String, name: Option<String>, color: Option<String>, icon: Option<String>, sort: Option<i64>) -> impl std::future::Future<Output = Result<crate::models::Category, AppError>> + Send;
    fn category_delete(&self, id: String) -> impl std::future::Future<Output = Result<(), AppError>> + Send; // 级联：链接置 NULL（未分类）
    fn category_reorder(&self, ordered_ids: Vec<String>) -> impl std::future::Future<Output = Result<(), AppError>> + Send;

    // --- 导入 / 抓取 ---
    fn bookmarks_import(&self, path: String) -> impl std::future::Future<Output = Result<crate::models::ImportResult, AppError>> + Send;
    fn fetch_meta(&self, url: String) -> impl std::future::Future<Output = Result<crate::models::UrlMeta, AppError>> + Send; // 超时5s降级

    // --- 设置 ---
    fn settings_get(&self) -> impl std::future::Future<Output = Result<crate::models::Settings, AppError>> + Send;
    fn settings_set(&self, settings: crate::models::Settings) -> impl std::future::Future<Output = Result<(), AppError>> + Send;

    // --- 开机自启（autostart 插件） ---
    fn autostart_enable(&self) -> impl std::future::Future<Output = Result<(), AppError>> + Send;
    fn autostart_disable(&self) -> impl std::future::Future<Output = Result<(), AppError>> + Send;
    fn autostart_is_enabled(&self) -> impl std::future::Future<Output = Result<bool, AppError>> + Send;

    // --- 面板（Rust 侧触发，通常不由前端 invoke） ---
    fn panel_toggle(&self) -> impl std::future::Future<Output = Result<(), AppError>> + Send;

    // --- 拖拽双通道桥接（扩展命令） ---
    fn drag_resolve(&self, items: Vec<String>) -> impl std::future::Future<Output = Result<Vec<crate::models::UrlDraft>, AppError>> + Send;
}
