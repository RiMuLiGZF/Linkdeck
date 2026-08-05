//! tray.rs — 系统托盘构建。
//!
//! 菜单：显示/隐藏面板、设置、退出；左键点击切换面板（spec AC-03）。
//! 托盘必须可重新唤出（spec §11：skipTaskbar 丢窗兜底）。

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
    AppHandle, Emitter,
};

use crate::error::AppError;

/// 构建系统托盘图标与菜单。
pub fn build_tray(app: &AppHandle) -> Result<(), AppError> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| AppError::Io("未找到窗口图标".into()))?;

    let show_item = MenuItem::with_id(app, "show", "显示/隐藏面板", true, None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let settings_item = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let separator = PredefinedMenuItem::separator(app).map_err(|e| AppError::Io(e.to_string()))?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
        .map_err(|e| AppError::Io(e.to_string()))?;

    let items: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![&show_item, &settings_item, &separator, &quit_item];
    let menu = Menu::with_items(app, &items).map_err(|e| AppError::Io(e.to_string()))?;

    // 左键处理器需要拥有的 AppHandle（闭包要求 'static）
    let app_for_tray = app.clone();
    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app_handle, event| match event.id.as_ref() {
            "show" => crate::toggle_panel(app_handle),
            "settings" => {
                let _ = app_handle.emit("navigate", "settings");
            }
            "quit" => app_handle.exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                crate::toggle_panel(&app_for_tray);
            }
        })
        .build(app)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}
