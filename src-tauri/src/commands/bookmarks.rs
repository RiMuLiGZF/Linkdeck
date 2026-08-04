//! commands/bookmarks.rs — 书签 HTML 导入命令。
//!
//! 解析 Netscape 书签文件，按文件夹映射分类，批量入库去重（spec F6 / AC-09）。
//! 性能：整个导入循环包裹在单个 SQLite 事务中，避免每条记录单独 fsync。

use std::fs;

use tauri::State;

use crate::db::repositories::{category_repo, url_repo};
use crate::error::AppError;
use crate::models::ImportResult;
use crate::state::AppState;

#[tauri::command]
pub async fn bookmarks_import(
    state: State<'_, AppState>,
    path: String,
) -> Result<ImportResult, AppError> {
    let contents = fs::read_to_string(&path)
        .map_err(|e| AppError::Io(format!("读取书签文件失败: {e}")))?;
    let parsed = crate::bookmarks::parse::parse_bookmarks(&contents);

    let guard = state.db.lock().unwrap();

    // 性能：包裹在单个事务中，避免 N 条记录触发 N 次 fsync。
    guard
        .execute_batch("BEGIN TRANSACTION")
        .map_err(AppError::from)?;

    let result = (|| -> Result<ImportResult, AppError> {
        let mut imported = 0i64;
        let mut skipped = 0i64;
        for b in parsed {
            // AC-15：仅允许 http/https
            if crate::error::ensure_safe_url(&b.url).is_err() {
                skipped += 1;
                continue;
            }
            // 文件夹 -> 分类（按名查找/创建，大小写不敏感）
            let cat_id = match b.folder {
                Some(ref name) if !name.trim().is_empty() => {
                    Some(category_repo::find_or_create_by_name(&guard, name.trim())?)
                }
                _ => None,
            };
            // 应用层去重
            if url_repo::exists(&guard, &b.url) {
                skipped += 1;
                continue;
            }
            url_repo::create(&guard, &b.url, b.title.clone(), cat_id, None)?;
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
