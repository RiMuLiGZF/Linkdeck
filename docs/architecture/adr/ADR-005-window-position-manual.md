# ADR-005: 窗口定位用手动计算，不引入 positioner 插件

- **Status**: Accepted（草案）
- **Date**: 2026-08-02
- **Deciders**: 高见远（架构师）

## Background
面板须贴屏幕右上角；可选方案：引入 `tauri-plugin-positioner` 或手动计算坐标。

## Decision
用 `current_monitor()` + `scale_factor` 手动算**主显示器**右上角坐标（`WINDOW_W`+margin 偏移），不引入 positioner 插件。

## Consequences
- 正面：少一个依赖、定位逻辑完全可控（含 DPI 修正）。
- 负面：多屏"光标所在屏"锚定需自行扩展（MVP 不做，锚定主屏）。
- 纪律：必须乘 `scale_factor`，否则高 DPI 屏偏位（generated-code-failure-modes：性能/坐标类静默错误高发区）。
