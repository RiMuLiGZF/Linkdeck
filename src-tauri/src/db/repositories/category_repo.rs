//! category_repo.rs — categories 表访问（参数化 SQL，禁止拼接）。
//!
//! 与 spec 第 6 节、models::Category 对齐。categories_list 聚合链接计数
//! （count 非 DB 列，由子查询得到）。删除分类时其下链接 category_id 置 NULL（归“未分类”），
//! 应用层处理、不依赖外键级联。

use chrono::Utc;
use rusqlite::{named_params, Connection, Row};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::Category;

/// 行映射：categories 列 + 聚合 count -> Category。
fn row_to_category(row: &Row) -> Result<Category, rusqlite::Error> {
    Ok(Category {
        id: row.get("id")?,
        name: row.get("name")?,
        sort: row.get("sort")?,
        color: row.get("color")?,
        icon: row.get("icon")?,
        created_at: row.get("created_at")?,
        count: Some(row.get("count")?),
    })
}

/// 按 id 查询单条。
pub fn get(conn: &Connection, id: &str) -> Result<Option<Category>, AppError> {
    let res = conn.query_row(
        "SELECT id, name, sort, color, icon, created_at, 0 AS count \
         FROM categories WHERE id = :id",
        named_params! { ":id": id },
        row_to_category,
    );
    match res {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}

/// 列出全部分类，附带每个分类下的链接计数，按 sort 升序。
pub fn list(conn: &Connection) -> Result<Vec<Category>, AppError> {
    let rows = conn.query_map(
        "SELECT c.id, c.name, c.sort, c.color, c.icon, c.created_at, \
                (SELECT COUNT(*) FROM links l WHERE l.category_id = c.id) AS count \
         FROM categories c ORDER BY c.sort ASC, c.created_at ASC",
        [],
        row_to_category,
    )?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 新增分类，sort 取当前最大值 +1（保持追加在末尾）。
pub fn create(
    conn: &Connection,
    name: &str,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Category, AppError> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let max_sort: i64 = conn.query_row("SELECT COALESCE(MAX(sort), 0) FROM categories", [], |row| {
        row.get(0)
    })?;
    let sort = max_sort + 1;
    conn.execute(
        "INSERT INTO categories (id, name, sort, color, icon, created_at) \
         VALUES (:id, :name, :sort, :color, :icon, :created_at)",
        named_params! {
            ":id": id,
            ":name": name,
            ":sort": sort,
            ":color": color,
            ":icon": icon,
            ":created_at": created_at,
        },
    )?;
    Ok(Category {
        id,
        name: name.to_string(),
        sort,
        color,
        icon,
        created_at,
        count: Some(0),
    })
}

/// 更新分类。仅传入非空的字段被改写（COALESCE 保留旧值），所有值参数化绑定。
pub fn update(
    conn: &Connection,
    id: &str,
    name: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    sort: Option<i64>,
) -> Result<Category, AppError> {
    conn.execute(
        "UPDATE categories SET \
         name = COALESCE(:name, name), \
         color = COALESCE(:color, color), \
         icon = COALESCE(:icon, icon), \
         sort = COALESCE(:sort, sort) \
         WHERE id = :id",
        named_params! {
            ":name": name,
            ":color": color,
            ":icon": icon,
            ":sort": sort,
            ":id": id,
        },
    )?;
    get(conn, id)?.ok_or_else(|| AppError::NotFound(format!("分类不存在: {id}")))
}

/// 删除分类：其下链接 category_id 置 NULL（归“未分类”），再删除分类行。
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE links SET category_id = NULL WHERE category_id = :id",
        named_params! { ":id": id },
    )?;
    conn.execute("DELETE FROM categories WHERE id = :id", named_params! { ":id": id })?;
    Ok(())
}

/// 拖拽排序：按传入顺序重设每条分类的 sort 权重。
pub fn reorder(conn: &Connection, ordered_ids: &[String]) -> Result<(), AppError> {
    for (idx, cid) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE categories SET sort = :sort WHERE id = :id",
            named_params! { ":sort": idx as i64, ":id": cid },
        )?;
    }
    Ok(())
}

/// 按文件夹名查找或创建分类（大小写不敏感）。返回分类 id。
/// 用于书签导入时把 Netscape 文件夹映射为分类。
pub fn find_or_create_by_name(conn: &Connection, name: &str) -> Result<String, AppError> {
    if let Ok(id) = conn.query_row(
        "SELECT id FROM categories WHERE lower(name) = lower(:name)",
        named_params! { ":name": name },
        |row| row.get::<_, String>(0),
    ) {
        return Ok(id);
    }
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let max_sort: i64 = conn.query_row("SELECT COALESCE(MAX(sort), 0) FROM categories", [], |row| {
        row.get(0)
    })?;
    conn.execute(
        "INSERT INTO categories (id, name, sort, color, icon, created_at) \
         VALUES (:id, :name, :sort, NULL, NULL, :created_at)",
        named_params! {
            ":id": id,
            ":name": name,
            ":sort": max_sort + 1,
            ":created_at": created_at,
        },
    )?;
    Ok(id)
}
