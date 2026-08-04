//! commands/fetch.rs — 在线抓取标题/favicon（fetch_meta 命令 + 后台复用函数）。
//!
//! 超时 5s 降级（AC-08）：任何失败/超时/离线都返回 UrlMeta { title: url, favicon_path: None }。

use std::time::Duration;

use sha1::{Digest, Sha1};
use tauri::State;
use url::Url as ParsedUrl;

use crate::error::AppError;
use crate::models::UrlMeta;
use crate::state::AppState;

/// 在线抓取标题与 favicon。供 `fetch_meta` 命令与 `url_create`/`url_refresh_meta` 后台调用。
pub async fn fetch_url_meta(state: &AppState, url: &str) -> UrlMeta {
    // 并发限流：最多 4 个 favicon 抓取同时进行
    let _permit = match state.favicon_semaphore.acquire().await {
        Ok(p) => p,
        Err(_) => return UrlMeta { title: url.to_string(), favicon_path: None },
    };
    let result = async {
        let resp = state
            .client
            .get(url)
            .timeout(Duration::from_secs(5))
            .header("accept", "text/html")
            .send()
            .await?;
        let final_url = resp.url().to_string();
        let body = resp.text().await?;
        let (title, favicon_href) = extract_meta(&body);
        let title = if title.is_empty() { final_url } else { title };
        let href = favicon_href.unwrap_or_else(|| "/favicon.ico".to_string());
        let favicon_path = download_favicon(state, url, &href).await;
        Ok::<UrlMeta, AppError>(UrlMeta { title, favicon_path })
    }
    .await;
    match result {
        Ok(meta) => meta,
        Err(_) => UrlMeta {
            title: url.to_string(),
            favicon_path: None,
        },
    }
}

#[tauri::command]
pub async fn fetch_meta(state: State<'_, AppState>, url: String) -> Result<UrlMeta, AppError> {
    crate::error::ensure_safe_url(&url)?;
    Ok(fetch_url_meta(&state, &url).await)
}

/// 从 HTML 提取 <title> 与 favicon 链接（best-effort，SPA 首屏可能为空）。
fn extract_meta(body: &str) -> (String, Option<String>) {
    let doc = scraper::Html::parse_document(body);
    let title = doc
        .select(&scraper::Selector::parse("title").unwrap())
        .next()
        .map(|e| e.text().collect::<String>().trim().to_string())
        .unwrap_or_default();
    let favicon = doc
        .select(&scraper::Selector::parse(r#"link[rel~="icon"]"#).unwrap())
        .filter_map(|e| e.attr("href").map(|h| h.to_string()))
        .next();
    (title, favicon)
}

/// 下载 favicon 并落盘到 <data_dir>/favicons/{sha1(url)}.png。
/// 要求 content-type 为 image/* 且体积 <= 2MB，否则返回 None。
async fn download_favicon(state: &AppState, base_url: &str, href: &str) -> Option<String> {
    let resolved = ParsedUrl::parse(base_url).ok().and_then(|b| b.join(href).ok())?;
    let resp = state
        .client
        .get(resolved.as_str())
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .ok()?;
    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if !ct.starts_with("image/") {
        return None;
    }
    let bytes = resp.bytes().await.ok()?;
    if bytes.len() > 2 * 1024 * 1024 {
        return None;
    }
    let sha = sha1_hex(base_url);
    let path = state.data_dir.join("favicons").join(format!("{sha}.png"));
    std::fs::write(&path, &bytes).ok()?;
    Some(path.to_string_lossy().to_string())
}

fn sha1_hex(s: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(s.as_bytes());
    format!("{:x}", hasher.finalize())
}
