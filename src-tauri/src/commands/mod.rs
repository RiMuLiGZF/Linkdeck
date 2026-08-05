//! commands 子模块声明。
//!
//! 每个文件实现 openapi.yaml 中对应的一组 invoke 命令，签名与 error.rs 的
//! `CommandContract` 契约及 openapi 字段（camelCase）严格对齐。

pub mod autostart;
pub mod bookmarks;
pub mod categories;
pub mod data;
pub mod drag;
pub mod fetch;
pub mod panel;
pub mod settings;
pub mod urls;
