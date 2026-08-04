# ADR-002: 存储选型 — SQLite 优于 JSON 文件

- **Status**: Accepted（草案）
- **Date**: 2026-08-02
- **Deciders**: 高见远（架构师）

## Background
需管理上千条网址 + 分类，要求崩溃安全、搜索流畅、易扩展（分类/标签/点击计数）。候选：JSON 文件 / SQLite。

## Decision
采用 **SQLite**（`rusqlite` + `bundled` 特性，单文件 `app_data_dir/urls.db`，WAL 模式）。

## Consequences
- 正面：事务/崩溃安全（防半写损坏）；索引化搜索（FTS5 支持模糊匹配）；易扩展 schema；并发读写安全。
- 负面：比 JSON 多一层 schema/迁移，但成本可忽略。
- 否决 JSON 的原因：全量读写有半写损坏风险、无并发保护、搜索需全量进内存（数千条虽可接受但非最优）。
- 实现纪律：rusqlite 全部命名参数，禁止字符串拼接（generated-code-failure-modes §3）。
