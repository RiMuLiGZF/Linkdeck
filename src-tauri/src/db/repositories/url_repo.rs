//! url_repo.rs — links 表访问（参数化 SQL，禁止拼接）。
//!
//! 字段与 spec 第 6 节、models::Url 对齐。favicon_path 存绝对路径（便于前端
//! 直接经 convertFileSrc 显示）。

use chrono::Utc;
use rusqlite::{named_params, Connection, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::Url;
use crate::normalize;

/// 行映射：links 列 -> Url（favicon_path 存绝对路径，原样返回）。
fn row_to_url(row: &Row) -> Result<Url, rusqlite::Error> {
    Ok(Url {
        id: row.get("id")?,
        title: row.get("title")?,
        url: row.get("url")?,
        category_id: row.get("category_id")?,
        note: row.get("note")?,
        favicon_path: row.get("favicon_path")?,
        created_at: row.get("created_at")?,
    })
}

/// 返回全部链接的 url 列（供应用层规范化去重，避免重复查询）。
pub fn list_all_urls(conn: &Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare("SELECT url FROM links")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 规范化去重：通过 normalized_url 唯一索引做 O(1) 查找。
/// 使 https://a.com 与 https://a.com/ 视为同一条。
pub fn exists_normalized(conn: &Connection, normalized: &str) -> bool {
    conn.query_row(
        "SELECT id FROM links WHERE normalized_url = :norm LIMIT 1",
        named_params! { ":norm": normalized },
        |_| Ok(()),
    )
    .is_ok()
}

/// 按 id 查询单条（不存在返回 None）。
pub fn get(conn: &Connection, id: &str) -> Result<Option<Url>, AppError> {
    let res = conn.query_row(
        "SELECT id, title, url, category_id, note, favicon_path, created_at \
         FROM links WHERE id = :id",
        named_params! { ":id": id },
        row_to_url,
    );
    match res {
        Ok(u) => Ok(Some(u)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}

/// 列表 / 搜索。category_id 与 search 均为可选；所有值经命名参数绑定。
/// search 对标题/URL/分类名做不区分大小写的 LIKE 模糊匹配。
pub fn list(
    conn: &Connection,
    category_id: Option<&str>,
    search: Option<&str>,
    limit: i64,
) -> Result<Vec<Url>, AppError> {
    // 仅拼接静态 SQL 片段；用户数据一律通过 :like / :category_id / :limit 绑定。
    let sql = String::from(
        "SELECT l.id, l.title, l.url, l.category_id, l.note, l.favicon_path, l.created_at \
         FROM links l LEFT JOIN categories c ON l.category_id = c.id \
         WHERE (:category_id IS NULL OR l.category_id = :category_id) \
           AND (:search IS NULL OR l.title LIKE :like ESCAPE '\\' \
                OR l.url LIKE :like ESCAPE '\\' \
                OR c.name LIKE :like ESCAPE '\\') \
         ORDER BY l.created_at DESC LIMIT :limit",
    );

    // 转义 LIKE 通配符，防止用户输入 % / _ 改变查询语义。
    let like = match search {
        Some(s) if !s.trim().is_empty() => {
            let escaped: String = s
                .chars()
                .map(|c| match c {
                    '%' => "\\%".to_string(),
                    '_' => "\\_".to_string(),
                    '\\' => "\\\\".to_string(),
                    other => other.to_string(),
                })
                .collect();
            format!("%{escaped}%")
        }
        _ => "%".to_string(),
    };

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        named_params! {
            ":category_id": category_id,
            ":search": search,
            ":like": like,
            ":limit": limit,
        },
        row_to_url,
    )?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 新增链接。title/category_id/note 均可空。
pub fn create(
    conn: &Connection,
    url: &str,
    title: Option<String>,
    category_id: Option<String>,
    note: Option<String>,
) -> Result<Url, AppError> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let normalized_url = normalize::normalize_url(url);
    conn.execute(
        "INSERT INTO links (id, title, url, category_id, note, favicon_path, normalized_url, created_at) \
         VALUES (:id, :title, :url, :category_id, :note, NULL, :normalized_url, :created_at)",
        named_params! {
            ":id": id,
            ":title": title,
            ":url": url,
            ":category_id": category_id,
            ":note": note,
            ":normalized_url": normalized_url,
            ":created_at": created_at,
        },
    )?;
    Ok(Url {
        id,
        title,
        url: url.to_string(),
        category_id,
        note,
        favicon_path: None,
        created_at,
    })
}

/// 更新链接。所有字段直接赋值（允许设为 NULL），所有值参数化绑定。
pub fn update(
    conn: &Connection,
    id: &str,
    title: Option<String>,
    category_id: Option<String>,
    note: Option<String>,
) -> Result<Url, AppError> {
    conn.execute(
        "UPDATE links SET \
         title = :title, \
         category_id = :category_id, \
         note = :note \
         WHERE id = :id",
        named_params! {
            ":title": title,
            ":category_id": category_id,
            ":note": note,
            ":id": id,
        },
    )?;
    get(conn, id)?.ok_or_else(|| AppError::NotFound(format!("链接不存在: {id}")))
}

/// 更新 favicon，并按需回填标题（B-05：title 传 None 时保留现有标题，
/// 避免后台抓取覆盖用户手填标题；url_refresh_meta 传 Some 强制回填）。
pub fn update_meta(
    conn: &Connection,
    id: &str,
    title: Option<&str>,
    favicon_path: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE links SET title = COALESCE(:title, title), favicon_path = :favicon WHERE id = :id",
        named_params! {
            ":title": title,
            ":favicon": favicon_path,
            ":id": id,
        },
    )?;
    Ok(())
}

/// 删除链接（favicon 文件由调用方负责清理）。
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM links WHERE id = :id", named_params! { ":id": id })?;
    Ok(())
}
