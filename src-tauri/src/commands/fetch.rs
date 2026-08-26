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
        // 大页面仅解析前 200K 字符：<title> 与 <link rel="icon"> 均位于 head 前部
        let body: String = body.chars().take(200_000).collect();
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
    // 内联图标（data:image/...），部分站点直接以 base64 嵌入 HTML，无需网络请求
    if let Some((ext, bytes)) = decode_data_icon(href) {
        let sha = sha1_hex(base_url);
        let path = state.data_dir.join("favicons").join(format!("{sha}.{ext}"));
        std::fs::write(&path, &bytes).ok()?;
        return Some(path.to_string_lossy().to_string());
    }

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
    // 按真实 Content-Type 保存扩展名，避免 SVG 等图标被存成 .png 后无法渲染
    let ext = ext_for_content_type(&ct);
    let path = state.data_dir.join("favicons").join(format!("{sha}.{ext}"));
    std::fs::write(&path, &bytes).ok()?;
    Some(path.to_string_lossy().to_string())
}

/// 按 Content-Type 推断文件扩展名；未知的 image/* 一律回退 png。
fn ext_for_content_type(ct: &str) -> &'static str {
    match ct
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "image/svg+xml" => "svg",
        "image/x-icon" | "image/vnd.microsoft.icon" => "ico",
        "image/webp" => "webp",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/avif" => "avif",
        "image/bmp" => "bmp",
        _ => "png",
    }
}

/// 解析内联图标 `data:image/<subtype>[;base64],<data>`，返回 (扩展名, 字节)。
fn decode_data_icon(href: &str) -> Option<(String, Vec<u8>)> {
    use base64::Engine as _;
    let rest = href.strip_prefix("data:image/")?;
    let (meta, data) = rest.split_once(',')?;
    let (subtype, encoded) = match meta.rsplit_once(';') {
        Some((st, "base64")) => (st, true),
        _ => (meta, false),
    };
    let ext = subtype.split('+').next().unwrap_or(subtype).to_ascii_lowercase();
    if ext.is_empty() || !ext.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    let bytes = if encoded {
        base64::engine::general_purpose::STANDARD.decode(data).ok()?
    } else {
        percent_encoding::percent_decode_str(data).collect::<Vec<u8>>()
    };
    if bytes.is_empty() {
        return None;
    }
    Some((ext, bytes))
}

fn sha1_hex(s: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(s.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::{decode_data_icon, ext_for_content_type};

    #[test]
    fn maps_content_type_to_extension() {
        assert_eq!(ext_for_content_type("image/svg+xml"), "svg");
        assert_eq!(ext_for_content_type("image/x-icon"), "ico");
        assert_eq!(ext_for_content_type("image/vnd.microsoft.icon"), "ico");
        assert_eq!(ext_for_content_type("image/png"), "png");
        assert_eq!(ext_for_content_type("image/jpeg; charset=utf-8"), "jpg");
        assert_eq!(ext_for_content_type("application/octet-stream"), "png");
    }

    #[test]
    fn decodes_base64_data_icon() {
        let (ext, bytes) = decode_data_icon("data:image/png;base64,aGVsbG8=").expect("decode");
        assert_eq!(ext, "png");
        assert_eq!(bytes, b"hello");
    }

    #[test]
    fn decodes_svg_data_icon() {
        let (ext, bytes) =
            decode_data_icon("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=").expect("decode");
        assert_eq!(ext, "svg");
        assert_eq!(bytes, b"<svg></svg>");
    }

    #[test]
    fn rejects_non_image_or_bad_data_uri() {
        assert!(decode_data_icon("data:text/plain;base64,aGk=").is_none());
        assert!(decode_data_icon("not-a-data-uri").is_none());
    }
}
