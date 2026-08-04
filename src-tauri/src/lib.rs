//! lib.rs — url-launcher crate 根（装配文件）。
//!
//! 职责（spec §11 / ADR-002）：只做装配——初始化插件、托管 AppState、构建托盘、
//! 注册默认全局快捷键与自启、锚定窗口、桥接拖拽事件，并把 19 个命令挂到 invoke_handler。
//! 不含任何业务逻辑；领域逻辑在 commands/* 与 db/* 中。

mod bookmarks;
mod commands;
mod db;
mod dragdrop;
mod error;
mod models;
mod shortcut;
mod state;
mod tray;

use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tokio::sync::Semaphore;

use crate::db::repositories::settings_repo;
use crate::error::AppError;
use crate::models::UrlDraft;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            // 1. 数据目录 + favicons 子目录
            let data_dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(data_dir.join("favicons")).ok();

            // 2. SQLite 连接（已含 WAL + 初始迁移）
            let db = db::connection::open(&data_dir).expect("db open failed");

            // 3. HTTP 客户端（5s 超时，避免抓取卡死 UI）
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .unwrap();

            // 4. 组装托管状态
            let state = AppState {
                client,
                db: Arc::new(Mutex::new(db)),
                data_dir,
                favicon_semaphore: Arc::new(Semaphore::new(4)),
            };

            // 5. 托管状态（必须在后续使用 state 的逻辑之前）
            app.manage(state);

            let app_handle = app.app_handle();

            // 6. 系统托盘
            crate::tray::build_tray(&app_handle).expect("tray build failed");

            // 7. 注册默认全局快捷键（读设置中的 hotkey，默认 Alt+Space）
            {
                let db = app_handle.state::<AppState>().db.lock().unwrap();
                let hotkey = settings_repo::get(&db)
                    .map(|s| s.hotkey)
                    .unwrap_or_else(|_| "Alt+Space".to_string());
                let _ = register_panel_shortcut(&app_handle, &hotkey);
            }

            // 8. 自启初始化：若设置开启则启用
            {
                let db = app_handle.state::<AppState>().db.lock().unwrap();
                if let Ok(s) = settings_repo::get(&db) {
                    if s.autostart {
                        let _ = apply_autostart(&app_handle, true);
                    }
                }
            }

            // 9. 窗口锚定 + 拖拽事件
            let window = app.get_webview_window("main").expect("no main window");
            anchor_top_right(&window);

            let app_for_event = app_handle.clone();
            window.on_window_event(move |event: &tauri::WindowEvent| {
                if let tauri::WindowEvent::DragDrop(d) = event {
                    if let tauri::DragDropEvent::Drop { paths, uris, .. } = d {
                        let items: Vec<String> = paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .chain(uris.iter().cloned())
                            .collect();
                        if let Ok(drafts) = crate::dragdrop::resolve_dropped(items) {
                            if !drafts.is_empty() {
                                let _ = app_for_event.emit("drag:resolved", drafts);
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 链接
            commands::urls::urls_list,
            commands::urls::url_create,
            commands::urls::url_update,
            commands::urls::url_delete,
            commands::urls::url_refresh_meta,
            // 分类
            commands::categories::categories_list,
            commands::categories::category_create,
            commands::categories::category_update,
            commands::categories::category_delete,
            commands::categories::category_reorder,
            // 导入 / 抓取
            commands::bookmarks::bookmarks_import,
            commands::data::import_json,
            commands::fetch::fetch_meta,
            // 设置
            commands::settings::settings_get,
            commands::settings::settings_set,
            // 自启
            commands::autostart::autostart_enable,
            commands::autostart::autostart_disable,
            commands::autostart::autostart_is_enabled,
            // 面板 / 拖拽（定义于本文件）
            panel_toggle,
            drag_resolve,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 切换面板可见性：可见→隐藏并广播 false；不可见→重新锚定右上、显示、聚焦并广播 true。
/// 经 run_on_main_thread 派发，确保窗口操作在主线程执行（全局快捷键回调来自独立线程）。
pub fn toggle_panel(app: &AppHandle) {
    let app = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(window) = app.get_webview_window("main") {
            let visible = window.is_visible().unwrap_or(false);
            if visible {
                let _ = window.hide();
                let _ = app.emit("panel:toggle", false);
            } else {
                anchor_top_right(&window);
                let _ = window.show();
                let _ = window.set_focus();
                let _ = app.emit("panel:toggle", true);
            }
        }
    });
}

/// 将面板锚定到当前显示器右上角，按 DPI 缩放避免偏位（spec 已知坑）。
pub fn anchor_top_right(window: &tauri::WebviewWindow) {
    if let Some(mon) = window.current_monitor().ok().flatten() {
        let scale = window.scale_factor().unwrap_or(1.0);
        let panel_w = 520.0 * scale;
        let margin = 16.0 * scale;
        let x = mon.position().x as f64 + mon.size().width as f64 - panel_w - margin;
        let y = mon.position().y as f64 + margin;
        // 直接用物理像素（设备像素），吃掉 scale_factor，避免高分屏偏移
        let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    }
}

/// 解析 combo（如 "Alt+Space"）并注册全局快捷键，回调中切换面板。
/// 使用 2.3.2 的 on_shortcut 附加每快捷键处理器（register 不带 handler）。
pub fn register_panel_shortcut(app: &AppHandle, combo: &str) -> Result<(), AppError> {
    app.global_shortcut()
        .on_shortcut(combo, |app, _shortcut, event| {
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                toggle_panel(app);
            }
        })
        .map_err(|e| AppError::InvalidUrl(e.to_string()))
}

/// 注销全局快捷键；忽略解析/注销错误（settings 热更新时用 let _ = 调用）。
pub fn unregister_panel_shortcut(app: &AppHandle, combo: &str) {
    let _ = app.global_shortcut().unregister(combo);
}

/// 按设置同步开机自启状态。autostart 插件 ManagerExt 方法为 autolaunch()。
pub fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<(), AppError> {
    let m = app.autolaunch();
    if enabled {
        m.enable()
            .map_err(|e| AppError::Io(format!("enable autostart failed: {e}")))
    } else {
        m.disable()
            .map_err(|e| AppError::Io(format!("disable autostart failed: {e}")))
    }
}

/// 供前端按钮/命令行唤出面板，语义同托盘左键（settings 不调用，纯前端入口）。
#[tauri::command]
pub fn panel_toggle(app: AppHandle) {
    toggle_panel(&app);
}

/// 拖拽通道 B：前端 HTML5 drop 取到 text/uri-list 后 invoke，复用 resolve_dropped 保证一致。
#[tauri::command]
pub async fn drag_resolve(items: Vec<String>) -> Result<Vec<UrlDraft>, AppError> {
    crate::dragdrop::resolve_dropped(items)
}
