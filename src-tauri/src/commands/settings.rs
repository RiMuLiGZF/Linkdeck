//! commands/settings.rs — 设置读写命令。
//!
//! settings_get 返回结构化设置；settings_set 持久化前校验快捷键合法性
//! （spec §11 IME 冲突），并在快捷键变化时热更新全局快捷键注册。

use tauri::{AppHandle, State};

use crate::db::repositories::settings_repo;
use crate::error::AppError;
use crate::models::Settings;
use crate::state::AppState;

#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>) -> Result<Settings, AppError> {
    settings_repo::get(&state.db.lock().unwrap())
}

#[tauri::command]
pub async fn settings_set(
    state: State<'_, AppState>,
    app: AppHandle,
    hotkey: String,
    default_browser: String,
    autostart: bool,
) -> Result<(), AppError> {
    // 快捷键合法性校验：拒绝 IME/系统保留组合（spec §11）
    if let Err(e) = crate::shortcut::validate_shortcut(&hotkey) {
        return Err(AppError::InvalidUrl(e.to_string()));
    }
    let new_settings = Settings {
        hotkey: hotkey.clone(),
        default_browser,
        autostart,
    };

    // 单锁完成读-改-写，避免双锁竞态
    let old = {
        let guard = state.db.lock().unwrap();
        let old = settings_repo::get(&guard)?;
        settings_repo::set(&guard, &new_settings)?;
        old
    };

    // 快捷键变更：注销旧的、注册新的
    if old.hotkey != new_settings.hotkey {
        let _ = crate::unregister_panel_shortcut(&app, &old.hotkey);
        crate::register_panel_shortcut(&app, &new_settings.hotkey)?;
    }
    // 同步自启状态
    crate::apply_autostart(&app, new_settings.autostart)?;
    Ok(())
}
