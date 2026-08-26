//! models.rs — 领域实体（与 openapi.yaml / spec 第 6 节 DB 列对齐）
//!
//! 序列化用 `#[serde(rename_all = "camelCase")]`，使 Tauri 返回前端的 JSON 键与
//! openapi.yaml 的 TS 类型一致（created_at -> createdAt 等）。
//! DB 行（snake_case）在 db.rs 中用 rusqlite 行映射填入这些结构。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Url {
    pub id: String,
    pub title: Option<String>, // 可空，前端回退 url
    pub url: String,            // NOT NULL，仅 http/https
    pub category_id: Option<String>, // 可空 = 未分类
    pub note: Option<String>,
    pub favicon_path: Option<String>, // 可空
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String, // NOT NULL
    pub sort: i64,    // DEFAULT 0
    pub color: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub count: i64, // categories_list 聚合，非 DB 列
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub hotkey: String,          // 如 "Ctrl+Alt+Space"
    pub default_browser: String, // 'chrome'|'msedge'|'firefox'|'<exe路径>'
    pub autostart: bool,
    pub show_on_startup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: i64,
    pub skipped: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlMeta {
    pub title: String,
    pub favicon_path: Option<String>,
}

/// 拖拽/书签解析产出的草稿，待用户确认分类后写入 links。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlDraft {
    pub url: String,
    pub title: Option<String>,
    pub category_id: Option<String>,
}
