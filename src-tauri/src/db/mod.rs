//! db 模块：连接管理与数据访问层。
//!
//! 分层：commands -> repositories -> db。repository 只做参数化 SQL 与行映射，
//! 不含业务逻辑；所有 SQL 值均通过命名参数绑定，禁止字符串拼接（ADR-002）。

pub mod connection;
pub mod repositories;
