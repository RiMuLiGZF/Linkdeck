//! commands/autostart.rs — 开机自启命令（包装 autostart 插件并同步设置）。

use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::db::repositories::settings_repo;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn autostart_enable(app: AppHandle) -> Result<(), AppError> {
    crate::apply_autostart(&app, true)?;
    let st = app.state::<AppState>();
    let lock = st.db.lock().unwrap();
    let mut s = settings_repo::get(&lock)?;
    s.autostart = true;
    settings_repo::set(&lock, &s)?;
    Ok(())
}

#[tauri::command]
pub async fn autostart_disable(app: AppHandle) -> Result<(), AppError> {
    crate::apply_autostart(&app, false)?;
    let st = app.state::<AppState>();
    let lock = st.db.lock().unwrap();
    let mut s = settings_repo::get(&lock)?;
    s.autostart = false;
    settings_repo::set(&lock, &s)?;
    Ok(())
}

#[tauri::command]
pub async fn autostart_is_enabled(app: AppHandle) -> Result<bool, AppError> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| AppError::Io(format!("查询自启状态失败: {e}")))
}
