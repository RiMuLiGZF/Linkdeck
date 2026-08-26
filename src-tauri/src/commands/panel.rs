//! commands/panel.rs — 面板切换命令。

use tauri::AppHandle;

use crate::error::AppError;

/// 供前端按钮/命令行唤出面板，语义同托盘左键。
#[tauri::command]
pub async fn panel_toggle(app: AppHandle) -> Result<(), AppError> {
    crate::toggle_panel(&app);
    Ok(())
}

/// 隐藏面板：前端关闭按钮 / Esc / 打开链接后调用。
/// 窗口显隐统一由 Rust 端执行（单一控制点），前端仅同步 visible 状态。
#[tauri::command]
pub async fn panel_hide(app: AppHandle) -> Result<(), AppError> {
    crate::hide_panel(&app);
    Ok(())
}
