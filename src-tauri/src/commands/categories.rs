//! commands/categories.rs — 分类相关命令。签名与 error.rs 契约、openapi 字段对齐。

use tauri::State;

use crate::db::repositories::category_repo;
use crate::error::AppError;
use crate::models::Category;
use crate::state::AppState;

#[tauri::command]
pub async fn categories_list(state: State<'_, AppState>) -> Result<Vec<Category>, AppError> {
    category_repo::list(&state.db.lock().unwrap())
}

#[tauri::command]
pub async fn category_create(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Category, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidUrl("分类名不能为空".into()));
    }
    category_repo::create(&state.db.lock().unwrap(), name, color, icon)
}

#[tauri::command]
pub async fn category_update(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    sort: Option<i64>,
) -> Result<Category, AppError> {
    let guard = state.db.lock().unwrap();
    if category_repo::get(&guard, &id)?.is_none() {
        return Err(AppError::NotFound(format!("分类不存在: {id}")));
    }
    let name = name.map(|n| n.trim().to_string());
    category_repo::update(&guard, &id, name, color, icon, sort)
}

#[tauri::command]
pub async fn category_delete(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let guard = state.db.lock().unwrap();
    if category_repo::get(&guard, &id)?.is_none() {
        return Err(AppError::NotFound(format!("分类不存在: {id}")));
    }
    // 级联：其下链接归“未分类”（category_id 置 NULL）
    category_repo::delete(&guard, &id)
}

#[tauri::command]
pub async fn category_reorder(
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> Result<(), AppError> {
    category_repo::reorder(&state.db.lock().unwrap(), &ordered_ids)
}
