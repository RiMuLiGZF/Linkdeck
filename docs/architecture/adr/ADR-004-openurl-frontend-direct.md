# ADR-004: 打开 URL 由前端直接调用 opener 插件（无额外 Rust 中转）

- **Status**: Accepted（草案）
- **Date**: 2026-08-02
- **Deciders**: 高见远（架构师）

## Background
点击网址须"即时"用指定浏览器（chrome/msedge/firefox/自定义 exe）打开，而非系统默认。

## Decision
前端点击即 `openUrl(url, browserKey)`（`@tauri-apps/plugin-opener`），**不经 Rust 命令中转**。

## Consequences
- 正面：打开延迟 <50ms，路径最短。
- 负面：capability 须按浏览器白名单 `app` 作用域配置（`opener:allow-open-url`），否则被 ACL 拦截。
- 指定浏览器由设置决定：`'chrome' | 'msedge' | 'firefox' | '<exe路径>'`。
