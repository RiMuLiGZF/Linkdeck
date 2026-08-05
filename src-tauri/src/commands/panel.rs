//! commands/panel.rs — 面板切换命令。

use tauri::AppHandle;

use crate::error::AppError;

/// 供前端按钮/命令行唤出面板，语义同托盘左键。
#[tauri::command]
pub async fn panel_toggle(app: AppHandle) -> Result<(), AppError> {
    crate::toggle_panel(&app);
    Ok(())
}
