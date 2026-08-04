//! bookmarks/parse.rs — Netscape 书签 HTML 解析。
//!
//! 输出每一条链接及其所属文件夹名。容错设计：忽略无法识别的标签、大小写不敏感、
//! 用栈追踪嵌套文件夹；仅保留 http/https（file:/place:/javascript: 等由调用方二次校验）。

use scraper::{ElementRef, Html, Node};

/// 单条书签解析结果。
pub struct ParsedBookmark {
    pub url: String,
    pub title: Option<String>,
    pub folder: Option<String>,
}

/// 解析 Netscape 书签 HTML，返回所有 http/https 链接及其所属文件夹。
pub fn parse_bookmarks(html: &str) -> Vec<ParsedBookmark> {
    let doc = Html::parse_document(html);
    let root = doc.root_element();
    let mut out = Vec::new();
    if let Some(dl) = find_first_dl(root) {
        let mut stack: Vec<String> = Vec::new();
        walk_dl(dl, &mut stack, &mut out);
    }
    out
}

/// 递归查找文档中第一个 <dl>（书签容器）。
fn find_first_dl(el: ElementRef) -> Option<ElementRef> {
    if el.value().name() == "dl" {
        return Some(el);
    }
    for child in el.children() {
        if let Node::Element(node) = child {
            if let Some(ce) = ElementRef::wrap(node) {
                if let Some(found) = find_first_dl(ce) {
                    return Some(found);
                }
            }
        }
    }
    None
}

/// 遍历一个 <dl> 内的 <dt> 项：
/// - <a> 是链接，归入当前文件夹栈顶；
/// - <h3> 是文件夹，压栈后递归其后同级 <dl>（文件夹内容）；
/// - <p> 是 Netscape 常见的包装层，下钻寻找 <dt>。
fn walk_dl(dl: ElementRef, stack: &mut Vec<String>, out: &mut Vec<ParsedBookmark>) {
    for child in dl.children() {
        if let Node::Element(node) = child {
            if let Some(ce) = ElementRef::wrap(node) {
                match ce.value().name() {
                    "dt" => process_dt(ce, stack, out),
                    "p" => walk_dl(ce, stack, out), // 下钻 <p> 包装层
                    _ => {}
                }
            }
        }
    }
}

/// 处理单个 <dt>：根据首个元素子节点区分链接 / 文件夹。
fn process_dt(dt: ElementRef, stack: &mut Vec<String>, out: &mut Vec<ParsedBookmark>) {
    let first = dt.children().find_map(|n| match n {
        Node::Element(e) => ElementRef::wrap(e),
        _ => None,
    });
    let Some(fc) = first else { return };
    match fc.value().name() {
        "a" => {
            if let Some(href) = fc.attr("href") {
                let href = href.trim().to_string();
                if href.starts_with("http://") || href.starts_with("https://") {
                    let title = fc.text().collect::<String>().trim().to_string();
                    let title = if title.is_empty() { None } else { Some(title) };
                    let folder = stack.last().cloned();
                    out.push(ParsedBookmark { url: href, title, folder });
                }
            }
        }
        "h3" => {
            let name = fc.text().collect::<String>().trim().to_string();
            if !name.is_empty() {
                stack.push(name.clone());
                // 找到本 dt 之后的同级 <dl>（文件夹内容）并递归
                let mut sib = dt.next_siblings();
                while let Some(n) = sib.next() {
                    if let Node::Element(se) = n {
                        if let Some(sr) = ElementRef::wrap(se) {
                            if sr.value().name() == "dl" {
                                walk_dl(sr, stack, out);
                                break;
                            }
                        }
                    }
                }
                stack.pop();
            }
        }
        _ => {}
    }
}
