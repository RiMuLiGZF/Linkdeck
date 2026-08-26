//! commands/data.rs — JSON 备份导入命令（设置对话框「导入 JSON」）。
//!
//! 与 `bookmarks_import` 对称：宽松解析备份文件、按分类名归位、应用层去重。
//! 性能：整个导入循环包裹在单个 SQLite 事务中。
//! 安全约束沿用 AC-15（仅 http/https），所有写入走 repositories 的命名参数。

use std::collections::{HashMap, HashSet};
use std::fs;

use rusqlite::Connection;
use serde::Deserialize;
use tauri::State;

use crate::db::repositories::{category_repo, url_repo};
use crate::error::AppError;
use crate::models::ImportResult;
use crate::state::AppState;

/// 备份文件中的单条链接。除 `url` 外全部可选，兼容手写 JSON 与历史导出格式。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonLink {
    url: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    note: Option<String>,
    #[serde(default)]
    category_id: Option<String>,
    /// 跨机迁移时比 id 更可靠的归类依据。
    #[serde(default)]
    category_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonCategory {
    #[serde(default)]
    id: Option<String>,
    name: String,
}

/// 备份根结构（完整备份形态）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonBackup {
    #[serde(default)]
    categories: Vec<JsonCategory>,
    #[serde(default)]
    links: Vec<JsonLink>,
}

/// 宽松解析，依次尝试三种形态：
/// 1. `{ "categories": [...], "links": [...] }`（完整备份，往返无损）
/// 2. `{ "links": [...] }`
/// 3. `[ ... ]` 裸链接数组（旧版导出 / 手写）
fn parse_backup(raw: &str) -> Result<JsonBackup, AppError> {
    if let Ok(b) = serde_json::from_str::<JsonBackup>(raw) {
        if !b.links.is_empty() || !b.categories.is_empty() {
            return Ok(b);
        }
    }
    let links: Vec<JsonLink> = serde_json::from_str(raw)
        .map_err(|e| AppError::Parse(format!("JSON 结构无法识别: {e}")))?;
    Ok(JsonBackup {
        categories: Vec::new(),
        links,
    })
}

/// 解析链接归属分类：分类名优先 > 备份内 id 映射 > 同库既有 id > 未分类。
fn resolve_category(
    conn: &Connection,
    id_map: &HashMap<String, String>,
    link: &JsonLink,
) -> Result<Option<String>, AppError> {
    if let Some(name) = link
        .category_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(Some(category_repo::find_or_create_by_name(conn, name)?));
    }
    if let Some(old_id) = link.category_id.as_deref().filter(|s| !s.is_empty()) {
        if let Some(new_id) = id_map.get(old_id) {
            return Ok(Some(new_id.clone()));
        }
        // 同库重复导入：原 id 仍存在则沿用，避免重建同名分类。
        if category_repo::get(conn, old_id)?.is_some() {
            return Ok(Some(old_id.to_string()));
        }
    }
    Ok(None)
}

#[tauri::command]
pub async fn import_json(
    state: State<'_, AppState>,
    path: String,
) -> Result<ImportResult, AppError> {
    let contents =
        fs::read_to_string(&path).map_err(|e| AppError::Io(format!("读取 JSON 文件失败: {e}")))?;
    let backup = parse_backup(&contents)?;

    let guard = state.db.lock().unwrap();

    // 性能：包裹在单个事务中，避免 N 条记录触发 N 次 fsync。
    guard
        .execute_batch("BEGIN TRANSACTION")
        .map_err(AppError::from)?;

    let result = (|| -> Result<ImportResult, AppError> {
        // 先重建分类，得到 旧 id -> 新 id 映射。
        let mut id_map: HashMap<String, String> = HashMap::new();
        for c in &backup.categories {
            let name = c.name.trim();
            if name.is_empty() {
                continue;
            }
            let new_id = category_repo::find_or_create_by_name(&guard, name)?;
            if let Some(old_id) = c.id.as_deref().filter(|s| !s.is_empty()) {
                id_map.insert(old_id.to_string(), new_id);
            }
        }

        // 规范化去重：一次性加载现有 URL，避免逐条 O(n²) 扫描
        let mut known: HashSet<String> = url_repo::list_all_urls(&guard)?
            .into_iter()
            .map(|u| crate::normalize::normalize_url(&u))
            .collect();

        let mut imported = 0i64;
        let mut skipped = 0i64;
        for link in &backup.links {
            // AC-15：仅允许 http/https
            if crate::error::ensure_safe_url(&link.url).is_err() {
                skipped += 1;
                continue;
            }
            // 应用层去重（与书签导入一致，按规范化形式比较）
            let normalized = crate::normalize::normalize_url(&link.url);
            if known.contains(&normalized) {
                skipped += 1;
                continue;
            }
            let category_id = resolve_category(&guard, &id_map, link)?;
            url_repo::create(
                &guard,
                &link.url,
                link.title.clone(),
                category_id,
                link.note.clone(),
            )?;
            known.insert(normalized);
            imported += 1;
        }

        Ok(ImportResult { imported, skipped })
    })();

    match result {
        Ok(r) => {
            guard.execute_batch("COMMIT").map_err(AppError::from)?;
            Ok(r)
        }
        Err(e) => {
            let _ = guard.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}
