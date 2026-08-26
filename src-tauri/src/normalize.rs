//! URL 规范化：用于去重与一致性比较。
//! 规则：scheme/host 小写、去除默认端口、去除 fragment、去除多余尾部斜杠。
//! 不改变 path/query 的大小写（路径与查询参数本身大小写敏感）。

use url::Url;

/// 将用户输入 URL 规范化为可比较的规范形式。
/// 解析失败时原样返回（去首尾空白），保证调用方总能拿到字符串。
pub fn normalize_url(input: &str) -> String {
    let trimmed = input.trim();
    let Ok(mut parsed) = Url::parse(trimmed) else {
        return trimmed.to_string();
    };
    parsed.set_fragment(None);

    let scheme = parsed.scheme().to_ascii_lowercase();
    let host = parsed.host_str().map(str::to_ascii_lowercase);
    let default_port = match scheme.as_str() {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    };
    let port = parsed.port().filter(|p| default_port != Some(*p));

    let mut out = format!("{scheme}://");
    if let Some(h) = host {
        out.push_str(&h);
    }
    if let Some(p) = port {
        out.push_str(&format!(":{p}"));
    }
    let path = parsed.path();
    let path = if path.len() > 1 {
        path.trim_end_matches('/')
    } else {
        // 根路径（"/"）归一为空，使 https://a.com 与 https://a.com/ 视为同一条
        ""
    };
    out.push_str(path);
    if let Some(q) = parsed.query() {
        if !q.is_empty() {
            out.push('?');
            out.push_str(q);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::normalize_url;

    #[test]
    fn lowercases_scheme_and_host() {
        assert_eq!(normalize_url("HTTPS://Example.COM"), "https://example.com");
    }

    #[test]
    fn strips_default_ports() {
        assert_eq!(
            normalize_url("https://example.com:443/a"),
            "https://example.com/a"
        );
        assert_eq!(
            normalize_url("http://example.com:80/a"),
            "http://example.com/a"
        );
    }

    #[test]
    fn keeps_non_default_port() {
        assert_eq!(
            normalize_url("http://example.com:8080/a"),
            "http://example.com:8080/a"
        );
    }

    #[test]
    fn strips_trailing_slash_and_fragment() {
        assert_eq!(normalize_url("https://example.com/a/"), "https://example.com/a");
        assert_eq!(normalize_url("https://example.com/a#frag"), "https://example.com/a");
    }

    #[test]
    fn root_and_query() {
        assert_eq!(normalize_url("https://example.com/"), "https://example.com");
        assert_eq!(normalize_url("https://example.com"), "https://example.com");
        assert_eq!(normalize_url("https://example.com/?q=1"), "https://example.com?q=1");
    }

    #[test]
    fn falls_back_to_trimmed_input() {
        assert_eq!(normalize_url("  不是网址  "), "不是网址");
    }
}