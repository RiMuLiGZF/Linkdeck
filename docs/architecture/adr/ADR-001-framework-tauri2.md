# ADR-001: 框架选型 — Tauri 2

- **Status**: Accepted（草案）
- **Date**: 2026-08-02
- **Deciders**: 高见远（架构师）

## Background
需要一款 Windows 本地优先、系统托盘常驻的小工具。候选：Tauri 2 / Electron / .NET WinForms+WebView2。维度含安装体积、启动速度、本团队（Web 栈）开发成本、能力覆盖、维护风险。

## Decision
采用 **Tauri 2**（前端 React 18 + Rust 薄系统层 + SQLite）。

## Consequences
- 正面：安装包 ≈8–15MB（复用系统 WebView2）；冷启 <1s；官方插件全覆盖托盘/快捷键/打开浏览器/自启/拖拽/文件；前端复用 React，团队无需换语言。
- 负面：需少量 Rust（仅系统层），插件版本须与 tauri 2.x 主版本对齐。
- 否决 Electron：体积 ≈120MB、冷启 1–3s，对常驻小工具体验差。
- 否决 .NET WinForms+WebView2：团队为 Web 栈，C# 后端割裂，开发成本最高。
