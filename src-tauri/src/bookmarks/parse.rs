//! bookmarks/parse.rs — Netscape 书签 HTML 解析。
//!
//! 输出每一条链接及其所属文件夹名。容错设计：忽略无法识别的标签、大小写不敏感、
//! 仅保留 http/https（file:/place:/javascript: 等由调用方二次校验）。

use scraper::{Html, Node, Selector};

/// 单条书签解析结果。
pub struct ParsedBookmark {
    pub url: String,
    pub title: Option<String>,
    pub folder: Option<String>,
}

/// 解析 Netscape 书签 HTML，返回所有 http/https 链接及其所属文件夹。
pub fn parse_bookmarks(html: &str) -> Vec<ParsedBookmark> {
    let doc = Html::parse_document(html);
    let a_sel = Selector::parse("a[href]").unwrap();
    let mut out = Vec::new();

    for el in doc.select(&a_sel) {
        let href = match el.value().attr("href") {
            Some(h) => h.trim().to_string(),
            None => continue,
        };
        if !href.starts_with("http://") && !href.starts_with("https://") {
            continue;
        }
        let title = {
            let t = el.text().collect::<String>().trim().to_string();
            if t.is_empty() { None } else { Some(t) }
        };
        // 向上查找最近的 h3 祖先作为文件夹名
        let folder = find_folder_name(el);
        out.push(ParsedBookmark { url: href, title, folder });
    }
    out
}

/// 沿祖先链查找最近的 <h3> 文本作为文件夹名。
fn find_folder_name(el: scraper::ElementRef) -> Option<String> {
    let mut current = el.parent();
    while let Some(parent_ref) = current {
        if let Node::Element(ref elem) = *parent_ref.value() {
            if elem.name() == "h3" {
                // 用 ElementRef::wrap 获取元素能力来取 text()
                if let Some(parent_el) = scraper::ElementRef::wrap(parent_ref) {
                    let name = parent_el.text().collect::<String>().trim().to_string();
                    if !name.is_empty() {
                        return Some(name);
                    }
                }
            }
        }
        current = parent_ref.parent();
    }
    None
}
