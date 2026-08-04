//! dragdrop.rs — 拖拽双通道桥接（spec §11 已知坑：链接拖拽 MIME 歧义）
//!
//! 背景：WebView2 从浏览器拖链接常投为文件/文本，MIME 不确定。采用双通道：
//!   通道 A（Rust）：Tauri WindowEvent::DragDrop 的 `paths` —— 处理落到窗口的文件
//!            .html 书签文件 → 解析 Netscape 书签
//!            .url 文件      → 读取 [InternetShortcut] URL= 行
//!   通道 B（前端兜底）：HTML5 drop 取 `dataTransfer.getData('text/uri-list')`
//!            → 调 invoke('drag_resolve', { items }) 交给 Rust 解析
//!   两条通道最终都汇聚到 `resolve_dropped`，保证行为一致。
//!
//! 契约：
//! - `resolve_dropped(items: Vec<String>) -> Vec<UrlDraft>`
//!   入参是混合字符串：文件路径 / http(s) 直链 / text/uri-list 的每一行。
//!   best-effort：非法项直接跳过（不报错），返回可入库的 UrlDraft。

use crate::error::AppError;
use crate::models::UrlDraft;

/// 解析拖拽输入为链接草稿。纯函数，无副作用；非法/不安全项跳过。
///
/// `items` 中每个元素可能是：
/// - 以 `.html` 结尾的路径 → 按书签解析（复用 bookmarks 解析器）
/// - 以 `.url` 结尾的路径 → 读 [InternetShortcut] 的 URL
/// - 以 `http://` / `https://` 开头 → 直链
/// - 其它（含 text/uri-list 的单行、file:// 等）→ 尽力提取 http(s)，否则丢弃
pub fn resolve_dropped(items: Vec<String>) -> Result<Vec<UrlDraft>, AppError> {
    let mut out: Vec<UrlDraft> = Vec::new();
    for raw in items.into_iter().filter(|s| !s.trim().is_empty()) {
        let item = raw.trim();

        // 1) 文件路径（.html / .url）
        if item.ends_with(".html") || item.ends_with(".htm") {
            if let Ok(contents) = std::fs::read_to_string(item) {
                // 复用到期的书签解析；此处仅取 URL+标题，分类留待用户选择
                for d in parse_bookmark_urls(&contents) {
                    out.push(UrlDraft { url: d.0, title: d.1, category_id: None });
                }
            }
            continue;
        }
        if item.ends_with(".url") {
            if let Some(u) = read_internet_shortcut(item) {
                out.push(UrlDraft { url: u, title: None, category_id: None });
            }
            continue;
        }

        // 2) text/uri-list：可能含多行，按行拆分
        if item.contains('\n') || item.contains('\r') {
            for line in item.lines() {
                let line = line.trim();
                if is_safe_web(line) {
                    out.push(UrlDraft { url: line.to_string(), title: None, category_id: None });
                }
            }
            continue;
        }

        // 3) 直链或 file:// 等
        if is_safe_web(item) {
            out.push(UrlDraft { url: item.to_string(), title: None, category_id: None });
        }
        // file:// 或其它 scheme 不作为网址导入（保持最小面板的纯网址定位）
    }
    Ok(out)
}

/// 仅允许 http/https（安全约束 AC-15）。
fn is_safe_web(s: &str) -> bool {
    s.starts_with("http://") || s.starts_with("https://")
}

/// 读取 Windows .url 快捷方式文件的 URL 行。
fn read_internet_shortcut(path: &str) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("URL=").or_else(|| line.strip_prefix("url=")) {
            let u = rest.trim();
            if is_safe_web(u) {
                return Some(u.to_string());
            }
        }
    }
    None
}

/// 极简 Netscape 书签 URL 提取（与 bookmarks_import 共享思路）。
/// 返回 (url, title?) 列表。完整分类映射在 bookmarks_import 中实现。
fn parse_bookmark_urls(html: &str) -> Vec<(String, Option<String>)> {
    let mut out = Vec::new();
    // 匹配 <A ... HREF="url" ...>title</A>
    let re = regex_lazy();
    for cap in re.captures_iter(html) {
        if let Some(m) = cap.name("url") {
            let url = m.as_str().trim();
            if is_safe_web(url) {
                let title = cap.name("title").map(|t| t.as_str().trim().to_string());
                out.push((url.to_string(), title.filter(|t| !t.is_empty())));
            }
        }
    }
    out
}

// 轻量正则（避免引入额外 crate 依赖；如已依赖 regex 可直接复用）。
fn regex_lazy() -> regex::Regex {
    regex::Regex::new(
        r#"(?i)<a\b[^>]*\bhref\s*=\s*["'](?P<url>[^"']+)["'][^>]*>(?P<title>.*?)</a>"#,
    )
    .expect("static regex")
}

// ===========================================================================
// on_drag_drop 事件处理参考（Rust 窗口事件侧，非 invoke 命令）
// ---------------------------------------------------------------------------
// 在 lib.rs 的窗口事件回调中：
//
//   WindowEvent::DragDrop(DragDropEvent::Drop { paths, uris, .. }) => {
//       // 通道 A：文件路径
//       let mut items: Vec<String> = paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
//       // 通道 A 补充：部分浏览器拖拽会带 uris（已是 URL 字符串）
//       for u in uris { items.push(u.to_string()); }
//       match resolve_dropped(items) {
//           Ok(drafts) if !drafts.is_empty() => {
//               // 发给前端，由前端弹窗让用户选分类后调用 url_create
//               window.emit("drag:resolved", drafts).ok();
//           }
//           _ => {}
//       }
//   }
//
// 前端侧（通道 B 兜底）：
//   panel.addEventListener('drop', e => {
//     e.preventDefault();
//     const uriList = e.dataTransfer.getData('text/uri-list'); // 兜底通道
//     const items = uriList.split('\n').map(s => s.trim()).filter(Boolean);
//     // 若通道 A 已处理（窗口已 emit drag:resolved），前端应去重/忽略重复
//     if (items.length) invoke('drag_resolve', { items }).then(drafts => showAddDraft(drafts));
//   });
// 两通道都走 resolve_dropped，结果结构一致（UrlDraft[]），前端统一处理。
// ===========================================================================

