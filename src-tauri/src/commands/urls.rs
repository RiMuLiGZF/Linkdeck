//! commands/urls.rs — 链接相关命令（urls_list / url_create / url_update /
//! url_delete / url_refresh_meta）。签名与 error.rs 契约、openapi 字段对齐。

use tauri::{AppHandle, State};

use crate::db::repositories::url_repo;
use crate::error::AppError;
use crate::models::Url;
use crate::state::AppState;

#[tauri::command]
pub async fn urls_list(
    state: State<'_, AppState>,
    category_id: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<Url>, AppError> {
    let limit = limit.unwrap_or(200);
    url_repo::list(
        &state.db.lock().unwrap(),
        category_id.as_deref(),
        search.as_deref(),
        limit,
    )
}

#[tauri::command]
pub async fn url_create(
    state: State<'_, AppState>,
    app: AppHandle,
    url: String,
    title: Option<String>,
    category_id: Option<String>,
    note: Option<String>,
) -> Result<Url, AppError> {
    // AC-15：仅允许 http/https
    crate::error::ensure_safe_url(&url)?;
    let created = {
        let guard = state.db.lock().unwrap();
        if url_repo::exists(&guard, &url) {
            return Err(AppError::InvalidUrl("该链接已存在".into()));
        }
        url_repo::create(&guard, &url, title.clone(), category_id.clone(), note.clone())?
    };
    // 触发后台 fetch_meta（不阻塞返回；抓取完成后回填标题/favicon）
    let st = state.inner().clone();
    let bg_url = created.url.clone();
    let bg_id = created.id.clone();
    tauri::async_runtime::spawn(async move {
        let meta = crate::commands::fetch::fetch_url_meta(&st, &bg_url).await;
        let _ = url_repo::update_meta(
            &st.db.lock().unwrap(),
            &bg_id,
            &meta.title,
            meta.favicon_path.as_deref(),
        );
    });
    Ok(created)
}

#[tauri::command]
pub async fn url_update(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    category_id: Option<String>,
    note: Option<String>,
) -> Result<Url, AppError> {
    let guard = state.db.lock().unwrap();
    if url_repo::get(&guard, &id)?.is_none() {
        return Err(AppError::NotFound(format!("链接不存在: {id}")));
    }
    url_repo::update(&guard, &id, title, category_id, note)
}

#[tauri::command]
pub async fn url_delete(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let guard = state.db.lock().unwrap();
    let existing = url_repo::get(&guard, &id)?
        .ok_or_else(|| AppError::NotFound(format!("链接不存在: {id}")))?;
    // 清理本地 favicon 文件
    if let Some(p) = &existing.favicon_path {
        let _ = std::fs::remove_file(p);
    }
    url_repo::delete(&guard, &id)
}

#[tauri::command]
pub async fn url_refresh_meta(state: State<'_, AppState>, id: String) -> Result<Url, AppError> {
    let (url, favicon_path) = {
        let guard = state.db.lock().unwrap();
        let existing = url_repo::get(&guard, &id)?
            .ok_or_else(|| AppError::NotFound(format!("链接不存在: {id}")))?;
        (existing.url.clone(), existing.favicon_path.clone())
    };
    // 先清理旧 favicon，再重新抓取
    if let Some(old) = &favicon_path {
        let _ = std::fs::remove_file(old);
    }
    let meta = crate::commands::fetch::fetch_url_meta(&state, &url).await;
    let guard = state.db.lock().unwrap();
    url_repo::update_meta(&guard, &id, &meta.title, meta.favicon_path.as_deref())?;
    url_repo::get(&guard, &id).map(|o| o.ok_or_else(|| AppError::NotFound("链接不存在".into())))?
}
