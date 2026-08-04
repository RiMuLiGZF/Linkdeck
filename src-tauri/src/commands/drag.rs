//! commands/drag.rs — 拖拽双通道桥接（drag_resolve）。
//!
//! 前端 HTML5 drop 取到 text/uri-list 后调用本命令；Rust 侧 on_drag_drop 通道
//! 也汇聚到同一 resolve_dropped（见 dragdrop.rs），保证行为一致。

use crate::dragdrop;
use crate::error::AppError;
use crate::models::UrlDraft;

#[tauri::command]
pub async fn drag_resolve(items: Vec<String>) -> Result<Vec<UrlDraft>, AppError> {
    // best-effort：非法/不安全项在 resolve_dropped 内被跳过
    dragdrop::resolve_dropped(items)
}
